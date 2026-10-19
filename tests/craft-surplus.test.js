"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers/crafting-fixture");
const settle = () => new Promise(resolve => setImmediate(resolve));
const key = "cjs-formations:craft-stations:v1:12345678";
const saved = f => f.stored.get(key).stations.find(s => s.id === 3);
const bag = f => Array.from({ length: f.save.width - 1 }, (_, i) => i + 1).filter(row => f.save.getAt(row, 1, 7) > 0);
const qualities = f => bag(f).map(row => f.save.getAt(row, 5, 7)).sort();
async function ready(limit = 1) {
  const f = fixture(new Map(), true); await f.tick(); await f.tick();
  await f.configure({ mode: "repeat", keepLimit: limit, minimum: 1, autoSell: false });
  f.start(0, 13, 1, 30); return f;
}
function craft(f, quality, bonuses = [59], rolls = [50]) { f.rolls = rolls; f.complete(0, bonuses, quality); }
function give(f, recipe, quality, bonuses = [59], rolls = [50], tier = 1) {
  f.bonuses = bonuses; f.rolls = rolls;
  f.runtime.callFunction("获得物品", true, recipe, quality, 1, tier, 200, 1, false, 0, "特定装备", false);
  return bag(f).at(-1);
}

test("keep-best-N replaces its own weaker auto-locked crafts and locks the retained results", async () => {
  const f = await ready(2); craft(f, 3); craft(f, 5); craft(f, 4); await settle();
  assert.deepEqual(qualities(f), [4, 5]); assert.equal(f.save.getAt(1, 2, 0), 123);
  assert.ok(bag(f).every(row => f.save.getAt(row, 22, 7) === 1)); assert.equal(saved(f).managed.length, 2);
  craft(f, 2); assert.deepEqual(qualities(f), [4, 5]); assert.equal(f.save.getAt(1, 2, 0), 246);
});

test("equal rarities compare total matching rolls, with rarity taking priority and ties retaining the old piece", async () => {
  const f = await ready(); craft(f, 4, [59], [50]); craft(f, 4, [59, 59], [30, 30]);
  assert.equal(bag(f).length, 1); const row = bag(f)[0]; assert.equal(f.save.getAt(row, 10, 7), 59);
  craft(f, 4, [59, 59], [30, 30]); assert.deepEqual(bag(f), [row]);
  craft(f, 6, [59], [1]); assert.deepEqual(qualities(f), [6]);
});

test("type, stat variant, tier and job bonus have separate limits; multi-bonus pieces survive if any group needs them", async () => {
  const f = await ready(); craft(f, 3, [59]); craft(f, 4, [62]);
  assert.equal(bag(f).length, 2); craft(f, 6, [59]); assert.deepEqual(qualities(f), [4, 6]);
  craft(f, 5, [59, 62], [80, 80]); assert.deepEqual(qualities(f), [5, 6]);
  craft(f, 6, [62]); assert.deepEqual(qualities(f), [6, 6]);
  const otherStat = give(f, 14, 6, [57]), otherTier = give(f, 13, 6, [59], [100], 2), otherSlot = give(f, 19, 6, [59]);
  craft(f, 5, [59]);
  for (const row of [otherStat, otherTier, otherSlot]) assert.ok(f.save.getAt(row, 1, 7) > 0);
  assert.equal(bag(f).length, 5);
});

test("only bonus groups touched by the new craft are trimmed", async () => {
  const f = await ready(); const builders = [give(f, 13, 3, [62]), give(f, 13, 4, [62])];
  craft(f, 5, [59]); craft(f, 6, [59]);
  assert.equal(bag(f).length, 3); for (const row of builders) assert.equal(f.save.getAt(row, 9, 7), 62);
});

test("older unlocked duplicates are compared individually and the weakest are sold", async () => {
  const f = await ready(2); give(f, 13, 2); give(f, 13, 6); give(f, 13, 3); craft(f, 5);
  assert.deepEqual(qualities(f), [5, 6]); assert.equal(f.save.getAt(1, 2, 0), 246);
});

test("manual locks and equipped items count toward the limit and are never replaced", async () => {
  for (const location of [7, 9]) {
    const f = await ready(), row = give(f, 13, 3);
    if (location === 7) f.save.setAt(1, row, 22, 7);
    else {
      for (let field = 0; field < 50; field++) { f.save.setAt(f.save.getAt(row, field, 7), 1, field, 9); f.save.setAt(0, row, field, 7); }
      f.save.setAt(8, 1, 7, 9);
    }
    craft(f, 6); assert.equal(f.save.getAt(1, 2, 0), 123);
    assert.equal(f.save.getAt(1, 5, location), 3); assert.equal(bag(f).length, location === 7 ? 1 : 0);
  }
});

test("manual unlock and relock relinquish an automatic lock immediately", async () => {
  const f = await ready(); craft(f, 3); const row = bag(f)[0];
  f.save.setAt(0, row, 22, 7); f.runtime.callFunction("刷新物品", 8, "装备", "二级页面", 0, 0, 0);
  f.save.setAt(1, row, 22, 7); craft(f, 6); await settle();
  assert.deepEqual(qualities(f), [3]); assert.equal(saved(f).managed.length, 0);
});

