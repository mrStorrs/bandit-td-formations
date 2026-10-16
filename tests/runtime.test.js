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
  const objects = { save: [save], 角色核心: cores, 地面: tiles, jz: [{ getAt: () => 1 }], 转场云: [], 世界地图: [], 黑幕: [], 二级页面背景: [] };
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
      if (!args[4]) {
        Object.assign(c.instVars, { 优先工作目标X: 0, 优先工作目标Y: 0 });
        save.setAt(0, id, 57, 2); save.setAt(0, id, 58, 2);
      }
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
  for (const file of ["formations.js", "buildings.js", "building-runtime.js", "combat.js", "forest.js", "recruit.js", "recruit-runtime.js", "runtime.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../src/${file}`, "utf8"), sandbox);
  sandbox.C3_CreateRuntime(); sandbox.start(runtime);
  return { runtime, engine, save, cores, tiles, events, handlers, messages, calls, stored, objects, auto, victory,
    async tick() { clock += 250; await events.tick(); },
    async hold(slot, channel = "key") { handlers[channel]({ phase: "down", slot }); clock += 1000; await events.tick(); await handlers[channel]({ phase: "up", slot }); },
    async tap(slot, channel = "key") { handlers[channel]({ phase: "down", slot }); await handlers[channel]({ phase: "up", slot }); } };
}

function buildingFixture() {
  const f = fixture(), sprites = [], pendingSprites = [];
  const visiblePositions = new Map();
  const positions = [[10, 4, 4], [11, 6, 4]];
  const fields = (x, y) => ({ X坐标: x, Y坐标: y, 建设许可: true, 区域: "山寨", 建筑序号: 0, 占用开关: false, 设施编号: 0 });
  for (let y = 3; y <= 10; y++) for (let x = 3; x <= 12; x++) {
    f.tiles.push({ uid: 1000 + f.tiles.length, instVars: fields(x, y) });
  }
  const cover = (x, y) => f.tiles.filter(t => t.instVars.X坐标 >= x && t.instVars.X坐标 <= x + 1 && t.instVars.Y坐标 >= y && t.instVars.Y坐标 <= y + 1);
  for (const [id, x, y] of positions) {
    sprites.push({ instVars: { 建筑序号: id, 建筑编号: 2, 用途: "主地图", 有效解锁: true, X坐标: x, Y坐标: y } });
    visiblePositions.set(id, [x, y]);
    for (const [field, value] of [[1, 2], [2, x], [3, y], [4, 0], [5, 7]]) f.save.setAt(value, id, field, 1);
    for (const t of cover(x, y)) Object.assign(t.instVars, { 建筑序号: id, 占用开关: true });
  }
  f.runtime.objects.地图建筑 = { getAllInstances: () => sprites };
  f.runtime.objects.jz = { getFirstInstance: () => ({ getAt: (type, field) => field === 8 ? 2 : field === 25 ? 2 : 0 }) };
  f.runtime.objects.mc = { getFirstInstance: () => ({ getAt: (id, field) => id === 2 && field === 2 ? "搬迁" : "" }) };
  f.engine.FlushPendingInstances = () => {
    for (const [id, x, y] of pendingSprites) {
      visiblePositions.set(id, [x, y]);
      Object.assign(sprites.find(b => b.instVars.建筑序号 === id).instVars, { X坐标: x, Y坐标: y });
    }
    pendingSprites.length = 0;
  };
  const call = f.runtime.callFunction;
  f.runtime.callFunction = (name, ...args) => {
    if (name !== "建筑搬迁") return call(name, ...args);
    f.calls.push([name, ...args]);
    if (f.refuse) return;
    const [id, oldX, oldY, x, y] = args;
    assert.deepEqual(visiblePositions.get(id), [oldX, oldY], "flush native creations before moving a building again");
    visiblePositions.delete(id); pendingSprites.push([id, x, y]);
    for (const t of cover(oldX, oldY)) Object.assign(t.instVars, { 建筑序号: 0, 占用开关: false });
    // Native relocation selects sprites by coordinates, so occupied destinations
    // are unsafe even when another building will move later in the batch.
    for (const t of cover(x, y)) assert.equal(t.instVars.建筑序号, 0);
    f.save.setAt(x, id, 2, 1); f.save.setAt(y, id, 3, 1);
    for (const t of cover(x, y)) Object.assign(t.instVars, { 建筑序号: id, 占用开关: true });
  };
  return { ...f, sprites, positions: () => positions.map(([id]) => [f.save.getAt(id, 2, 1), f.save.getAt(id, 3, 1)]),
    holdBuildings: slot => f.hold(slot, "building-key"), tapBuildings: slot => f.tap(slot, "building-key"),
    refuseMoves: () => { f.refuse = true; } };
}

test("building runtime restores swaps through native relocation and preserves upgrades and character slots", async () => {
  const f = buildingFixture(); await f.hold(1); await f.holdBuildings(1);
  const characterSlot = JSON.stringify(f.stored.get("cjs-formations:v1:12345678:1:1"));
  const key = "cjs-formations:buildings:v1:12345678:1:1", saved = f.stored.get(key);
  [saved.buildings[0].x, saved.buildings[1].x] = [saved.buildings[1].x, saved.buildings[0].x];
  f.calls.length = 0; await f.tapBuildings(1);
  assert.deepEqual(f.positions(), [[6, 4], [4, 4]]);
  assert.equal(f.calls.filter(c => c[0] === "建筑搬迁").length, 3);
  assert.ok(f.calls.filter(c => c[0] === "建筑搬迁").every(c => c[6] === 3 && c[7] === 0));
  assert.equal(f.save.getAt(10, 5, 1), 7); assert.equal(f.save.getAt(11, 5, 1), 7);
  assert.equal(JSON.stringify(f.stored.get("cjs-formations:v1:12345678:1:1")), characterSlot);
  assert.equal(f.calls.filter(c => c[0] === "角色位置移动").length, 0);
  assert.match(f.messages.at(-1)[1].text, /Building formation 1 restored \(2 moved/);
});
test("building runtime refuses native occupied slots and verifies that native movement succeeded", async () => {
  for (const refuse of [false, true]) {
    const f = buildingFixture(); await f.holdBuildings(1);
    const saved = f.stored.get("cjs-formations:buildings:v1:12345678:1:1"); saved.buildings[0].y = 8;
    if (refuse) f.refuseMoves(); else f.save.setAt(1, 10, 7, 1);
    f.calls.length = 0; await f.tapBuildings(1);
    assert.deepEqual(f.positions(), [[4, 4], [6, 4]]);
    assert.equal(f.calls.filter(c => c[0] === "建筑搬迁").length, refuse ? 1 : 0);
    assert.match(f.messages.at(-1)[1].text, refuse ? /refused/ : /characters/);
  }
});
test("building shortcuts are blocked by menus, transitions, edit modes, and dragging", async () => {
  for (const block of [f => { f.objects.二级页面背景.push({}); }, f => { f.objects.世界地图.push({}); },
    f => { f.objects.转场云.push({}); }, f => { f.objects.黑幕.push({ isVisible: true }); },
    f => { f.runtime.globalVars.拖动模式 = true; }, f => { f.runtime.globalVars.爬塔挑战开关 = true; },
    f => { f.runtime.objects.设施搬迁拖动点 = { getAllInstances: () => [{}] }; },
    f => { f.cores[0].behaviors.DragDrop.isDragging = true; }]) {
    const f = buildingFixture(); block(f); await f.holdBuildings(1);
    assert.equal(f.stored.size, 0); assert.equal(f.calls.length, 0);
  }
});
test("building storage operations exclude combat and character formations and recheck the map after loading", async () => {
  const f = buildingFixture(); await f.holdBuildings(1); f.calls.length = 0;
  let resolve; f.runtime.storage.getItem = () => new Promise(r => { resolve = r; });
  const pending = f.tapBuildings(1);
  await f.handlers.combat(); await f.hold(2);
  assert.equal(f.stored.size, 1); assert.equal(f.calls.length, 0);
  f.runtime.globalVars.当前地图编号 = 2;
  resolve(f.stored.get("cjs-formations:buildings:v1:12345678:1:1")); await pending;
  assert.equal(f.calls.length, 0);
});

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
  assert.equal(f.cores[0].instVars.优先工作目标X, 3);
  assert.equal(f.save.getAt(1, 57, 2), 3);
  const lastMove = f.calls.findLastIndex(c => c[0] === "角色位置移动");
  const firstJob = f.calls.findIndex(c => c[0] === "改变角色状态");
  assert.ok(firstJob > lastMove, "work targets must be applied after native movement clears them");
});

