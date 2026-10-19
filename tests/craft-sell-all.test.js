"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers/crafting-fixture");
const key = "cjs-formations:craft-stations:v1:12345678";
const saved = (f, id = 3) => f.stored.get(key).stations.find(s => s.id === id);
const toggle = (f, sellAll) => f.handlers["craft-output"]({ token: f.status().token, keepLimit: sellAll ? 0 : null });
const bag = f => Array.from({ length: f.save.width - 1 }, (_, i) => i + 1).filter(row => f.save.getAt(row, 1, 7) > 0);
async function ready() { const f = fixture(new Map(), true); await f.tick(); await f.tick(); return f; }

test("sell-all defaults off and sells matching and nonmatching Auto-all results when enabled live", async () => {
  const f = await ready(); assert.equal(f.status().options.keepLimit, null);
  await f.configure({ loop: "forge", autoSell: false }); await f.tick();
  const queue = f.queue(0), money = f.save.getAt(1, 2, 0); await toggle(f, true);
  f.complete(0, [59], 6); f.complete(0, [72], 1);
  assert.deepEqual(bag(f), []); assert.equal(f.save.getAt(1, 2, 0), money + 246);
  assert.equal(f.queue(0), queue); assert.equal(f.remaining(0), 8);
  await f.tick(); assert.equal(f.status().sold, 2); assert.equal(f.status().kept, 0);
  assert.equal(saved(f).options.autoSell, false); assert.equal(saved(f).options.keepLimit, 0);
});

test("Repeat sells every result from its manual queue and subsequent automatic batches", async () => {
  for (const index of [0, 1]) {
    const f = await ready(); await f.select(index); f.start(index, index === 0 ? 2 : 19);
    await toggle(f, true); f.save.setAt(6, 9, 1, 0);
    for (let n = 0; n < 2; n++) f.complete(index, [59], 6);
    await f.tick(); assert.equal(f.remaining(index), 10);
    for (let n = 0; n < 10; n++) f.complete(index, [72], 1);
    assert.deepEqual(bag(f), []); assert.equal(f.save.getAt(1, 2, 0), 12 * 123);
    await f.tick(); assert.equal(f.remaining(index), 10); assert.equal(f.status().sold, 12);
  }
});

test("stations keep separate sell-all settings even when two forges craft the same recipe", async () => {
  const f = await ready(), x = 10040, y = 10010;
  f.tiles.push({ uid: 300, instVars: { 用途: "主地图", 设施编号: 21, X坐标: x, Y坐标: y, 有效解锁: true, 资源类型: "" } });
  [10, 21, 6, 0].forEach((value, field) => f.save.setAt(value, 10, field, 21)); f.save.setAt(10, x - 10000 + 150, y - 10000, 6);
  await f.configureAll({ loop: "forge", autoSell: false }); await f.tick(); await toggle(f, true);
  f.complete(0, [59], 6); f.complete(3, [59], 6); f.complete(1, [59], 6);
  assert.equal(bag(f).length, 2); assert.ok(bag(f).every(row => f.save.getAt(row, 22, 7) === 1));
  assert.equal(f.save.getAt(1, 2, 0), 123); assert.equal(saved(f, 10).options.keepLimit, null);
  await f.select(3); assert.equal(f.status().options.keepLimit, null); assert.equal(f.status().sold, 0);
});

test("existing bag items, equipped gear and unrelated drops are never swept into station sales", async () => {
  const f = await ready();
  f.runtime.callFunction("获得物品", true, 2, 6, 1, 1, 200, 1, false, 0, "特定装备", false);
  f.save.setAt(1, 1, 22, 7);
  f.runtime.callFunction("获得物品", true, 2, 1, 1, 1, 200, 1, false, 0, "特定装备", false);
  f.save.setAt(2, 1, 1, 9); f.save.setAt(1, 1, 7, 9);
  const before = [1, 2].map(row => Array.from({ length: 50 }, (_, field) => f.save.getAt(row, field, 7)));
  await toggle(f, true); f.start(0, 2); f.complete(0, [59], 6);
  assert.deepEqual([1, 2].map(row => Array.from({ length: 50 }, (_, field) => f.save.getAt(row, field, 7))), before);
  assert.equal(f.save.getAt(1, 1, 9), 2); assert.equal(f.save.getAt(1, 7, 9), 1);
  f.runtime.callFunction("获得物品", true, 2, 6, 1, 1, 200, 1, false, 0, "特定装备", false);
  assert.equal(bag(f).length, 3); assert.equal(f.save.getAt(1, 2, 0), 123);
});

