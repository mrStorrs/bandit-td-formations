"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../src/formations.js");
require("../src/combat.js");
const { CombatToggle } = globalThis.BanditFormations;

function harness() {
  let current = { saveId: 12345678, mapId: 1, token: "save-1:map-1", tiles: [{ x: 10, y: 20 }],
    characters: ["采矿", "自动", "战斗", "休息"].map((mode, i) =>
      ({ id: i + 1, identity: `hero-${i}`, mode, priorityX: i === 0 ? 10 : 0, priorityY: i === 0 ? 20 : 0 })) };
  const data = new Map(), applied = [], notices = [];
  const storage = { getItem: async key => data.get(key), setItem: async (key, value) => data.set(key, structuredClone(value)) };
  const options = { context: () => current, storage, notify: text => notices.push(text), apply: plan => {
    applied.push(plan);
    for (const { from, mode, priorityX, priorityY } of plan.changes) Object.assign(from, { mode, priorityX, priorityY });
  } };
  return { toggle: new CombatToggle(options), options, data, storage, notices, applied,
    get current() { return current; }, set current(value) { current = value; } };
}

test("C sets a mixed party to combat and restores each original mode and work target", async () => {
  const h = harness(), before = structuredClone(h.current.characters);
  await h.toggle.toggle();
  assert.deepEqual(h.current.characters.map(c => c.mode), ["战斗", "战斗", "战斗", "战斗"]);
  assert.equal(h.current.characters[0].priorityX, 0);
  assert.deepEqual(h.applied[0].changes.map(c => c.id), [1, 2, 3, 4]);
  await h.toggle.toggle();
  assert.deepEqual(h.current.characters, before);
  assert.match(h.notices.at(-1), /Previous modes restored/);
  assert.equal([...h.data.values()][0], null);
  h.current.characters[0].mode = "研究";
  await h.toggle.toggle(); await h.toggle.toggle();
  assert.equal(h.current.characters[0].mode, "研究");
});
test("undo survives a new controller and stays separate from another campaign", async () => {
  const h = harness(), campaign = h.current;
  await h.toggle.toggle();
  h.current = { ...structuredClone(campaign), saveId: 87654321, token: "save-2", characters: [
    { id: 1, identity: "other", mode: "种植", priorityX: 0, priorityY: 0 },
  ] };
  await h.toggle.toggle(); await h.toggle.toggle();
  assert.equal(h.current.characters[0].mode, "种植");
  h.current = campaign;
  await new CombatToggle(h.options).toggle();
  assert.equal(campaign.characters[0].mode, "采矿");
});
test("undo restores modes across maps without copying old map work coordinates", async () => {
  const h = harness(); await h.toggle.toggle();
  h.current = { ...h.current, mapId: 2, token: "map-2" };
  await h.toggle.toggle();
  assert.equal(h.current.characters[0].mode, "采矿");
  assert.equal(h.current.characters[0].priorityX, 0);
  assert.equal(h.current.characters[0].priorityY, 0);
});
test("undo skips missing or replaced characters and leaves new recruits alone", async () => {
  const h = harness(); await h.toggle.toggle();
  h.current.characters = h.current.characters.filter(c => c.id !== 2);
  h.current.characters[1].identity = "replacement";
  h.current.characters[1].mode = "自动";
  h.current.characters.push({ id: 5, identity: "new", mode: "研究", priorityX: 0, priorityY: 0 });
  await h.toggle.toggle();
  assert.deepEqual(h.current.characters.map(c => c.mode), ["采矿", "自动", "休息", "研究"]);
  assert.equal(h.applied.at(-1).skipped, 2);
});
test("an unavailable saved work tile clears only the work target", async () => {
  const h = harness(); await h.toggle.toggle(); h.current.tiles = [];
  await h.toggle.toggle();
  assert.equal(h.current.characters[0].mode, "采矿");
  assert.equal(h.current.characters[0].priorityX, 0);
});
test("storage must succeed before combat mode can change", async () => {
  const h = harness(); h.storage.setItem = async () => { throw new Error("disk full"); };
  await h.toggle.toggle();
  assert.equal(h.applied.length, 0); assert.equal(h.toggle.busy, false);
  assert.deepEqual(h.notices, ["disk full"]);
});
test("failed native application or undo cleanup retains the original snapshot for retry", async () => {
  const h = harness();
  const apply = h.toggle.apply;
  h.toggle.apply = () => { throw new Error("native failure"); };
  await h.toggle.toggle();
  assert.equal([...h.data.values()][0].characters[0].mode, "采矿");
  h.toggle.apply = apply;
  const setItem = h.storage.setItem;
  h.storage.setItem = async () => { throw new Error("cleanup failure"); };
  await h.toggle.toggle();
  assert.equal([...h.data.values()][0].characters[0].mode, "采矿");
  h.storage.setItem = setItem; await h.toggle.toggle();
  assert.equal([...h.data.values()][0], null);
});
test("invalid saved modes fail before any character is changed", async () => {
  const h = harness(); await h.toggle.toggle();
  [...h.data.values()][0].characters[3].mode = null;
  await h.toggle.toggle();
  assert.equal(h.applied.length, 1); assert.match(h.notices.at(-1), /invalid/);
});
test("busy presses and context changes during storage reads cannot toggle another map", async () => {
  const h = harness(); let resolve;
  h.storage.getItem = () => new Promise(r => { resolve = r; });
  const first = h.toggle.toggle(); await h.toggle.toggle();
  h.current = { ...h.current, token: "different-map" }; resolve(null); await first;
  assert.equal(h.applied.length, 0); assert.equal(h.data.size, 0);
});
test("a map change while saving the undo cancels combat and clears the unused snapshot", async () => {
  const h = harness(), setItem = h.storage.setItem;
  h.storage.setItem = async (key, value) => {
    await setItem(key, value);
    h.current = { ...h.current, token: "different-map" };
  };
  await h.toggle.toggle();
  assert.equal(h.applied.length, 0); assert.equal([...h.data.values()][0], null);
});

test("combat undo waits for outfit completion and retains its snapshot after an asynchronous failure", async () => {
  const h = harness(); await h.toggle.toggle();
  let resolve, reject;
  h.toggle.apply = () => new Promise((yes, no) => { resolve = yes; reject = no; });
  const failed = h.toggle.toggle();
  await Promise.resolve();
  assert.equal(h.toggle.busy, true); assert.ok([...h.data.values()][0]);
  await h.toggle.toggle();
  reject(new Error("outfit transfer failed")); await failed;
  assert.ok([...h.data.values()][0]); assert.equal(h.toggle.busy, false);
  const retry = h.toggle.toggle(); await Promise.resolve();
  assert.ok([...h.data.values()][0]); resolve(); await retry;
  assert.equal([...h.data.values()][0], null);
});
