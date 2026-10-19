"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture() {
  const cells = new Map(), messages = [], cores = [], tiles = [], listeners = new Map();
  const save = { uid: 1, getAt: (...p) => cells.get(p.join()) ?? 0, setAt: (v, ...p) => cells.set(p.join(), v) };
  save.setAt(12345678, 0, 1, 0);
  const objects = { save: [save], 角色核心: cores, 地面: tiles };
  const runtime = { layout: { name: "主界面" }, globalVars: { 主地图编号起始: 10000, 当前地图编号: 28 },
    objects: Object.fromEntries(Object.entries(objects).map(([name, array]) => [name, { getFirstInstance: () => array[0], getAllInstances: () => array }])) };
  let character = 1;
  const block = { _RunAndBlock() { cores.find(c => c.instVars.角色序号 === character).behaviors.生产炮台.currentTarget = tiles[0]; } };
  const fn = { CaptureFunctionParameters: () => [character], GetEventBlock: () => block };
  const engine = { GetMainRunningLayout: () => runtime.layout, GetEventSheetManager: () => ({ GetFunctionBlockByName: () => fn }) };
  const sandbox = { BanditFormations: {}, console: { error() {} } }; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${__dirname}/../src/gathering.js`, "utf8"), sandbox);
  const mod = sandbox.BanditFormations.attachGathering(runtime, engine, text => messages.push(text));
  function worker(job = "采矿", x = 0) {
    const id = cores.length + 1, handlers = {};
    const turret = { isEnabled: true, range: 200, currentTarget: null,
      addEventListener: (event, cb) => { assert.equal(handlers[event], undefined); handlers[event] = cb; } };
    const core = { uid: 100 + id, x, y: 0, instVars: { 角色序号: id, 执行状态: job, 设定状态: job,
      X坐标: 10000 + x / 100, Y坐标: 10000, 优先工作目标X: 10001, 优先工作目标Y: 10000 },
      behaviors: { 生产炮台: turret, DragDrop: { isDragging: false } } };
    cores.push(core); listeners.set(core, handlers); return core;
  }
  function resource(remaining, { job = "采矿", x = 100, facility = true } = {}) {
    const id = tiles.length + 1, v = { 用途: "主地图", 区域: "山寨", 有效解锁: true, 资源类型: job,
      X坐标: 10000 + id, Y坐标: 10000, 设施编号: facility ? 71 : 0, 材料编号: facility ? 0 : 11, 城墙标识: 0 };
    const tile = { uid: 200 + id, x, y: 0, instVars: v }; tiles.push(tile);
    if (facility) {
      save.setAt(id, id + 150, 0, 6); save.setAt(id, id, 0, 21); save.setAt(71, id, 1, 21); save.setAt(11, id, 3, 21);
    }
    tile.health = value => facility ? save.setAt(value, id, 4, 21) : save.setAt(value, id + 100, 0, 6);
    tile.health(remaining); return tile;
  }
  return { runtime, save, mod, messages, cores, tiles, worker, resource,
    target: core => core.behaviors.生产炮台.currentTarget,
    shoot: core => listeners.get(core).shoot(),
    ai: core => { character = core.instVars.角色序号; block._RunAndBlock(); } };
}

test("gatherers focus the same weakest resource, keep it, then move to the next weakest", () => {
  const f = fixture(), workers = [f.worker(), f.worker()], a = f.resource(50), b = f.resource(20), c = f.resource(30);
  f.mod.tick(); assert.ok(workers.every(w => f.target(w) === b));
  a.health(1); f.mod.tick(); assert.ok(workers.every(w => f.target(w) === b), "finish the selected resource first");
  b.health(0); f.mod.tick(); assert.ok(workers.every(w => f.target(w) === a));
  a.health(0); f.mod.tick(); assert.ok(workers.every(w => f.target(w) === c));
  c.health(0); f.mod.tick(); assert.ok(workers.every(w => f.target(w) === null));
  assert.deepEqual(f.messages, []);
});
test("each gathering profession selects only reachable, unlocked, live resources", () => {
  const f = fixture(), miner = f.worker(), logger = f.worker("伐木"), planter = f.worker("种植");
  f.resource(1, { x: 201 }); f.resource(0); f.resource(1).instVars.有效解锁 = false;
  f.resource(1).instVars.区域 = "战斗"; f.resource(1).instVars.用途 = "预览";
  const mine = f.resource(30), tree = f.resource(10, { job: "伐木", facility: false }), herb = f.resource(20, { job: "种植" });
  f.mod.tick(); assert.equal(f.target(miner), mine); assert.equal(f.target(logger), tree); assert.equal(f.target(planter), herb);
  assert.equal(miner.instVars.优先工作目标X, 10001, "do not rewrite saved manual work priorities");
});
test("native AI refreshes cannot scatter gatherers and shooting rechecks same-tick depletion", () => {
  const f = fixture(), a = f.resource(80), b = f.resource(1), w = f.worker();
  f.mod.tick(); f.ai(w); assert.equal(f.target(w), b);
  b.health(0); f.shoot(w); assert.equal(f.target(w), a);
  f.mod.tick(); f.mod.tick(); assert.deepEqual(f.messages, []);
});
test("ties select consistently, including workers created after hooks install", () => {
  const f = fixture(), a = f.resource(20), b = f.resource(20), w = f.worker();
  f.tiles.reverse(); f.mod.tick(); assert.equal(f.target(w), a);
  const late = f.worker(); f.mod.tick(); assert.equal(f.target(late), a);
  a.instVars.资源类型 = ""; f.mod.tick(); assert.equal(f.target(w), b); assert.equal(f.target(late), b);
});
test("a third gatherer joins the shared focus when a weaker plot becomes available", () => {
  for (const job of ["伐木", "采矿", "种植"]) {
    const f = fixture(), workers = [f.worker(job), f.worker(job)], a = f.resource(20, { job }), b = f.resource(1, { job });
    b.instVars.资源类型 = "";
    f.mod.tick(); assert.ok(workers.every(w => f.target(w) === a));
    b.instVars.资源类型 = job;
    workers.push(f.worker(job)); f.mod.tick();
    assert.ok(workers.every(w => f.target(w) === a), "joining workers must finish the group's existing target");
    a.health(0); f.shoot(workers[0]); f.shoot(workers[1]); f.shoot(workers[2]);
    assert.ok(workers.every(w => f.target(w) === b));
  }
});
test("overlapping work ranges share an existing target while unreachable workers keep working locally", () => {
  const f = fixture(), a = f.resource(20, { x: 0 }), b = f.resource(1, { x: 400 });
  const left = f.worker("采矿", 0), right = f.worker("采矿", 400);
  f.mod.tick(); assert.equal(f.target(left), a); assert.equal(f.target(right), b);
  const middle = f.worker("采矿", 200); f.mod.tick();
  assert.equal(f.target(middle), a, "join the earliest reachable active focus");
  assert.equal(f.target(right), b, "never target a resource outside work range");
  a.health(0); f.shoot(left); f.shoot(middle); f.mod.tick();
  assert.equal(f.target(left), null); assert.equal(f.target(middle), b); assert.equal(f.target(right), b);
});
test("stale or unreachable peer assignments cannot hold a new worker on an old target", () => {
  for (const change of [
    (f, w) => { w.instVars.执行状态 = "战斗"; },
    (f, w) => { w.instVars.X坐标++; },
    (f, w) => { w.behaviors.生产炮台.isEnabled = false; },
    (f, w) => { w.behaviors.DragDrop.isDragging = true; },
    (f, w) => { w.x = 1000; },
    (f, w) => { f.cores.splice(f.cores.indexOf(w), 1); },
  ]) {
    const f = fixture(), early = f.worker(), a = f.resource(20), b = f.resource(30);
    f.mod.tick(); assert.equal(f.target(early), a);
    b.health(1); change(f, early);
    const late = f.worker(); f.mod.tick(); assert.equal(f.target(late), b);
  }
});
test("merging groups converges on the earlier active target without changing jobs or priorities", () => {
  const f = fixture(), a = f.resource(20, { x: 0 }), b = f.resource(10, { x: 400 });
  const first = f.worker("采矿", 0), second = f.worker("采矿", 400), third = f.worker("采矿", 400);
  f.mod.tick(); assert.equal(f.target(first), a); assert.equal(f.target(second), b); assert.equal(f.target(third), b);
  for (const w of [second, third]) w.behaviors.生产炮台.range = 500;
  f.mod.tick(); assert.ok([first, second, third].every(w => f.target(w) === a));
  assert.ok([first, second, third].every(w => w.instVars.优先工作目标X === 10001 && w.instVars.设定状态 === "采矿"));
});
test("range changes, regrowth, resource changes and worker moves release stale focus", () => {
  for (const change of [
    (f, w, a) => { a.x = 500; },
    (f, w, a) => { a.health(100); },
    (f, w, a) => { f.save.setAt(12, 1, 3, 21); },
    (f, w) => { w.instVars.X坐标++; },
  ]) {
    const f = fixture(), w = f.worker(), a = f.resource(20), b = f.resource(30);
    f.mod.tick(); assert.equal(f.target(w), a); b.health(1); change(f, w, a); f.mod.tick(); assert.equal(f.target(w), b);
  }
});
test("automatic workers focus gathering without interfering with combat or other jobs", () => {
  const f = fixture(), w = f.worker(), a = f.resource(20), b = f.resource(40);
  w.instVars.设定状态 = "自动"; f.mod.tick(); assert.equal(f.target(w), a);
  for (const job of ["战斗", "休息", "锻造", "工艺", "炼丹", "研究", "操练", "建造"]) {
    w.instVars.执行状态 = job; w.behaviors.生产炮台.currentTarget = b;
    f.mod.tick(); assert.equal(f.target(w), b);
  }
});
test("breakthrough, dragging, disabled workers and wall workers retain native targeting", () => {
  for (const change of [w => { w.instVars.特殊状态 = "突破"; }, w => { w.behaviors.DragDrop.isDragging = true; },
    w => { w.behaviors.生产炮台.isEnabled = false; }, w => { w.instVars.X坐标 = 20000; }]) {
    const f = fixture(), w = f.worker(); f.resource(10); change(w); f.mod.tick(); assert.equal(f.target(w), null);
  }
});
test("campaign, map and layout changes drop remembered focus", () => {
  for (const change of [f => f.save.setAt(87654321, 0, 1, 0), f => { f.runtime.globalVars.当前地图编号++; }, f => f.mod.leave()]) {
    const f = fixture(), w = f.worker(), a = f.resource(20), b = f.resource(30);
    f.mod.tick(); b.health(1); change(f); f.mod.tick(); assert.equal(f.target(w), b);
  }
});
