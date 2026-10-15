"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture() {
  let clock = 0;
  const events = {}, handlers = {}, messages = [], calls = [], stored = new Map(), cells = new Map();
  const save = { getAt: (...args) => cells.get(args.join()) ?? 0, setAt: (value, ...args) => cells.set(args.join(), value) };
  save.setAt(12345678, 0, 1, 0);
  const cores = [1, 2].map(id => ({ uid: id + 100, instVars: { 角色序号: id, X坐标: id, Y坐标: 0, 特殊状态: "" }, behaviors: { DragDrop: { isDragging: false } } }));
  for (const c of cores) {
    const id = c.instVars.角色序号;
    save.setAt(`hero-${id}`, id, 1, 2); save.setAt(id, id, 7, 2); save.setAt(0, id, 8, 2);
  }
  const tiles = [1, 2, 3].map(x => ({ instVars: { X坐标: x, Y坐标: 0, 角色许可: true, 占用开关: x < 3, 建筑序号: 0, 建筑编号: 0 } }));
  const objects = { save: [save], 角色核心: cores, 地面: tiles, jz: [{ getAt: () => 1 }] };
  const runtime = {
    layout: { name: "主界面" }, globalVars: { 当前地图编号: 1, 分页界面: "", 爬塔挑战开关: false },
    objects: Object.fromEntries(Object.entries(objects).map(([k, v]) => [k, { getFirstInstance: () => v[0], getAllInstances: () => v }])),
    storage: { setItem: async (k, v) => stored.set(k, v), getItem: async k => stored.get(k) },
    addEventListener: (name, callback) => { events[name] = callback; },
    callFunction(name, ...args) {
      calls.push([name, ...args]);
      if (name !== "角色位置移动") return;
      const [id, x, y] = args, c = cores.find(c => c.instVars.角色序号 === id);
      const source = tiles.find(t => t.instVars.X坐标 === c.instVars.X坐标);
      const target = tiles.find(t => t.instVars.X坐标 === x);
      if (source.instVars.建筑序号) {
        save.setAt(0, source.instVars.建筑序号, 7, 1); c.instVars.特殊状态 = "";
      } else source.instVars.占用开关 = false;
      target.instVars.占用开关 = true;
      Object.assign(c.instVars, { X坐标: x, Y坐标: y }); save.setAt(x, id, 7, 2); save.setAt(y, id, 8, 2);
    },
  };
  const engine = { GetMainRunningLayout: () => runtime.layout,
    AddDOMComponentMessageHandler: (_, name, f) => { handlers[name] = f; },
    PostComponentMessageToDOM: (_, name, data) => messages.push([name, data]) };
  const sandbox = { performance: { now: () => clock }, console: { info() {}, error() {} },
    runOnStartup: f => { sandbox.start = f; }, C3_CreateRuntime: () => engine };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const file of ["formations.js", "runtime.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../src/${file}`, "utf8"), sandbox);
  sandbox.C3_CreateRuntime(); sandbox.start(runtime);
  return { runtime, engine, save, cores, tiles, events, handlers, messages, calls, stored,
    async hold(slot) { handlers.key({ phase: "down", slot }); clock += 1000; await events.tick(); await handlers.key({ phase: "up", slot }); },
    async tap(slot) { handlers.key({ phase: "down", slot }); await handlers.key({ phase: "up", slot }); } };
}

test("runtime bridge saves and restores through the native move function and repairs swap occupancy", async () => {
  const f = fixture(); await f.hold(1);
  f.runtime.callFunction("角色位置移动", 1, 2, 0, "主地图", false);
  f.runtime.callFunction("角色位置移动", 2, 1, 0, "主地图", false);
  f.calls.length = 0;
  await f.tap(1);
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [1, 2]);
  assert.equal(f.save.getAt(1, 7, 2), 1); assert.equal(f.save.getAt(2, 7, 2), 2);
  assert.equal(f.tiles[0].instVars.占用开关, true); assert.equal(f.tiles[1].instVars.占用开关, true);
  assert.deepEqual(f.calls.filter(c => c[0] === "角色位置移动"), [
    ["角色位置移动", 1, 1, 0, "主地图", false], ["角色位置移动", 2, 2, 0, "主地图", false],
  ]);
});
test("building slots retain their occupant and breakthrough state after swapping", async () => {
  const f = fixture();
  Object.assign(f.tiles[0].instVars, { 建筑序号: 10, 建筑编号: 1, 角色许可: false });
  f.save.setAt(1, 10, 7, 1); f.cores[0].instVars.特殊状态 = "突破";
  await f.hold(2);
  f.runtime.callFunction("角色位置移动", 1, 2, 0, "主地图", false);
  f.runtime.callFunction("角色位置移动", 2, 1, 0, "主地图", false);
  f.save.setAt(2, 10, 7, 1);
  await f.tap(2);
  assert.equal(f.save.getAt(10, 7, 1), 1);
  assert.equal(f.cores[0].instVars.特殊状态, "突破");
  assert.equal(f.cores[1].instVars.特殊状态, "");
});
test("menus, loading, dragging, tower challenge, and a changed map cannot recall", async () => {
  for (const block of [f => { f.runtime.globalVars.分页界面 = "menu"; },
    f => { f.runtime.globalVars.爬塔挑战开关 = true; }, f => { f.runtime.layout = null; },
    f => { f.cores[0].behaviors.DragDrop.isDragging = true; }, f => { f.runtime.globalVars.当前地图编号 = 2; }]) {
    const f = fixture(); await f.hold(1); block(f); await f.tap(1);
    assert.equal(f.calls.length, 0);
  }
});
