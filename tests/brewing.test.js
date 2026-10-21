"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { fixture } = require("./helpers/crafting-fixture");
const key = "cjs-formations:craft-stations:v1:12345678";
const types = ["力量丹", "敏捷丹", "智力丹"];
const sandbox = { BanditFormations: {} };
vm.runInNewContext(fs.readFileSync(`${__dirname}/../src/brewing.js`, "utf8"), sandbox);
const { brewingTargets } = sandbox.BanditFormations;

function brewery(stored = new Map()) {
  const f = fixture(stored, true), materials = new Map();
  f.cl = { width: 300, getAt: (id, field) => materials.get(id)?.[field] ?? 0 };
  f.runtime.objects.cl = { getFirstInstance: () => f.cl };
  for (let realm = 1; realm <= 9; realm++) for (let stat = 0; stat < 3; stat++) {
    const recipe = 30 + (realm - 1) * 3 + stat;
    f.catalog[recipe] = { 3: realm, 4: "普通丹药", 5: "丹药", 7: types[stat] };
    f.save.setAt(realm <= 2 ? 1 : 0, recipe, 19, 0);
    for (let rarity = 1; rarity <= 6; rarity++) {
      const id = 100 + (recipe - 30) * 6 + rarity - 1;
      materials.set(id, { 2: realm, 3: types[stat], 5: "丹药", 6: rarity });
    }
  }
  f.stock = (recipe, counts) => {
    for (let i = 0; i < 6; i++) f.save.setAt(counts[i] ?? 0, 100 + (recipe - 30) * 6 + i, 6, 0);
  };
  f.recipe = index => f.save.getAt(f.queue(index), 3, 13);
  f.plan = () => brewingTargets(f.save, f.wp, f.cl);
  f.materialCatalog = materials;
  const gain = f.methods.get("获得物品"), original = gain.block._RunAndBlock;
  gain.block._RunAndBlock = () => {
    const [, recipe, rarity, , , , count] = gain.params;
    if (f.wp.getAt(recipe, 5) !== "丹药") return original();
    const material = 100 + (recipe - 30) * 6 + rarity - 1;
    f.save.setAt(f.save.getAt(material, 6, 0) + count, material, 6, 0);
  };
  f.enable = async changes => { await f.tick(); await f.select(2); await f.configure({ mode: "brew", ...changes }); };
  return f;
}

test("pill totals sum every rarity and separate STR/AGI/INT in every realm", () => {
  const f = brewery();
  for (let recipe = 30; recipe <= 56; recipe++) {
    f.save.setAt(1, recipe, 19, 0);
    f.stock(recipe, [1, 2, 3, 4, 5, 6 + recipe]);
  }
  const plan = f.plan();
  assert.equal(plan.length, 27);
  for (const target of plan) {
    assert.equal(target.stock, 21 + target.recipe);
    assert.equal(target.realm, Math.floor((target.recipe - 30) / 3) + 1);
    assert.equal(target.name, ["STR", "AGI", "INT"][(target.recipe - 30) % 3]);
  }
  f.stock(30, [0, 0, 0, 0, 0, 100]); f.stock(33, [4]);
  assert.equal(f.plan()[0].recipe, 33, "same type in another realm remains a separate shortage");
});

test("only unlocked ordinary pill recipes participate; ties use realm then stat", () => {
  const f = brewery();
  f.catalog[60] = { 3: 1, 4: "宝物", 5: "丹药", 7: types[0] }; f.save.setAt(1, 60, 19, 0);
  f.catalog[61] = { 3: 1, 4: "普通丹药", 5: "丹药", 7: "other" }; f.save.setAt(1, 61, 19, 0);
  f.materialCatalog.set(299, { 2: 1, 3: types[0], 5: "材料" }); f.save.setAt(999, 299, 6, 0);
  assert.deepEqual(Array.from(f.plan(), p => [p.recipe, p.stock]), [30, 31, 32, 33, 34, 35].map(r => [r, 0]));
  f.save.setAt(0, 30, 19, 0); assert.equal(f.plan()[0].recipe, 31);
  for (let recipe = 31; recipe <= 35; recipe++) f.save.setAt(0, recipe, 19, 0);
  assert.equal(f.plan().length, 0);
});

test("unreadable or invalid pill stock stops selection instead of pretending it is zero", () => {
  const f = brewery();
  assert.throws(() => brewingTargets(f.save, f.wp, null), /stock is unavailable/);
  for (const value of [NaN, Infinity, -1]) { f.stock(30, [value]); assert.throws(f.plan, /could not be counted/); }
});

