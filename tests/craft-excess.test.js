"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers/crafting-fixture");
const key = "cjs-formations:craft-stations:v1:12345678";
const bag = f => Array.from({ length: f.save.width - 1 }, (_, i) => i + 1).filter(row => f.save.getAt(row, 1, 7) > 0);
async function ready(changes = {}, protection) {
  const f = fixture(new Map(), true, protection); await f.tick(); await f.tick();
  await f.configure({ mode: "repeat", keepLimit: 5, minimum: 1, autoSell: false, ...changes });
  return f;
}
function give(f, recipe = 2, bonuses = [59], roll = 50, quality = 6, tier = 1) {
  f.bonuses = bonuses; f.rolls = bonuses.map(() => roll);
  f.runtime.callFunction("获得物品", true, recipe, quality, 1, tier, 200, 1, false, 0, "特定装备", false);
  return bag(f).at(-1);
}
const sell = f => f.handlers["craft-sell-excess"]({ token: f.status().token, options: f.status().options });

test("manual excess sale trims eleven matches to the best five without changing queues or settings", async () => {
  const f = await ready(); f.start(0, 2, 1, 10);
  const rows = Array.from({ length: 11 }, (_, i) => give(f, 2, [59], i + 1));
  const before = JSON.stringify(f.stored.get(key)), queue = f.queue(0);
  await sell(f);
  assert.deepEqual(bag(f), rows.slice(6));
  assert.equal(f.save.getAt(1, 2, 0), 6 * 123);
  assert.match(f.status().saleMessage, /Sold 6 excess items/);
  assert.equal(f.queue(0), queue); assert.equal(f.remaining(0), 10);
  assert.equal(JSON.stringify(f.stored.get(key)), before);
  await sell(f); assert.equal(f.save.getAt(1, 2, 0), 6 * 123);
});

test("the only STR/Forger spear survives and the next weakest forge-only spears are sold", async () => {
  const f = await ready({ roles: ["forge"], loop: "forge" });
  const shared = give(f, 2, [19, 59], 1);
  const forge = Array.from({ length: 6 }, (_, i) => give(f, 2, [59], i + 10));
  await sell(f);
  assert.deepEqual(bag(f), [shared, ...forge.slice(2)]);
  assert.equal(f.save.getAt(1, 2, 0), 246);
});
test("wrong combat bonuses do not shelter excess work weapons from stock trimming", async () => {
  for(const [recipe,workBonus,combatBonus] of [[1,56,19],[3,62,19],[4,64,20],[6,57,20],[8,61,21],[9,58,21]]) {
    const f=await ready({keepLimit:1});
    const weak=give(f,recipe,[workBonus,combatBonus],1);
    const best=give(f,recipe,[workBonus],99);
    await sell(f);
    assert.equal(f.save.getAt(weak,1,7),0);
    const before=bag(f);give(f,recipe,[combatBonus],50);
    const reject=bag(f).find(row=>!before.includes(row));
    await sell(f);
    assert.deepEqual(bag(f).sort((a,b)=>a-b),[best,reject].sort((a,b)=>a-b),"the sale button only trims matches; unrelated existing rejects are untouched");
  }
});

test("overlapping work groups retain their stock even when unchecked, while rarity ranks before suffix strength", async () => {
  const f = await ready({ keepLimit: 2, roles: ["forge"] });
  give(f, 13, [59, 62], 1, 5);
  const builder = give(f, 13, [62], 90);
  const crit = give(f, 13, [59, 51], 100, 5);
  give(f, 13, [59], 70);
  const best = give(f, 13, [59], 80);
  await sell(f);
  // The crit suffix also supplies Logger and Builder, so it is needed even
  // though the stronger red Forger piece ranks first within the Forge group.
  assert.deepEqual(bag(f), [builder, crit, best]);
});

test("mixed shared suffixes never take any role below its quota or leave a safely removable extra", async () => {
  const patterns = [[59], [62], [56], [51], [59, 62], [59, 56], [56, 62], [59, 62, 56]];
  const roles = [59, 62, 56];
  for (const limit of [1, 2, 5]) for (let seed = 0; seed < 8; seed++) {
    const f = await ready({ keepLimit: limit, roles: ["forge"] });
    for (let i = 0; i < 24; i++) {
      const row = give(f, 13, patterns[(i * 3 + seed) % patterns.length], i + 1, 1 + (i + seed) % 6);
      if ((i + seed) % 11 === 0) f.save.setAt(1, row, 22, 7);
    }
    const matches = row => roles.filter(id => Array.from({ length: 6 }, (_, i) => f.save.getAt(row, 9 + i, 7)).some(b => b === id || b === 51));
    const counts = () => roles.map(id => bag(f).filter(row => matches(row).includes(id)).length);
    const before = counts();
    await sell(f);
    const after = counts();
    for (let i = 0; i < roles.length; i++) assert.ok(after[i] >= Math.min(before[i], limit));
    for (const row of bag(f)) if (!f.save.getAt(row, 22, 7)) {
      assert.ok(matches(row).some(id => after[roles.indexOf(id)] <= limit), "a shared group or protected lock justifies every remaining extra");
    }
  }
});

