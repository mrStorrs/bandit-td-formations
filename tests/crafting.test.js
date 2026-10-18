"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const key = "cjs-formations:crafting:v1:12345678";
const settle = () => new Promise(resolve => setImmediate(resolve));
const { fixture } = require("./helpers/crafting-fixture");


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
test("Soul Tower's movement lock does not stop forging, crafting or brewing refills", async () => {
  const f = fixture(); f.g.当前地图编号 = 40; f.g.爬塔挑战开关 = true; await f.tick();
  for (let i = 0; i < 3; i++) { f.start(i); f.finish(i); }
  await f.tick();
  assert.deepEqual([0, 1, 2].map(i => f.remaining(i)), [10, 10, 10]);
  assert.deepEqual(f.balance(), [9940, 9910]);
  assert.equal(f.g.爬塔挑战开关, true); assert.equal(f.notifications.length, 0);
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
    f => { f.tiles[0].instVars.有效解锁 = false; }, f => f.save.setAt(0, 6, 1, 1),
    f => { f.groups.get("加入锻造队列function").active = false; }];
  for (const block of blocks) {
    const f = fixture(); await f.tick(); f.start(0); f.finish(0); block(f); await f.tick();
    assert.equal(f.queue(0), 0); assert.deepEqual(f.balance(), [10000, 10000]);
  }
});
test("unlocked forge, crafting and brewery benches repeat while their parent buildings upgrade", async () => {
  const f = fixture(); await f.tick();
  for (let index = 0; index < 3; index++) {
    f.start(index); f.finish(index); f.save.setAt(1500000, 6 + index, 4, 1);
  }
  await f.tick();
  for (let index = 0; index < 3; index++) {
    assert.equal(f.remaining(index), 10);
    assert.equal(f.save.getAt(6 + index, 4, 1), 1500000);
  }
  assert.deepEqual(f.balance(), [9940, 9910]);
  for (let index = 0; index < 3; index++) {
    f.finish(index); f.tiles[index].instVars.有效解锁 = false;
  }
  await f.tick();
  assert.deepEqual([f.queue(0), f.queue(1), f.queue(2)], [0, 0, 0]);
  assert.deepEqual(f.balance(), [9940, 9910]);
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
    f.runtime.storage.getItem = k => k === key ? new Promise(r => { resolve = r; }) : Promise.resolve(null); await f.tick();
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
    const f = fixture(); f.runtime.storage[method] = async k => { if (k === key) throw new Error("Storage unavailable"); };
    await f.tick(); f.start(0); await settle(); f.finish(0); await f.tick();
    assert.equal(f.queue(0), 0); assert.deepEqual(f.balance(), [10000, 10000]);
    assert.equal(f.notifications.length, 1); assert.match(f.notifications[0], /Storage unavailable/);
    f.start(1); assert.equal(f.remaining(1), 2);
  }
});
