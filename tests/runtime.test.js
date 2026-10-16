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
  const cores = [1, 2].map(id => ({ uid: id + 100, instVars: { 角色序号: id, X坐标: id, Y坐标: 0, 特殊状态: "",
    设定状态: id === 1 ? "采矿" : "自动", 优先工作目标X: id === 1 ? 3 : 0, 优先工作目标Y: 0 }, behaviors: { DragDrop: { isDragging: false } } }));
  for (const c of cores) {
    const id = c.instVars.角色序号;
    save.setAt(`hero-${id}`, id, 1, 2); save.setAt(id, id, 7, 2); save.setAt(0, id, 8, 2);
    save.setAt(c.instVars.设定状态, id, 9, 2); save.setAt(c.instVars.优先工作目标X, id, 57, 2);
  }
  const tiles = [1, 2, 3].map(x => ({ instVars: { X坐标: x, Y坐标: 0, 角色许可: true, 占用开关: x < 3, 建筑序号: 0, 建筑编号: 0 } }));
  const objects = { save: [save], 角色核心: cores, 地面: tiles, jz: [{ getAt: () => 1 }], 转场云: [], 世界地图: [], 黑幕: [] };
  let autoActive = true;
  const auto = { IsGroupActive: () => autoActive, SetGroupActive: value => { autoActive = value; } };
  const victory = { _RunAndBlock() { runtime.globalVars.挑战灵兽开关 = false; save.setAt(0, 28, 10, 0); } };
  const runtime = {
    layout: { name: "主界面" }, globalVars: { 当前地图编号: 1, 分页界面: "", 爬塔挑战开关: false, 战斗开关: true },
    objects: Object.fromEntries(Object.entries(objects).map(([k, v]) => [k, { getFirstInstance: () => v[0], getAllInstances: () => v }])),
    storage: { setItem: async (k, v) => stored.set(k, v), getItem: async k => stored.get(k) },
    addEventListener: (name, callback) => { events[name] = callback; },
    callFunction(name, ...args) {
      calls.push([name, ...args]);
      if (name === "威胁度上限") return 100;
      if (name === "开始灵兽挑战") { runtime.globalVars.挑战灵兽开关 = true; return; }
      if (name === "改变角色状态") {
        const [id, mode] = args, c = cores.find(c => c.instVars.角色序号 === id);
        Object.assign(c.instVars, { 设定状态: mode, 优先工作目标X: 0, 优先工作目标Y: 0 });
        save.setAt(mode, id, 9, 2); save.setAt(0, id, 57, 2); save.setAt(0, id, 58, 2);
        return;
      }
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
    GetEventSheetManager: () => ({ GetEventGroupByName: () => auto,
      GetFunctionBlockByName: () => ({ GetEventBlock: () => victory }) }),
    AddDOMComponentMessageHandler: (_, name, f) => { handlers[name] = f; },
    PostComponentMessageToDOM: (_, name, data) => messages.push([name, data]) };
  const sandbox = { performance: { now: () => clock }, console: { info() {}, error() {} },
    runOnStartup: f => { sandbox.start = f; }, C3_CreateRuntime: () => engine };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const file of ["formations.js", "combat.js", "forest.js", "runtime.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../src/${file}`, "utf8"), sandbox);
  sandbox.C3_CreateRuntime(); sandbox.start(runtime);
  return { runtime, engine, save, cores, tiles, events, handlers, messages, calls, stored, objects, auto, victory,
    async tick() { clock += 250; await events.tick(); },
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

async function forestFixture() {
  const f = fixture(); f.runtime.globalVars.当前地图编号 = 28;
  await f.hold(1);
  f.runtime.callFunction("角色位置移动", 1, 2, 0, "主地图", false);
  f.runtime.callFunction("角色位置移动", 2, 1, 0, "主地图", false);
  await f.hold(2); f.calls.length = 0;
  return f;
}
test("Ink Forest adapter uses readiness, suppresses native auto, and observes native victory before repeating", async () => {
  const f = await forestFixture(); await f.tick();
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [1, 2]);
  assert.equal(f.auto.IsGroupActive(), false);
  f.save.setAt(100, 28, 10, 0); await f.tick();
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [2, 1]);
  assert.deepEqual(f.calls.filter(c => c[0] === "开始灵兽挑战"), [["开始灵兽挑战", 28]]);
  f.victory._RunAndBlock(); await f.tick();
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [1, 2]);
  f.save.setAt(100, 28, 10, 0); await f.tick();
  assert.equal(f.calls.filter(c => c[0] === "开始灵兽挑战").length, 2);
  f.handlers.forest(); assert.equal(f.auto.IsGroupActive(), true);
});
test("Ink Forest never acts on another map, during transitions, pause, battle off, menus, or dragging", async () => {
  for (const block of [f => { f.runtime.globalVars.当前地图编号 = 29; },
    f => { f.runtime.globalVars.游戏暂停 = true; }, f => { f.runtime.globalVars.战斗开关 = false; },
    f => { f.runtime.globalVars.分页界面 = "menu"; }, f => { f.objects.转场云.push({}); },
    f => { f.objects.世界地图.push({}); }, f => { f.objects.黑幕.push({ isVisible: true }); },
    f => { f.cores[0].behaviors.DragDrop.isDragging = true; }]) {
    const f = await forestFixture(); f.save.setAt(100, 28, 10, 0); block(f);
    await f.tick(); await f.tick();
    assert.equal(f.calls.filter(c => ["角色位置移动", "开始灵兽挑战"].includes(c[0])).length, 0);
  }
});
test("layout exit restores native auto and default-on loop resumes on a later Ink Forest visit", async () => {
  const f = await forestFixture(); await f.tick(); f.events.beforelayoutstart();
  assert.equal(f.auto.IsGroupActive(), true);
  await f.tick(); assert.equal(f.auto.IsGroupActive(), false);
});
test("saving a formation while the automatic loop loads storage is not lost or overridden", async () => {
  const f = await forestFixture(), resolves = [];
  f.runtime.storage.getItem = key => new Promise(resolve => resolves.push(() => resolve(f.stored.get(key))));
  const loading = f.tick();
  f.cores[0].instVars.X坐标 = 3;
  await f.hold(1);
  for (const resolve of resolves) resolve();
  await loading;
  const saved = f.stored.get("cjs-formations:v1:12345678:28:1");
  assert.equal(saved.characters.find(c => c.id === 1).x, 3);
  assert.equal(f.cores[0].instVars.X坐标, 3);
  assert.equal(f.calls.filter(c => c[0] === "开始灵兽挑战").length, 0);
});