test("auto brewer queues ten of lowest total, waits for the entire batch, then recalculates", async () => {
  const f = brewery();
  for (let recipe = 30; recipe <= 35; recipe++) f.stock(recipe, [20]);
  f.stock(30, [3, 0, 0, 0, 0, 7]); f.stock(34, [9]);
  await f.enable(); const balances = f.balance(); await f.tick();
  assert.equal(f.recipe(2), 34); assert.equal(f.remaining(2), 10);
  assert.deepEqual(f.balance(), [balances[0] - 20, balances[1] - 30]);
  const queue = f.queue(2); f.complete(2, [], 6); await f.tick();
  assert.equal(f.queue(2), queue); assert.equal(f.remaining(2), 9); assert.match(f.status().message, /9 crafts left/);
  for (let i = 0; i < 9; i++) f.complete(2, [], i % 6 + 1);
  await f.tick(); assert.equal(f.recipe(2), 30); assert.equal(f.remaining(2), 10);
  assert.equal(f.plan().find(p => p.recipe === 34).stock, 19);
  assert.equal(f.calls.filter(c => c[0] === "出售物品").length, 0);
});

test("consumed pills and newly unlocked realms affect the next automatic pass", async () => {
  const f = brewery(); await f.enable(); await f.tick();
  for (let recipe = 30; recipe <= 35; recipe++) f.stock(recipe, [50]);
  f.stock(32, [2]); f.finish(2); await f.tick(); assert.equal(f.recipe(2), 32);
  f.save.setAt(1, 36, 19, 0); f.finish(2); await f.tick(); assert.equal(f.recipe(2), 36);
  assert.equal(f.save.getAt(f.queue(2), 5, 13), 3);
});

test("material shortages wait on the lowest stock; full ten-craft multiplier costs are charged once", async () => {
  const f = brewery(); await f.enable({ multiplier: 10 }); f.materials(199, 300);
  await f.tick(); assert.equal(f.queue(2), 0); assert.match(f.status().message, /Waiting for materials/);
  assert.deepEqual(f.balance(), [199, 300]);
  f.materials(200, 300); await f.tick(); assert.equal(f.remaining(2), 10);
  assert.equal(f.save.getAt(f.queue(2), 6, 13), 10); assert.deepEqual(f.balance(), [0, 0]);
  await f.tick(); assert.deepEqual(f.balance(), [0, 0]);
});

test("breweries choose independently, including the same recipe, and pause locally", async () => {
  const f = brewery();
  f.tiles[1].instVars.设施编号 = 41; f.save.setAt(41, 4, 1, 21);
  await f.enable(); await f.select(1); await f.configure({ mode: "brew" }); await f.tick();
  assert.equal(f.recipe(1), 30); assert.equal(f.recipe(2), 30);
  assert.equal(f.remaining(1), 10); assert.equal(f.remaining(2), 10);
  await f.handlers["craft-pause"]({ token: f.status().token });
  f.finish(1); f.finish(2); await f.tick();
  assert.equal(f.queue(1), 0); assert.equal(f.remaining(2), 10);
  assert.deepEqual(f.stored.get(key).stations.filter(s => s.type === 41).map(s => s.enabled), [false, true]);
});

test("manual brewery orders and Cancel pause auto brewer; Apply resumes after the paid queue", async () => {
  const f = brewery(); await f.enable(); f.start(2, 32, 100, 2); await f.tick();
  assert.equal(f.status().enabled, false); assert.equal(f.recipe(2), 32);
  f.finish(2); await f.tick(); assert.equal(f.queue(2), 0);
  await f.configure({ mode: "brew" }); await f.tick(); assert.equal(f.remaining(2), 10);
  f.cancel(2); await f.tick(); assert.equal(f.queue(2), 0); assert.equal(f.status().enabled, false);
  f.start(2, 31, 1, 3); await f.configure({ mode: "brew" }); await f.tick();
  assert.equal(f.recipe(2), 31); assert.equal(f.remaining(2), 3);
  f.finish(2); await f.tick(); assert.equal(f.recipe(2), 30); assert.equal(f.remaining(2), 10);
});

test("switching back to Repeat restores the remembered manual recipe, not the last auto pill", async () => {
  const f = brewery(); await f.tick(); f.start(2, 32, 10, 1); await f.enable();
  f.finish(2); await f.tick(); assert.equal(f.recipe(2), 30);
  await f.configure({ mode: "repeat" }); f.finish(2); await f.tick();
  assert.equal(f.recipe(2), 32); assert.equal(f.save.getAt(f.queue(2), 6, 13), 10);
});