test("formation recall restores jobs and targets on unchanged positions without overwriting C undo", async () => {
  const f = fixture(); await f.hold(1);
  await f.handlers.combat();
  const undoKey = "cjs-formations:combat:v1:12345678";
  const undo = JSON.stringify(f.stored.get(undoKey));
  await f.hold(2); f.calls.length = 0;
  await f.tap(1);
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["采矿", "自动"]);
  assert.equal(f.cores[0].instVars.优先工作目标X, 3);
  assert.equal(f.save.getAt(1, 57, 2), 3);
  await f.tap(2);
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["战斗", "战斗"]);
  assert.equal(f.cores[0].instVars.优先工作目标X, 0);
  assert.equal(f.save.getAt(1, 57, 2), 0);
  assert.equal(f.calls.filter(c => c[0] === "角色位置移动").length, 0);
  assert.equal(JSON.stringify(f.stored.get(undoKey)), undo);
  await f.handlers.combat();
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["采矿", "自动"]);
  assert.equal(f.cores[0].instVars.优先工作目标X, 3);
});
test("legacy formations keep native movement behavior until resaved with jobs", async () => {
  const f = fixture();
  const key = "cjs-formations:v1:12345678:1:1";
  f.stored.set(key, { version: 1, saveId: 12345678, mapId: 1,
    characters: [{ id: 1, identity: JSON.stringify(["hero-1", 0, 0]), x: 3, y: 0 }] });
  await f.tap(1);
  assert.equal(f.cores[0].instVars.X坐标, 3);
  assert.equal(f.cores[0].instVars.设定状态, "采矿");
  assert.equal(f.save.getAt(1, 57, 2), 0);
  assert.equal(f.calls.filter(c => c[0] === "改变角色状态").length, 0);
  assert.match(f.messages.at(-1)[1].text, /Hold 1 again to save jobs/);
  await f.hold(1);
  assert.equal(f.stored.get(key).version, 2);
  assert.equal(f.stored.get(key).characters[0].mode, "采矿");
});
test("a malformed saved job prevents both movement and job changes", async () => {
  const f = fixture(); await f.hold(1);
  const saved = f.stored.get("cjs-formations:v1:12345678:1:1");
  saved.characters[0].x = 3;
  saved.characters[1].priorityY = "bad";
  await f.tap(1);
  assert.equal(f.calls.length, 0);
  assert.match(f.messages.at(-1)[1].text, /invalid jobs/);
});