test("bulk sales respect station slots, forge filters, tier and minimum rarity; rejects are untouched", async () => {
  for (const [index, forgeOutput, expectedRecipes] of [[0, "all", [2, 13]], [0, "weapons", [2]], [0, "hands", [13]], [1, "all", [19, 25]]]) {
    const f = await ready(); await f.select(index);
    await f.configure({ mode: "repeat", keepLimit: 1, minimum: 5, forgeOutput, autoSell: true });
    const weak = new Map();
    for (const recipe of [2, 13, 19, 25]) {
      weak.set(recipe, give(f, recipe, [59], 1, 5)); give(f, recipe, [59], 10, 6);
    }
    const untouched = [give(f, 2, [59], 1, 4), give(f, 2, [59], 1, 6, 2),
      give(f, 2, [72], 1), give(f, 2, [72], 2), give(f, 13, [59], 1, 4)];
    await sell(f);
    for (const [recipe, row] of weak) assert.equal(f.save.getAt(row, 1, 7) === 0, expectedRecipes.includes(recipe));
    for (const row of untouched) assert.ok(f.save.getAt(row, 1, 7) > 0);
  }
});

test("manual, saved-outfit and equipped items are retained and count toward stock", async () => {
  let outfitRow;
  const f = await ready({ keepLimit: 3 }, (_, row, layer) => layer === 7 && row === outfitRow);
  const locked = give(f, 2, [59], 1); f.save.setAt(1, locked, 22, 7);
  outfitRow = give(f, 2, [59], 2);
  const equipped = give(f, 2, [59], 3);
  for (let field = 0; field < 50; field++) {
    f.save.setAt(f.save.getAt(equipped, field, 7), 1, field, 9);
    f.save.setAt(0, equipped, field, 7);
  }
  f.save.setAt(8, 1, 7, 9);
  give(f, 2, [59], 99); give(f, 2, [59], 100);
  await sell(f);
  assert.deepEqual(bag(f), [locked, outfitRow]);
  assert.equal(f.save.getAt(1, 1, 9), 2);
  assert.equal(f.save.getAt(locked, 22, 7), 1);
  assert.equal(f.save.getAt(outfitRow, 22, 7), 0);
});

test("bulk trimming replaces only this station's managed locks and works while paused", async () => {
  const f = await ready({ keepLimit: 3 }); f.start(0, 2, 1, 10);
  for (const roll of [10, 20, 30]) { f.rolls = [roll]; f.complete(0, [59], 6); }
  await f.tick();
  await f.handlers["craft-output"]({ token: f.status().token, keepLimit: 1 });
  await f.handlers["craft-pause"]({ token: f.status().token });
  await sell(f);
  assert.equal(bag(f).length, 1); assert.equal(f.save.getAt(bag(f)[0], 15, 7), 30);
  assert.equal(f.status().enabled, false); assert.equal(f.remaining(0), 7);
  await f.tick();
  assert.equal(f.stored.get(key).stations.find(s => s.id === 3).managed.length, 1);
  // Another station cannot claim or replace this station's tracked lock.
  f.tiles[1].instVars.设施编号 = 21; f.save.setAt(21, 4, 1, 21);
  await f.select(1); await f.configure({ mode: "repeat", keepLimit: 1, minimum: 1 });
  give(f, 2, [59], 100); await sell(f);
  assert.equal(bag(f).length, 1); assert.equal(f.save.getAt(bag(f)[0], 15, 7), 30);
});

test("stale selection or settings, disabled policies, transfers and pending writes cannot trigger bulk sales", async () => {
  for (const change of ["selection", "options", "normal", "all", "brewery", "transfer", "pending", "error"]) {
    const f = await ready({ keepLimit: 1 });
    give(f); give(f, 2, [59], 99);
    const payload = { token: f.status().token, options: f.status().options };
    let pending, release;
    if (change === "selection") await f.select(1);
    if (change === "options") await f.configure({ mode: "repeat", keepLimit: 2 });
    if (change === "normal" || change === "all") {
      await f.handlers["craft-output"]({ token: f.status().token, keepLimit: change === "all" ? 0 : null });
      payload.options = f.status().options;
    }
    if (change === "brewery") { await f.select(2); payload.token = f.status().token; payload.options = f.status().options; }
    if (change === "transfer") f.g.装备穿戴中 = true;
    if (change === "pending") {
      f.runtime.storage.setItem = () => new Promise(resolve => { release = resolve; });
      pending = f.handlers["craft-output"]({ token: f.status().token, keepLimit: 1 });
      await new Promise(resolve => setImmediate(resolve));
    }
    if (change === "error") {
      f.runtime.storage.setItem = async () => { throw Error("disk unavailable"); };
      await f.handlers["craft-output"]({ token: f.status().token, keepLimit: 1 });
    }
    await f.handlers["craft-sell-excess"](payload);
    assert.equal(bag(f).length, 2, change); assert.equal(f.save.getAt(1, 2, 0), 0, change);
    if (pending) { release(); await pending; }
  }
});

test("all comparisons finish before selling and native failures stop the sweep", async () => {
  for (const broken of ["stats", "sale"]) {
    const f = await ready({ keepLimit: 1 });
    give(f); give(f, 2, [59], 99);
    give(f, 13); const row = give(f, 13, [59], 99);
    if (broken === "stats") f.save.setAt(NaN, row, 15, 7);
    else f.refuseSale = true;
    await sell(f);
    assert.equal(bag(f).length, 4); assert.equal(f.save.getAt(1, 2, 0), 0);
    assert.equal(f.status().error, true);
    assert.ok(f.calls.filter(c => c[0] === "出售物品").length <= 1);
  }
});
