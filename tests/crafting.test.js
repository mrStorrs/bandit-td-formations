"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const key = "cjs-formations:crafting:v1:12345678";
const settle = () => new Promise(resolve => setImmediate(resolve));
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function fixture(stored = new Map()) {
  let clock = 0;
  const cells = new Map(), notifications = [], calls = [], tiles = [], methods = new Map();
  const save = { width: 64, getAt: (...coords) => cells.get(coords.join()) ?? 0,
    setAt: (value, ...coords) => cells.set(coords.join(), value) };
  const g = { 当前地图编号: 28, 主地图编号起始: 10000, 选中地块X: 44, 选中地块Y: 55, 锻造物品编号: 66 };
  const values = [7, 10, 42];
  const variables = values.map((_, i) => ({ GetValue: () => values[i], SetValue: value => { values[i] = value; } }));
  const groups = new Map(["加入锻造队列function", "生成单体设施function", "锻造材料编号function", "锻造材料数量function"]
    .map(name => [name, { active: true, IsGroupActive() { return this.active; } }]));
  const recipes = { 1: [1, "普通", "装备", 1], 2: [1, "普通", "装备", 2], 16: [1, "普通", "装备", 3], 30: [1, "普通丹药", "丹药", 0] };
  const ss = { getAt: (id, field) => field === 30 ? ({ 21: 4, 31: 5, 41: 6 })[id] : 0 };
  const wp = { getAt: (id, field) => recipes[id]?.[field - 3] ?? 0 };
  const objects = { save: [save], ss: [ss], wp: [wp], 地面: tiles, 二级页面背景: [], 转场云: [], 世界地图: [], 黑幕: [], 设施搬迁拖动点: [] };
  const runtime = { layout: { name: "主界面" }, timeScale: 1, globalVars: g,
    objects: Object.fromEntries(Object.entries(objects).map(([name, items]) => [name, { getAllInstances: () => items, getFirstInstance: () => items[0] }])),
    storage: { getItem: async k => clone(stored.get(k)), setItem: async (k, v) => { stored.set(k, clone(v)); } },
    callFunction(name, ...args) {
      calls.push([name, ...args]);
      const fn = methods.get(name);
      assert.ok(fn, `Unexpected native function ${name}`);
      const previous = fn.params; fn.params = args;
      try { return fn.block._RunAndBlock(); } finally { fn.params = previous; }
    },
  };
  function native(name, body) {
    const fn = { params: [], CaptureFunctionParameters() { return this.params; }, GetEventBlock() { return this.block; } };
    fn.block = { _RunAndBlock: () => body(...fn.params) }; methods.set(name, fn);
  }
  function stationAt(x, y) { return save.getAt(x - g.主地图编号起始 + 150, y - g.主地图编号起始, 6); }
  native("锻造材料编号", (_, index) => index);
  native("锻造材料数量", (_, tier, index, multiplier) => (index === 1 ? 2 : 3) * multiplier);
  native("失去材料", (amount, id) => { if (!f.refusePayment || id === 1) save.setAt(save.getAt(id, 6, 0) - amount, id, 6, 0); });
  native("生成单体设施", () => {});
  native("加入锻造队列", () => {
    if (f.refuseQueue) return;
    values[2] = 0;
    for (let id = 1; id < save.width; id++) if (save.getAt(id, 0, 13) <= 0) {
      [id, g.选中地块X, g.选中地块Y, g.锻造物品编号, 0, 1, values[1], 0, values[0], 0, 1000, 0]
        .forEach((value, field) => save.setAt(value, id, field, 13));
      values[2] = id; break;
    }
  });
  native("取消锻造", (queue, refund) => {
    if (refund) for (let id = 1; id <= 2; id++) save.setAt(save.getAt(id, 6, 0) +
      (id === 1 ? 2 : 3) * save.getAt(queue, 6, 13) * save.getAt(queue, 8, 13), id, 6, 0);
    for (let field = 0; field <= 11; field++) save.setAt(0, queue, field, 13);
  });
  native("取消设施进程", (x, y) => {
    const id = stationAt(x, y), queue = save.getAt(id, 3, 21);
    if (queue > 0) runtime.callFunction("取消锻造", queue, true);
    save.setAt(0, id, 3, 21);
  });
  native("删除地图设施", (x, y, a, b, c, region, d, moving) => {
    const id = stationAt(x, y);
    runtime.callFunction("取消设施进程", x, y, false, 0);
    if (!moving) {
      for (let field = 0; field <= 18; field++) save.setAt(0, id, field, 21);
      save.setAt(0, x - 10000 + 150, y - 10000, 6);
    }
  });
  const engine = { GetMainRunningLayout: () => runtime.layout,
    GetEventSheetManager: () => ({ GetEventVariableBySID: sid => variables[[941173744256037, 351958427913412, 169707249134927].indexOf(sid)],
      GetFunctionBlockByName: name => methods.get(name), GetEventGroupByName: name => groups.get(name) }),
    FlushPendingInstances: () => { f.flushes++; } };
  const sandbox = { BanditFormations: {}, performance: { now: () => clock }, console: { error() {} } };
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync(`${__dirname}/../src/crafting.js`, "utf8"), sandbox);
  const loop = sandbox.BanditFormations.attachCrafting(runtime, engine, text => notifications.push(text));
  save.setAt(12345678, 0, 1, 0);
  for (const id of Object.keys(recipes)) save.setAt(1, Number(id), 19, 0);
  for (let index = 0; index < 3; index++) {
    const id = index + 3, type = [21, 31, 41][index], x = 10020 + index, y = 10010, owner = 6 + index;
    tiles.push({ instVars: { 用途: "主地图", 设施编号: type, X坐标: x, Y坐标: y, 有效解锁: true, 资源类型: "" } });
    [id, type, owner, 0].forEach((value, field) => save.setAt(value, id, field, 21));
    save.setAt(id, x - 10000 + 150, y - 10000, 6); save.setAt(1, owner, 1, 1);
  }
  const f = { save, runtime, engine, g, values, stored, calls, notifications, tiles, objects, methods, groups, flushes: 0,
    balance: () => [save.getAt(1, 6, 0), save.getAt(2, 6, 0)],
    materials(a = 10000, b = a) { save.setAt(a, 1, 6, 0); save.setAt(b, 2, 6, 0); },
    queue(index) { return save.getAt(index + 3, 3, 21); },
    remaining(index) { return save.getAt(this.queue(index), 8, 13); },
    async tick() { clock += 1000; loop.tick(); await settle(); },
    start(index, recipe = [1, 16, 30][index], multiplier = 1, count = 2) {
      const v = tiles[index].instVars;
      Object.assign(g, { 选中地块X: v.X坐标, 选中地块Y: v.Y坐标, 锻造物品编号: recipe });
      values[0] = count; values[1] = multiplier;
      runtime.callFunction("加入锻造队列", false); save.setAt(values[2], index + 3, 3, 21);
    },
    finish(index) {
      const queue = this.queue(index); save.setAt(0, queue, 8, 13);
      runtime.callFunction("取消锻造", queue, false); save.setAt(0, index + 3, 3, 21);
    },
    cancel(index) { const v = tiles[index].instVars; runtime.callFunction("取消设施进程", v.X坐标, v.Y坐标, true, 0); },
  };
  f.materials();
  return f;
}