test("automatic lock identities survive reload but a different or manually upgraded item is protected", async () => {
  const f = await ready(); craft(f, 3); await settle();
  const next = fixture(f.stored, true);
  for (let field = 0; field < 50; field++) next.save.setAt(f.save.getAt(1, field, 7), 1, field, 7);
  next.start(0, 13, 1, 10); await next.tick(); await next.tick(); craft(next, 5);
  assert.deepEqual(qualities(next), [5]);
  next.save.setAt(10, bag(next)[0], 6, 7); await next.tick(); craft(next, 6);
  assert.deepEqual(qualities(next), [5]); assert.equal(next.save.getAt(bag(next)[0], 6, 7), 10);
});

test("manually selling a managed item cannot claim a later identical locked item", async () => {
  const f = await ready(); craft(f, 3); f.runtime.callFunction("出售物品", bag(f)[0], false, false);
  const row = give(f, 13, 3); f.save.setAt(1, row, 22, 7); craft(f, 6);
  assert.deepEqual(qualities(f), [3]); assert.equal(f.save.getAt(row, 22, 7), 1);
});

test("duplicate identities fail closed and equipment transfers defer selling", async () => {
  const f = await ready(); craft(f, 3);
  for (let field = 0; field < 50; field++) f.save.setAt(f.save.getAt(1, field, 7), 2, field, 7);
  craft(f, 6); assert.deepEqual(qualities(f), [3, 3]);
  f.g.装备穿戴中 = true; const money = f.save.getAt(1, 2, 0); craft(f, 6);
  assert.equal(f.save.getAt(1, 2, 0), money); assert.deepEqual(qualities(f), [3, 3, 6]);
});

test("unmatched gear uses exact bonus patterns when reject selling is off", async () => {
  const f = await ready(); craft(f, 2, [72], [20]); craft(f, 4, [72], [40]); craft(f, 3, [71], [30]);
  assert.deepEqual(qualities(f), [3, 4]);
  await f.handlers["craft-sell"]({ token: f.status().token, autoSell: true }); craft(f, 6, [72], [99]);
  assert.deepEqual(qualities(f), [3, 4]);
});

test("invalid limits are rejected without enabling sales", async () => {
  for (const keepLimit of [-1, 1.5, "2", 1000]) {
    const f = fixture(new Map(), true); await f.tick(); await f.tick();
    await f.handlers["craft-output"]({ token: f.status().token, keepLimit });
    assert.equal(saved(f).options.keepLimit, null); assert.equal(f.status().enabled, false);
  }
});

test("crafts finishing during a pending settings write are kept without native or mod sales", async () => {
  for (const succeeds of [true, false]) {
    const f = await ready();
    f.save.setAt(6, 9, 1, 0);
    let resolve, reject;
    f.runtime.storage.setItem = () => new Promise((yes, no) => { resolve = yes; reject = no; });
    const editing = f.handlers["craft-output"]({ token: f.status().token, keepLimit: 0 });
    await settle(); assert.equal(f.status().busy, true);
    craft(f, 3); craft(f, 4);
    assert.deepEqual(qualities(f), [3, 4]); assert.equal(f.save.getAt(1, 2, 0), 0);
    if (succeeds) resolve(); else reject(Error("disk unavailable"));
    await editing;
    assert.deepEqual(qualities(f), [3, 4]); assert.equal(f.save.getAt(1, 2, 0), 0);
    if (succeeds) {
      craft(f, 5); assert.deepEqual(qualities(f), [3, 4]); assert.equal(f.save.getAt(1, 2, 0), 123);
    } else assert.equal(f.status().enabled, false);
  }
});

test("Auto-all fills the kept sets then keeps cycling upgrade batches instead of stalling at the cap", async () => {
  for (const keepLimit of [0, 1]) {
    const f = fixture(new Map(), true); await f.tick();
    await f.configure({ mode: "sets", roles: ["forge", "research"], keepLimit, minimum: 1 }); await f.tick();
    const expected = keepLimit === 0 ? [2, 13, 7, 15, 2, 13] : [2, 13, 7, 15, 2, 13, 7, 15, 2];
    for (const recipe of expected) {
      assert.equal(f.save.getAt(f.queue(0), 3, 13), recipe);
      for (let n = 0; n < 10; n++) f.complete(0, [recipe === 2 || recipe === 13 ? 59 : 63], 3);
      await f.tick();
    }
    assert.equal(bag(f).length, keepLimit === 0 ? 0 : 4);
  }
});

test("limited forge cycles honor the output filter and refill after the keep limit is increased", async () => {
  for (const [forgeOutput, expected] of [["weapons", [2, 7]], ["hands", [13, 15]]]) {
    const f = fixture(new Map(), true); await f.tick();
    await f.configure({ mode: "sets", roles: ["forge", "research"], keepLimit: 1, minimum: 1, forgeOutput }); await f.tick();
    for (const recipe of [...expected, ...expected]) {
      assert.equal(f.save.getAt(f.queue(0), 3, 13), recipe);
      for (let n = 0; n < 10; n++) f.complete(0, [recipe === expected[0] ? 59 : 63], 3);
      await f.tick();
    }
    await f.handlers["craft-output"]({ token: f.status().token, keepLimit: 2 });
    for (let n = 0; n < 10; n++) f.complete(0, [59], 3); await f.tick();
    assert.equal(f.save.getAt(f.queue(0), 3, 13), expected[1]); assert.equal(bag(f).length, 3);
  }
});