test("combat uses the native mode function, restores work targets, and does not move characters", async () => {
  const f = fixture();
  await f.handlers.combat();
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["战斗", "战斗"]);
  assert.equal(f.save.getAt(1, 9, 2), "战斗");
  await f.handlers.combat();
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["采矿", "自动"]);
  assert.equal(f.save.getAt(1, 9, 2), "采矿");
  assert.equal(f.cores[0].instVars.优先工作目标X, 3);
  assert.equal(f.save.getAt(1, 57, 2), 3);
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [1, 2]);
  assert.deepEqual(f.calls, [["改变角色状态", 1, "战斗"], ["改变角色状态", 2, "战斗"],
    ["改变角色状态", 1, "采矿"], ["改变角色状态", 2, "自动"]]);
});
test("combat is blocked by menus, loading, dragging, and the tower challenge", async () => {
  for (const block of [f => { f.runtime.globalVars.分页界面 = "menu"; },
    f => { f.runtime.globalVars.爬塔挑战开关 = true; }, f => { f.runtime.layout = null; },
    f => { f.cores[0].behaviors.DragDrop.isDragging = true; }]) {
    const f = fixture(); block(f); await f.handlers.combat();
    assert.equal(f.calls.length, 0); assert.equal(f.stored.size, 0);
  }
});
test("combat and formation storage operations cannot overlap", async () => {
  const f = fixture(); let resolve;
  f.runtime.storage.getItem = () => new Promise(r => { resolve = r; });
  const combat = f.handlers.combat();
  await f.hold(1); assert.equal(f.stored.size, 0);
  resolve(null); await combat;
  const formation = f.tap(1);
  await f.handlers.combat();
  assert.equal(f.calls.length, 2);
  resolve(null); await formation;
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