test("brewery settings and pause survive reload; moving preserves them and demolition resets them", async () => {
  const f = brewery(); await f.enable({ multiplier: 10 }); await f.tick();
  const v = f.tiles[2].instVars, x = v.X坐标;
  f.runtime.callFunction("删除地图设施", x, v.Y坐标, false, false, false, 0, false, true);
  f.save.setAt(0, x - 10000 + 150, v.Y坐标 - 10000, 6); v.X坐标 += 5;
  f.save.setAt(5, v.X坐标 - 10000 + 150, v.Y坐标 - 10000, 6);
  await f.select(2); assert.equal(f.status().options.mode, "brew"); assert.equal(f.status().enabled, true);
  const loaded = brewery(f.stored); await loaded.tick(); await loaded.select(2);
  assert.equal(loaded.status().options.mode, "brew"); assert.equal(loaded.remaining(2), 10);
  assert.equal(loaded.save.getAt(loaded.queue(2), 6, 13), 10);
  await loaded.handlers["craft-pause"]({ token: loaded.status().token });
  const paused = brewery(loaded.stored); await paused.tick(); await paused.select(2);
  assert.equal(paused.status().enabled, false); assert.equal(paused.queue(2), 0);
  paused.runtime.callFunction("删除地图设施", 10022, 10010, false, false, false, 0, false, false);
  [5, 41, 8, 0].forEach((n, field) => paused.save.setAt(n, 5, field, 21));
  paused.save.setAt(5, 172, 10, 6); await paused.select(2);
  assert.equal(paused.status().options.mode, "repeat"); assert.equal(paused.queue(2), 0);
});

test("gameplay and station availability gates prevent new brewing orders", async () => {
  for (const block of [f => { f.g.游戏暂停 = true; }, f => { f.runtime.timeScale = 0; },
    f => { f.objects.二级页面背景.push({}); }, f => { f.tiles[2].instVars.有效解锁 = false; }]) {
    const f = brewery(); await f.enable(); block(f); await f.tick(); assert.equal(f.queue(2), 0);
  }
  const f = brewery(); await f.enable(); f.g.爬塔挑战开关 = true; await f.tick(); assert.equal(f.remaining(2), 10);
});

test("failed queue/payment or missing pill catalog never falls back to repeating a stale recipe", async () => {
  for (const fault of [f => { f.refuseQueue = true; }, f => { f.refusePayment = true; }, f => { delete f.runtime.objects.cl; }]) {
    const f = brewery(); await f.tick(); f.start(2, 32); f.finish(2); f.g.游戏暂停 = true; await f.enable();
    const balances = f.balance(); fault(f); f.g.游戏暂停 = false; await f.tick(); await f.tick();
    assert.equal(f.queue(2), 0); assert.deepEqual(f.balance(), balances);
    assert.equal(f.notifications.length, 1); assert.equal(f.status().error, true);
  }
});

test("brew mode rejects equipment stations and stale brewery selection messages", async () => {
  const f = brewery(); await f.enable(); const token = f.status().token, options = f.status().options;
  await f.select(0); await f.handlers["craft-configure"]({ token, options });
  assert.equal(f.status().options.mode, "repeat");
  await f.configure({ mode: "brew" }); assert.equal(f.status().error, true); assert.match(f.status().message, /requires a brewery/);
});

test("brew completions stay outside equipment keeping and selling when gear automation is active", async () => {
  const f = brewery(); await f.tick(); await f.configure({ mode: "sets", keepLimit: 0 }); await f.tick();
  await f.enable(); await f.tick();
  for (let i = 0; i < 10; i++) f.complete(2, [], 6);
  await f.tick(); assert.equal(f.plan().find(p => p.recipe === 30).stock, 10);
  assert.equal(f.calls.filter(c => c[0] === "出售物品").length, 0);
  assert.equal(f.save.getAt(1, 1, 7), 0); assert.deepEqual(f.notifications, []);
});

test("a manual order during a pending settings read wins over saved auto brewing", async () => {
  const source = brewery(); await source.enable();
  const f = brewery(source.stored), read = f.runtime.storage.getItem; let release;
  f.runtime.storage.getItem = async k => { if (k === key) await new Promise(resolve => { release = resolve; }); return read(k); };
  await f.tick(); f.start(2, 32); release(); await f.select(2); await f.tick();
  assert.equal(f.status().enabled, false); assert.equal(f.recipe(2), 32);
  f.finish(2); await f.tick(); assert.equal(f.queue(2), 0);
});