test("each forging, crafting and alchemy station repeats 10 only after its own queue finishes", async () => {
  const f = fixture(); await f.tick();
  for (let i = 0; i < 3; i++) f.start(i);
  await f.tick(); assert.deepEqual([0, 1, 2].map(i => f.remaining(i)), [2, 2, 2]);
  f.finish(0); await f.tick(); assert.deepEqual([0, 1, 2].map(i => f.remaining(i)), [10, 2, 2]);
  assert.deepEqual(f.balance(), [9980, 9970]);
  f.finish(1); f.finish(2); await f.tick(); assert.deepEqual([0, 1, 2].map(i => f.remaining(i)), [10, 10, 10]);
  f.save.setAt(1, f.queue(0), 8, 13); await f.tick(); assert.equal(f.remaining(0), 1);
  f.finish(0); await f.tick(); assert.equal(f.remaining(0), 10); assert.deepEqual(f.balance(), [9920, 9880]);
  assert.equal(f.flushes, 4); assert.equal(f.notifications.length, 0);
});
test("waits for materials for a full batch, retries automatically, and shares materials safely", async () => {
  const f = fixture(); await f.tick(); f.start(0); f.start(1); f.finish(0); f.finish(1);
  f.materials(20, 29); await f.tick(); assert.equal(f.queue(0), 0); assert.deepEqual(f.balance(), [20, 29]);
  f.materials(20, 30); await f.tick(); assert.equal(f.remaining(0), 10); assert.equal(f.queue(1), 0); assert.deepEqual(f.balance(), [0, 0]);
  f.materials(20, 30); await f.tick(); assert.equal(f.remaining(1), 10); assert.deepEqual(f.balance(), [0, 0]);
  assert.equal(f.notifications.length, 0);
});
test("rechecks the live queue so duplicate tile observations cannot pay twice", async () => {
  const f = fixture(); await f.tick(); f.start(0); f.finish(0); f.tiles.push(f.tiles[0]);
  await f.tick(); assert.equal(f.remaining(0), 10); assert.deepEqual(f.balance(), [9980, 9970]);
});
test("refreshes the selected station's native menu without selecting another station", async () => {
  const f = fixture(); await f.tick(); f.start(0); f.finish(0);
  const menu = { instVars: { 功能: "设施", X坐标: 10020, Y坐标: 10010 } };
  f.runtime.objects.底部菜单背景 = { getAllInstances: () => [menu] };
  f.methods.set("刷新底部菜单", { params: [], block: { _RunAndBlock() {
    assert.equal(f.g.选中地块X, 10020); assert.equal(f.g.选中地块Y, 10010); assert.equal(f.remaining(0), 10);
  } } });
  await f.tick(); assert.equal(f.calls.filter(c => c[0] === "刷新底部菜单").length, 1);
  f.finish(0); menu.instVars.X坐标 = 10021; await f.tick();
  assert.equal(f.calls.filter(c => c[0] === "刷新底部菜单").length, 1); assert.equal(f.notifications.length, 0);
});
test("uses each station's latest submitted recipe and multiplier, without changing UI selections", async () => {
  const f = fixture(); await f.tick(); f.start(0); f.cancel(0); f.start(0, 2, 100); f.finish(0); f.materials();
  Object.assign(f.g, { 选中地块X: 888, 选中地块Y: 777, 锻造物品编号: 16 }); f.values.splice(0, 3, 77, 10, 42);
  await f.tick();
  assert.equal(f.save.getAt(f.queue(0), 3, 13), 2); assert.equal(f.save.getAt(f.queue(0), 6, 13), 100);
  assert.deepEqual(f.balance(), [8000, 7000]);
  assert.deepEqual([f.g.选中地块X, f.g.选中地块Y, f.g.锻造物品编号, ...f.values], [888, 777, 16, 77, 10, 42]);
});
test("learns existing queues and persists the last recipe across a restart and map changes", async () => {
  const f = fixture(); f.start(0, 2, 10); await f.tick(); f.finish(0); await settle();
  assert.equal(f.stored.get(key).stations[0].recipe, 2);
  const next = fixture(f.stored); next.g.当前地图编号 = 1; await next.tick(); await next.tick();
  assert.equal(next.remaining(0), 10); assert.equal(next.save.getAt(next.queue(0), 3, 13), 2);
  assert.deepEqual(next.balance(), [9800, 9700]); assert.equal(next.queue(1), 0);
});
test("cancelling even an idle waiting station stops repeat until another recipe is started", async () => {
  const f = fixture(); await f.tick(); f.start(0); f.cancel(0); await f.tick(); assert.equal(f.queue(0), 0);
  f.start(0); f.finish(0); f.materials(0); await f.tick(); f.cancel(0); f.materials(); await f.tick();
  assert.equal(f.queue(0), 0); assert.deepEqual(f.stored.get(key).stations, []);
  f.start(0, 2); f.finish(0); await f.tick(); assert.equal(f.remaining(0), 10);
});
test("deleting a station forgets it even when the slot and type are reused", async () => {
  const f = fixture(); await f.tick(); f.start(0); f.finish(0); await settle();
  f.runtime.callFunction("删除地图设施", 10020, 10010, 0, 0, 0, "山寨", 0, false);
  [3, 21, 6, 0].forEach((v, field) => f.save.setAt(v, 3, field, 21)); f.save.setAt(3, 170, 10, 6);
  await f.tick(); assert.equal(f.queue(0), 0); assert.deepEqual(f.stored.get(key).stations, []);
});
test("moving a station retains its recipe while native movement cancels and refunds its old work", async () => {
  const f = fixture(); await f.tick(); f.start(0, 2); f.runtime.callFunction("删除地图设施", 10020, 10010, 0, 0, 0, "山寨", 0, true);
  f.save.setAt(0, 170, 10, 6); f.save.setAt(3, 180, 10, 6); f.tiles[0].instVars.X坐标 = 10030;
  await f.tick(); assert.equal(f.remaining(0), 10); assert.equal(f.save.getAt(f.queue(0), 1, 13), 10030);
  assert.equal(f.save.getAt(f.queue(0), 3, 13), 2);
});
test("pause, menus, transitions, invalid facilities, and inactive native groups prevent spending", async () => {
  const blocks = [f => { f.g.游戏暂停 = true; }, f => { f.runtime.timeScale = 0; }, f => { f.runtime.layout.name = "开始界面"; },
    f => f.objects.二级页面背景.push({}), f => f.objects.转场云.push({}), f => f.objects.世界地图.push({}),
    f => f.objects.黑幕.push({ isVisible: true }), f => f.objects.设施搬迁拖动点.push({}),
    f => { f.tiles[0].instVars.资源类型 = "失效"; }, f => { f.tiles[0].instVars.资源类型 = "满仓"; },
    f => { f.tiles[0].instVars.有效解锁 = false; }, f => f.save.setAt(20, 6, 4, 1),
    f => { f.groups.get("加入锻造队列function").active = false; }];
  for (const block of blocks) {
    const f = fixture(); await f.tick(); f.start(0); f.finish(0); block(f); await f.tick();
    assert.equal(f.queue(0), 0); assert.deepEqual(f.balance(), [10000, 10000]);
  }
});
test("campaigns never inherit another save's recipes, including a pending storage read", async () => {
  const f = fixture(new Map([[key, { version: 1, stations: [{ id: 3, type: 21, owner: 6, recipe: 1, multiplier: 1 }] }]]));
  let resolve; const read = f.runtime.storage.getItem;
  f.runtime.storage.getItem = k => k === key ? new Promise(r => { resolve = r; }) : read(k);
  await f.tick(); f.save.setAt(87654321, 0, 1, 0); resolve(f.stored.get(key)); await f.tick(); await f.tick();
  assert.equal(f.queue(0), 0); assert.deepEqual(f.balance(), [10000, 10000]);
  f.save.setAt(12345678, 0, 1, 0); await f.tick(); assert.equal(f.remaining(0), 10);
});
test("new selections and cancellations override an older pending storage read", async () => {
  for (const cancel of [true, false]) {
    const f = fixture(); let resolve;
    f.runtime.storage.getItem = () => new Promise(r => { resolve = r; }); await f.tick();
    f.start(0, 2, 10); if (cancel) f.cancel(0); else f.finish(0);
    resolve({ version: 1, stations: [{ id: 3, type: 21, owner: 6, recipe: 1, multiplier: 1 }] });
    await settle(); await f.tick();
    if (cancel) { assert.equal(f.queue(0), 0); assert.deepEqual(f.stored.get(key).stations, []); }
    else { assert.equal(f.save.getAt(f.queue(0), 3, 13), 2); assert.equal(f.save.getAt(f.queue(0), 6, 13), 10); }
  }
});
test("unknown recipes, malformed preferences, changed facilities and full queues do not spend", async () => {
  const entry = { id: 3, type: 21, owner: 6, recipe: 1, multiplier: 1 };
  for (const change of [{ recipe: 999 }, { recipe: 16 }, { multiplier: -1 }, { multiplier: 1000 }, { owner: 99 }, { type: 41 }]) {
    const f = fixture(new Map([[key, { version: 1, stations: [{ ...entry, ...change }] }]])); await f.tick(); await f.tick();
    assert.equal(f.queue(0), 0); assert.deepEqual(f.balance(), [10000, 10000]);
  }
  for (const block of [f => f.save.setAt(0, 1, 19, 0), f => { for (let id = 1; id < f.save.width; id++) f.save.setAt(id, id, 0, 13); },
    f => f.save.setAt(55, 3, 3, 21), f => { f.materials(NaN); }]) {
    const f = fixture(); await f.tick(); f.start(0); f.finish(0); block(f); f.calls.length = 0; await f.tick();
    assert.equal(f.calls.filter(c => c[0] === "失去材料" || c[0] === "加入锻造队列").length, 0);
  }
});
test("queue or payment refusal rolls back the attempt and stops rather than retrying charges", async () => {
  for (const failure of ["refuseQueue", "refusePayment"]) {
    const f = fixture(); await f.tick(); f.start(0); f.finish(0); f[failure] = true; const values = [...f.values];
    await f.tick(); await f.tick(); assert.equal(f.queue(0), 0); assert.equal(f.save.getAt(1, 0, 13), 0);
    assert.deepEqual(f.balance(), [10000, 10000]); assert.deepEqual(f.values, values);
    assert.equal(f.notifications.length, 1); assert.match(f.notifications[0], /Auto crafting stopped.*refused/);
  }
});
test("storage failures stop automation visibly without breaking native crafting", async () => {
  for (const method of ["getItem", "setItem"]) {
    const f = fixture(); f.runtime.storage[method] = async () => { throw new Error("Storage unavailable"); };
    await f.tick(); f.start(0); await settle(); f.finish(0); await f.tick();
    assert.equal(f.queue(0), 0); assert.deepEqual(f.balance(), [10000, 10000]);
    assert.equal(f.notifications.length, 1); assert.match(f.notifications[0], /Storage unavailable/);
    f.start(1); assert.equal(f.remaining(1), 2);
  }
});
