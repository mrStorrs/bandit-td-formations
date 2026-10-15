"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../src/formations.js");
const { snapshot, planRestore, Hotkeys } = globalThis.BanditFormations;

const character = (id, x, y = 0) => ({ id, identity: `hero-${id}`, x, y });
function world(characters = [character(1, 0), character(2, 1)]) {
  return { saveId: 12345678, mapId: 1, token: "game-1", characters,
    tiles: Array.from({ length: 5 }, (_, x) => ({ x, y: 0, allowed: true, occupied: characters.some(c => c.x === x), building: 0 })) };
}
function harness() {
  let current = world(), time = 0;
  const data = new Map(), notices = [], applied = [];
  const storage = { getItem: async k => data.get(k), setItem: async (k, v) => data.set(k, v) };
  const keys = new Hotkeys({ context: () => current, now: () => time, storage,
    apply: plan => applied.push(plan), notify: text => notices.push(text) });
  return { keys, data, notices, applied, storage, setWorld: v => { current = v; }, advance: n => { time += n; } };
}

test("saving captures independent positions", () => {
  const current = world(), saved = snapshot(current);
  current.characters[0].x = 4;
  assert.equal(saved.characters[0].x, 0);
});
test("swaps and cycles are valid while preserving character identities", () => {
  const current = world([character(1, 0), character(2, 1), character(3, 2)]);
  const saved = snapshot(world([character(1, 1), character(2, 2), character(3, 0)]));
  assert.equal(planRestore(saved, current).moves.length, 3);
});
test("new recruits blocking a saved tile stop the whole restore", () => {
  assert.throws(() => planRestore(snapshot(world([character(1, 1)])), world()), /occupied/);
});
test("missing, renamed, or replaced characters are skipped", () => {
  const saved = snapshot(world([character(1, 1), character(2, 2), character(3, 3)]));
  const current = world([character(1, 0), { ...character(2, 4), identity: "replacement" }]);
  const plan = planRestore(saved, current);
  assert.equal(plan.skipped, 2);
  assert.deepEqual(plan.moves.map(m => m.id), [1]);
});
test("unavailable tiles and malformed presets fail before applying anything", () => {
  const current = world(), saved = snapshot(world([character(1, 4)]));
  current.tiles[4].allowed = false;
  assert.throws(() => planRestore(saved, current), /no longer available/);
  for (const bad of [null, {}, { ...saved, mapId: 2 }, { ...saved, characters: [saved.characters[0], saved.characters[0]] },
    { ...saved, characters: [{ ...saved.characters[0], x: NaN }] }]) {
    assert.throws(() => planRestore(bad, current));
  }
});
test("a stationary survivor also blocks another character's target", () => {
  const current = world();
  const saved = snapshot(world([character(1, 1), { ...character(2, 3), identity: "old" }]));
  assert.throws(() => planRestore(saved, current), /occupied/);
});
test("building occupants and non-character obstacles are protected", () => {
  const current = world([character(1, 0)]), saved = snapshot(world([character(1, 3)]));
  Object.assign(current.tiles[3], { building: 10, buildingOccupant: 9 });
  assert.throws(() => planRestore(saved, current), /building slot/);
  Object.assign(current.tiles[3], { building: 0, buildingOccupant: 0, occupied: true });
  assert.throws(() => planRestore(saved, current), /occupied/);
});
test("each of the four slots saves once after a real-time hold and never recalls on release", async () => {
  const h = harness();
  for (let slot = 1; slot <= 4; slot++) {
    h.keys.key("down", slot); h.advance(999); await h.keys.tick();
    assert.equal(h.data.size, slot - 1);
    h.advance(1); await h.keys.tick();
    h.advance(5000); await h.keys.tick(); await h.keys.key("up", slot);
    assert.equal(h.data.size, slot);
  }
  assert.equal(h.applied.length, 0);
  assert.equal(h.notices.length, 4);
});
test("tap recalls on release; an empty slot does not move anyone", async () => {
  const h = harness();
  h.keys.key("down", 1); assert.equal(h.notices.length, 0);
  await h.keys.key("up", 1); assert.match(h.notices[0], /empty/);
  h.keys.key("down", 1); h.advance(1001); await h.keys.key("up", 1);
  h.keys.key("down", 1); await h.keys.key("up", 1);
  assert.equal(h.applied.length, 1);
});
test("repeated down events do not restart the hold", async () => {
  const h = harness(); h.keys.key("down", 2); h.advance(700); h.keys.key("down", 2);
  h.advance(300); await h.keys.tick(); assert.equal(h.data.size, 1);
});
test("focus loss, overlapping keys, menus, and map changes cancel a hold", async () => {
  for (const cancel of [h => h.keys.cancel(), h => h.keys.key("down", 2), h => h.setWorld(null),
    h => h.setWorld({ ...world(), token: "another-map" })]) {
    const h = harness(); h.keys.key("down", 1); cancel(h); h.advance(2000);
    await h.keys.tick(); await h.keys.key("up", 1); assert.equal(h.data.size, 0);
  }
});
test("switching maps while storage is loading cannot apply an old formation", async () => {
  const h = harness(); let resolve;
  h.storage.getItem = () => new Promise(r => { resolve = r; });
  h.keys.key("down", 1); const pending = h.keys.key("up", 1);
  h.setWorld({ ...world(), token: "other" }); resolve(snapshot(world())); await pending;
  assert.equal(h.applied.length, 0);
});
test("storage failures report failure without saying saved", async () => {
  const h = harness(); h.storage.setItem = async () => { throw new Error("disk full"); };
  h.keys.key("down", 1); h.advance(1000); await h.keys.tick();
  assert.deepEqual(h.notices, ["disk full"]); assert.equal(h.keys.busy, false);
});
