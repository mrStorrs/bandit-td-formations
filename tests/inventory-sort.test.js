"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { fixture: craftingFixture } = require("./helpers/crafting-fixture");
const sandbox = { BanditFormations: {} }; vm.createContext(sandbox);
for (const file of ["craft-sets.js", "inventory-sort.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../src/${file}`, "utf8"), sandbox);
const api = sandbox.BanditFormations;
function fixture() {
  const { save, wp, catalog } = craftingFixture(new Map(), true);
  let next = 1;
  const add = (recipe, bonuses, changes = {}) => {
    const row = next++, { quality = 6, tier = 1, level = 1, mainRoll = 100, rolls = bonuses.map(() => 50) } = changes;
    for (const [field, value] of [[0, row], [1, recipe], [3, tier], [5, quality], [6, level], [8, mainRoll]]) save.setAt(value, row, field, 7);
    for (let i = 0; i < 6; i++) { save.setAt(bonuses[i] || 0, row, 9 + i, 7); save.setAt(rolls[i] || 0, row, 15 + i, 7); }
    return row;
  };
  const value = (item, id, roll) => roll * item.tier;
  const sort = (role, rows = Array.from({ length: next - 1 }, (_, i) => i + 1), stat = value) =>
    Array.from(api.sortInventoryRows(rows, save, wp, role, stat));
  return { add, sort, save, wp, catalog };
}

for (const role of api.craftRoles) test(`${role.name} puts its automation-matching gear first in every equipment slot`, () => {
  const f = fixture(), recipes = api.craftRecipes(f.wp, role, 1);
  assert.ok(recipes.every(id => id > 0));
  const wrong = f.add(recipes[0], [role.combat ? 51 : 72]);
  const matches = recipes.map(recipe => f.add(recipe, [role.bonus]));
  assert.deepEqual(f.sort(role.id), [...matches, wrong]);
});

test("work combinations rank crit + selected job, crit, job, damage-only, then nonmatches", () => {
  const f = fixture();
  const wrong = f.add(2, [60, 12, 72]), damage = f.add(2, [52], { rolls: [999] });
  const job = f.add(2, [59, 52], { rolls: [999, 999] });
  const crit = f.add(2, [51], { rolls: [999] });
  const combo = f.add(2, [51, 59], { rolls: [1, 1] });
  assert.deepEqual(f.sort("forge"), [combo, crit, job, damage, wrong]);
});

test("within a realm, rarity outranks suffix strength and damage-only gear follows matches", () => {
  const f = fixture();
  const orange = f.add(2, [51, 59, 52], { quality: 5, rolls: [999, 999, 999] });
  const red = f.add(2, [59], { rolls: [1] });
  const green = f.add(2, [59], { quality: 2 });
  const damage = f.add(2, [52], { rolls: [999] });
  assert.deepEqual(f.sort("forge"), [red, orange, green, damage]);
});

test("equal combinations compare total suffix crit, job bonus, then crit damage, in that order", () => {
  const f = fixture();
  const base = f.add(2, [51, 59, 52], { rolls: [50, 50, 50] });
  const damage = f.add(2, [51, 59, 52], { rolls: [50, 50, 100] });
  const job = f.add(2, [51, 59], { rolls: [50, 60] });
  const crit = f.add(2, [51, 51, 59], { rolls: [30, 30, 1] });
  assert.deepEqual(f.sort("forge"), [crit, job, damage, base]);
});

test("innate work crit, innate crit damage, main rolls and unrelated job bonuses do not become suffix matches", () => {
  const f = fixture(); f.catalog[19][9] = 51; f.catalog[19][12] = 999; f.catalog[25][9] = 52;
  const innate = f.add(19, [72]), wrongJob = f.add(19, [62]), innateDamage = f.add(25, []);
  const bonus = f.add(19, [59], { mainRoll: 999 }), crit = f.add(19, [51], { mainRoll: 1 });
  assert.deepEqual(f.sort("forge"), [crit, bonus, innate, wrongJob, innateDamage]);
  assert.deepEqual(f.sort("building").slice(0, 2), [crit, wrongJob]);
});

test("combat uses spear / bow / fan, matching stat variants and combat accessories, across every tier", () => {
  for (const role of api.craftRoles.filter(role => role.combat)) for (let tier = 1; tier <= 9; tier++) {
    const f = fixture(), base = { "combat-str": 2, "combat-agi": 5, "combat-int": 7 }[role.id];
    const offset = 75 * (tier - 1); f.wp.width = 700;
    for (let id = 1; id <= 27; id++) f.catalog[id + offset] = { ...f.catalog[id], 3: tier };
    const other = [1, 6, 8][role.stat - 1];
    const wrongWeapon = f.add(other + offset, [role.bonus], { tier });
    const wrongSlot = f.add(12 + role.stat + offset, [role.bonus], { tier });
    const good = f.add(base + offset, [role.bonus], { tier });
    const better = f.add(base + offset, [role.bonus, role.bonus], { tier, rolls: [40, 40] });
    assert.deepEqual(f.sort(role.id), [better, good, wrongWeapon, wrongSlot]);
  }
});

test("role-relevant gear precedes nonmatches, with realm above rarity and suffix strength in every slot", () => {
  for (const role of api.craftRoles) for (let slot = 0; slot < 4; slot++) {
    const f = fixture(), matches = [], others = []; f.wp.width = 700;
    for (let tier = 1; tier <= 9; tier++) {
      const offset = 75 * (tier - 1);
      for (let id = 1; id <= 27; id++) f.catalog[id + offset] = { ...f.catalog[id], 3: tier };
      const recipe = api.craftRecipes(f.wp, role, tier)[slot];
      const unrelated = f.add(recipe, [72], { tier, quality: 6, level: 999, rolls: [999] });
      const bonuses = role.combat ? [role.bonus] : [51, role.bonus];
      const match = f.add(recipe, bonuses, { tier, quality: tier % 2 ? 1 : 6, level: 10 - tier,
        rolls: bonuses.map(() => 1000 - tier * 100) });
      matches.unshift(match); others.unshift(unrelated);
    }
    assert.deepEqual(f.sort(role.id), [...matches, ...others], `${role.id}, slot ${slot + 1}`);
  }
});

test("Builder offhands beat higher-realm fighter pieces; wrong stat and wrong job suffixes do not qualify", () => {
  const f = fixture(); f.wp.width = 300;
  for (let tier = 2; tier <= 3; tier++) for (let id = 1; id <= 27; id++) {
    f.catalog[id + 75 * (tier - 1)] = { ...f.catalog[id], 3: tier };
  }
  const fighter = f.add(160, [19, 51, 62], { tier: 3 });
  const wrongStat = f.add(164, [51, 62], { tier: 3 });
  const wrongJob = f.add(163, [59], { tier: 3 });
  const redBuilder = f.add(13, [51, 62]);
  const realm2Crit = f.add(88, [51], { tier: 2, quality: 1 });
  assert.deepEqual(f.sort("building"), [realm2Crit, redBuilder, fighter, wrongStat, wrongJob]);
});

test("a higher-realm damage-only piece precedes lower-realm matches, with role priority inside each realm", () => {
  const f = fixture(); f.wp.width = 200;
  f.catalog[77] = { ...f.catalog[2], 3: 2 }; f.catalog[152] = { ...f.catalog[2], 3: 3 };
  const lower = f.add(77, [51, 59, 52], { tier: 2, rolls: [999, 999, 999] });
  const higherDamage = f.add(152, [52], { tier: 3, quality: 1, rolls: [1] });
  const higherMatch = f.add(152, [59], { tier: 3, quality: 1, rolls: [1] });
  assert.deepEqual(f.sort("forge"), [higherMatch, higherDamage, lower]);
});

test("native suffix values are still read, but even much stronger values cannot override realm tier", () => {
  const f = fixture(); f.wp.width = 100; f.catalog[77] = { ...f.catalog[2], 3: 2 };
  const low = f.add(2, [51], { rolls: [999] }), high = f.add(77, [51], { tier: 2, rolls: [1] });
  const calls = [];
  assert.deepEqual(f.sort("forge", [low, high], (item, id, roll) => { calls.push([item.tier, id, roll]); return roll * item.tier; }), [high, low]);
  assert.deepEqual(calls, [[1, 51, 999], [2, 51, 1]]);
});

test("sorting is stable, does not mutate item records or locks, and leaves nonmatches in game order", () => {
  const f = fixture(), a = f.add(2, [51, 59]), b = f.add(2, [51, 59]), c = f.add(1, [59]), d = f.add(5, [59]);
  f.save.setAt(1, a, 22, 7); f.save.setAt(42, b, 7, 7);
  const before = Array.from({ length: 4 }, (_, i) => Array.from({ length: 50 }, (_, j) => f.save.getAt(i + 1, j, 7)));
  const rows = [d, b, c, a];
  assert.deepEqual(f.sort("forge", rows), [b, a, d, c]); assert.deepEqual(rows, [d, b, c, a]);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => Array.from({ length: 50 }, (_, j) => f.save.getAt(i + 1, j, 7))), before);
  assert.deepEqual(f.sort("unknown", rows), rows);
  assert.throws(() => f.sort("forge", rows, () => NaN), /could not be compared/);
});