async function forestFixture() {
  const f = fixture(); f.runtime.globalVars.当前地图编号 = 28;
  await f.hold(1);
  f.runtime.callFunction("角色位置移动", 1, 2, 0, "主地图", false);
  f.runtime.callFunction("角色位置移动", 2, 1, 0, "主地图", false);
  for (const c of f.cores) f.runtime.callFunction("改变角色状态", c.instVars.角色序号, "战斗");
  await f.hold(2); f.calls.length = 0;
  return f;
}

function recruitFixture() {
  const f = fixture(), groups = new Map();
  for (const name of ["倒计时刷新2", "自动招募function", "招募功能点击", "招募锁定点击"]) {
    let active = true;
    groups.set(name, { IsGroupActive: () => active, SetGroupActive: value => { active = value; } });
  }
  f.engine.GetEventSheetManager = () => ({ GetEventGroupByName: name => groups.get(name),
    GetEventVariableBySID: sid => sid === 172869272533233 ? { GetValue: () => true } : null });
  const panels = [{ uid: 900, isVisible: true, instVars: { 功能: "招募" } }];
  const methods = [1, 2, 3].map(id => ({ isVisible: true, instVars: { 功能: "探访", 招募等阶: id, 开关: id < 3 } }));
  for (const [name, values] of Object.entries({ 二级页面背景: panels, 招募页面按钮: methods, mc: [{ getAt: (id, field) => `${field === 23 ? "Method" : "Work"} ${id}` }] })) {
    f.runtime.objects[name] = { getAllInstances: () => values, getFirstInstance: () => values[0] };
  }
  f.save.setAt(9000, 1, 2, 0); f.save.setAt(100, 1, 17, 0);
  for (let id = 1; id <= 3; id++) {
    f.save.setAt(id, id, 0, 3); f.save.setAt(`Recruit ${id}`, id, 1, 3);
    for (let field = 22; field <= 30; field++) f.save.setAt(10, id, field, 3);
  }
  const originalCall = f.runtime.callFunction;
  let refreshes = 0;
  f.runtime.callFunction = (name, ...args) => {
    if (name === "文本") return args[0];
    if (name === "主动寻访费用") return args[0] * 3000;
    if (name === "角色技艺资质分级") return Math.min(7, Math.floor(args[0] / 15) + 1);
    if (name === "主动寻访") {
      assert.ok([...groups.values()].every(g => !g.IsGroupActive()), "native auto and manual clicks must be suspended before rolling");
      f.save.setAt(f.save.getAt(1, 2, 0) - args[0] * 3000, 1, 2, 0);
      if (f.onRoll) f.onRoll();
      else if (f.refresh !== false && f.save.getAt(2, 0, 3) > 0) {
        f.save.setAt(`Match ${++refreshes}`, 2, 1, 3); f.save.setAt(75, 2, 30, 3);
      }
    }
    return originalCall(name, ...args);
  };
  return Object.assign(f, { groups, panels, methods,
    start: (criteria = [{ type: "work-grade", minimum: 5 }]) => f.handlers["recruit-start"]({ method: 1, criteria }) });
}
test("recruit adapter matches the displayed STR/AGI/INT including bonuses and tenths, with work-grade OR", async () => {
  for (const [index, stat] of ["str", "agi", "int"].entries()) {
    const f = recruitFixture();
    // Raw values are tenths: 199 base + 2 bonus displays as 20.1.
    f.save.setAt(199, 2, 10 + index, 3); f.save.setAt(2, 2, 13 + index, 3);
    f.save.setAt(200, 3, 10 + index, 3);
    f.start([{ type: "work-grade", minimum: 4 }, { type: "stat", stat, above: 20 }]);
    await f.tick(); await f.tick();
    assert.equal(f.save.getAt(2, 0, 3), -1, "bonus raises slot 2 above the stat threshold");
    assert.equal(f.save.getAt(3, 0, 3), 3, "equality does not qualify");
    assert.equal(f.save.getAt(1, 2, 0), 9000);
    assert.equal(f.calls.filter(c => c[0] === "主动寻访").length, 0);
    assert.match(f.messages.findLast(m => m[0] === "recruit-status")[1].message, new RegExp(`${stat.toUpperCase()} 20.1`));
  }
});
test("recruit adapter refuses malformed stat data before paying and restores event groups", async () => {
  for (const field of [10, 13]) {
    const f = recruitFixture(); f.save.setAt("200", 2, field, 3);
    f.start([{ type: "stat", stat: "str", above: 20 }]); await f.tick(); await f.tick();
    assert.equal(f.calls.filter(c => c[0] === "主动寻访").length, 0);
    assert.ok([...f.groups.values()].every(g => g.IsGroupActive()));
    assert.match(f.messages.findLast(m => m[0] === "recruit-status")[1].message, /Could not read STR/);
  }
});
test("recruit adapter uses native grades, costs and refresh, locks matches, and restores native automation", async () => {
  const f = recruitFixture(); f.save.setAt(-1, 1, 0, 3);
  await f.tick();
  const state = f.messages.findLast(m => m[0] === "recruit-status")[1];
  assert.deepEqual(Array.from(state.methods, m => m.id), [1, 2]);
  f.start(); await f.tick(); await f.tick();
  assert.equal(f.save.getAt(1, 2, 0), 6000);
  assert.equal(f.save.getAt(1, 0, 3), -1, "previous locks are retained");
  assert.equal(f.save.getAt(2, 0, 3), -1, "matching slot is locked using the native save marker");
  assert.equal(f.save.getAt(3, 0, 3), 3, "unmatched slot stays unlocked");
  assert.ok([...f.groups.values()].every(g => g.IsGroupActive()));
  assert.deepEqual(f.calls.filter(c => c[0] === "主动寻访"), [["主动寻访", 1]]);
  assert.ok(f.calls.some(c => c[0] === "刷新招募页面"));
  await f.tick(); await f.tick();
  assert.equal(f.calls.filter(c => c[0] === "主动寻访").length, 1);
  assert.match(f.messages.findLast(m => m[0] === "recruit-status")[1].message, /Work 9 S/);
});
test("recruit adapter stops when native refresh fails, without spending repeatedly", async () => {
  const f = recruitFixture(); f.refresh = false; f.start(); await f.tick(); await f.tick(); await f.tick();
  assert.equal(f.calls.filter(c => c[0] === "主动寻访").length, 1);
  assert.ok([...f.groups.values()].every(g => g.IsGroupActive()));
  assert.match(f.messages.findLast(m => m[0] === "recruit-status")[1].message, /did not refresh/);
});
test("recruit restart unlocks only the previous match immediately before native refresh and stops on its replacement", async () => {
  const f = recruitFixture(); f.save.setAt(-1, 1, 0, 3); f.save.setAt(90, 1, 22, 3);
  f.save.setAt(75, 2, 30, 3);
  f.start(); assert.equal(f.save.getAt(2, 0, 3), -1);
  const keeper = f.save.getAt(1, 1, 3);
  f.start(); await f.tick();
  assert.equal(f.save.getAt(2, 0, 3), -1, "keep the match locked during the startup delay");
  await f.tick(); await f.tick(); await f.tick();
  assert.equal(f.save.getAt(2, 1, 3), "Match 1", "native refresh replaced the unlocked result");
  assert.equal(f.save.getAt(2, 0, 3), -1, "new qualifying result is locked again");
  assert.equal(f.save.getAt(1, 0, 3), -1); assert.equal(f.save.getAt(1, 1, 3), keeper);
  assert.equal(f.calls.filter(c => c[0] === "主动寻访").length, 1); assert.equal(f.save.getAt(1, 2, 0), 6000);
  f.start(); await f.tick(); await f.tick();
  assert.equal(f.save.getAt(2, 1, 3), "Match 2"); assert.equal(f.save.getAt(2, 0, 3), -1);
  assert.ok([...f.groups.values()].every(g => g.IsGroupActive()));
});
test("failed native refresh restores unchanged declined locks so Start can retry", async () => {
  const f = recruitFixture(); f.save.setAt(75, 2, 30, 3); f.start();
  f.refresh = false; f.start(); await f.tick(); await f.tick();
  assert.equal(f.save.getAt(2, 0, 3), -1);
  assert.match(f.messages.findLast(m => m[0] === "recruit-status")[1].message, /did not refresh/);
  assert.ok([...f.groups.values()].every(g => g.IsGroupActive()));
  f.refresh = true; f.start(); await f.tick(); await f.tick();
  assert.equal(f.save.getAt(2, 1, 3), "Match 1"); assert.equal(f.save.getAt(2, 0, 3), -1);
});
test("declined identities include campaign and full recruit data, excluding only the lock marker", async () => {
  for (const change of [f => f.save.setAt(98765432, 0, 1, 0), f => f.save.setAt(20, 2, 57, 3)]) {
    const f = recruitFixture(); f.save.setAt(75, 2, 30, 3); f.start(); change(f);
    f.start(); await f.tick(); await f.tick();
    assert.equal(f.save.getAt(2, 1, 3), "Recruit 2"); assert.equal(f.save.getAt(2, 0, 3), -1);
  }
});
test("native failure after replacing a declined recruit never locks the replacement as the old result", async () => {
  const f = recruitFixture(); f.save.setAt(75, 2, 30, 3); f.start();
  f.onRoll = () => { f.save.setAt("Replacement", 2, 1, 3); throw new Error("refresh interrupted"); };
  f.start(); await f.tick(); await f.tick();
  assert.equal(f.save.getAt(2, 0, 3), 2);
  assert.match(f.messages.findLast(m => m[0] === "recruit-status")[1].message, /refresh interrupted/);
  assert.ok([...f.groups.values()].every(g => g.IsGroupActive()));
});
test("recruit adapter restores each group's previous state on layout exit", () => {
  const f = recruitFixture(); f.groups.get("自动招募function").SetGroupActive(false);
  f.start(); f.events.beforelayoutstart();
  assert.equal(f.groups.get("自动招募function").IsGroupActive(), false);
  assert.equal(f.groups.get("倒计时刷新2").IsGroupActive(), true);
  assert.equal(f.calls.filter(c => c[0] === "主动寻访").length, 0);
});
test("recruit adapter ignores closed screens and rejects locked methods, dialogs, and malformed grades", async () => {
  for (const change of [f => { f.panels.length = 0; }, f => { f.methods[0].instVars.开关 = false; },
    f => { f.runtime.objects.对话选择框 = { getAllInstances: () => [{}] }; },
    f => f.save.setAt("invalid", 2, 25, 3)]) {
    const f = recruitFixture(); change(f); f.start(); await f.tick(); await f.tick();
    assert.equal(f.calls.filter(c => c[0] === "主动寻访").length, 0);
    assert.ok([...f.groups.values()].every(g => g.IsGroupActive()));
  }
});
test("Ink Forest adapter uses readiness, suppresses native auto, and observes native victory before repeating", async () => {
  const f = await forestFixture(); await f.tick();
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [1, 2]);
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["采矿", "自动"]);
  assert.equal(f.cores[0].instVars.优先工作目标X, 3);
  assert.equal(f.auto.IsGroupActive(), false);
  f.save.setAt(100, 28, 10, 0); await f.tick();
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [2, 1]);
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["战斗", "战斗"]);
  assert.equal(f.cores[0].instVars.优先工作目标X, 0);
  assert.deepEqual(f.calls.filter(c => c[0] === "开始灵兽挑战"), [["开始灵兽挑战", 28]]);
  f.victory._RunAndBlock(); await f.tick();
  assert.deepEqual(f.cores.map(c => c.instVars.X坐标), [1, 2]);
  assert.deepEqual(f.cores.map(c => c.instVars.设定状态), ["采矿", "自动"]);
  assert.equal(f.save.getAt(1, 57, 2), 3);
  f.save.setAt(100, 28, 10, 0); await f.tick();
  assert.equal(f.calls.filter(c => c[0] === "开始灵兽挑战").length, 2);
  f.handlers.forest(); assert.equal(f.auto.IsGroupActive(), true);
});
test("Ink Forest never acts on another map, during transitions, pause, battle off, menus, or dragging", async () => {
  for (const block of [f => { f.runtime.globalVars.当前地图编号 = 29; },
    f => { f.runtime.globalVars.游戏暂停 = true; }, f => { f.runtime.globalVars.战斗开关 = false; },
    f => { f.runtime.globalVars.分页界面 = "menu"; }, f => { f.objects.转场云.push({}); },
    f => { f.objects.二级页面背景.push({ instVars: { 功能: "招募" } }); },
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
    f => { f.objects.二级页面背景.push({ instVars: { 功能: "招募" } }); },
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
    f => { f.objects.二级页面背景.push({ instVars: { 功能: "招募" } }); },
    f => { f.runtime.globalVars.爬塔挑战开关 = true; }, f => { f.runtime.layout = null; },
    f => { f.cores[0].behaviors.DragDrop.isDragging = true; }, f => { f.runtime.globalVars.当前地图编号 = 2; }]) {
    const f = fixture(); await f.hold(1); block(f); await f.tap(1);
    assert.equal(f.calls.length, 0);
  }
});