test("turning sell-all off restores matching protection and the saved reject-selling preference", async () => {
  for (const autoSell of [false, true]) {
    const f = await ready(); await f.configure({ loop: "forge", autoSell, keepLimit: 0 }); await f.tick();
    f.complete(0, [59]); await toggle(f, false); f.complete(0, [59]); f.complete(0, [72]);
    assert.equal(f.save.getAt(1, 22, 7), 1); assert.equal(bag(f).length, autoSell ? 1 : 2);
    assert.equal(f.save.getAt(1, 2, 0), (autoSell ? 2 : 1) * 123);
  }
});

test("pausing automation stops sell-all without canceling paid work", async () => {
  for (const mode of ["repeat", "sets"]) {
    const f = await ready(); if (mode === "repeat") f.start(0, 2);
    await f.configure({ mode, loop: "forge", keepLimit: 0 }); await f.tick();
    const queue = f.queue(0); await f.handlers["craft-pause"]({ token: f.status().token });
    f.complete(0, [72]); assert.equal(f.save.getAt(1, 2, 0), 0); assert.equal(bag(f).length, 1); assert.equal(f.queue(0), queue);
  }
});

test("explicit sell-all persists across reload and handles the remaining crafts in existing queues", async () => {
  const f = await ready(); await toggle(f, true); f.start(0, 2);
  f.loop.leave(); f.complete(0, [59], 6); assert.equal(f.save.getAt(1, 2, 0), 123);
  const next = fixture(f.stored, true); next.start(0, 2); await next.tick(); await next.tick();
  assert.equal(next.status().options.keepLimit, 0); next.complete(0, [59], 6);
  assert.equal(next.save.getAt(1, 2, 0), 123); assert.deepEqual(bag(next), []);
});

test("sale failures keep the item and stop the station without retrying the old item", async () => {
  for (const block of [f => { f.refuseSale = true; }, f => { f.groups.get("失去物品function").active = false; }]) {
    const f = await ready(); f.start(0, 2); await toggle(f, true); block(f); f.complete(0, [59], 6);
    await f.tick(); await f.tick(); assert.equal(bag(f).length, 1); assert.equal(f.status().enabled, false);
    assert.equal(f.save.getAt(1, 2, 0), 0); assert.equal(f.notifications.length, 1);
  }
});

test("stale actions, breweries and reused station IDs cannot inherit sell-all", async () => {
  const f = await ready(), token = f.status().token; await f.select(1);
  await f.handlers["craft-output"]({ token, keepLimit: 0 }); assert.equal(saved(f, 3).options.keepLimit, null);
  await f.select(2); await toggle(f, true); assert.equal(saved(f, 5).options.keepLimit, null);
  await f.select(0); await toggle(f, true);
  f.save.setAt(9, 3, 2, 21); f.save.setAt(1, 9, 1, 1); await f.tick();
  assert.equal(f.status().options.keepLimit, null); assert.equal(saved(f).owner, 9);
});

test("a failed settings write cannot start destructive selling", async () => {
  const f = await ready(); f.start(0, 2);
  f.runtime.storage.setItem = async () => { throw Error("disk unavailable"); };
  await toggle(f, true); f.complete(0, [59], 6);
  assert.equal(f.save.getAt(1, 2, 0), 0); assert.equal(bag(f).length, 1); assert.equal(f.status().enabled, false);
});
