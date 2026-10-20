"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../src/formations.js");
require("../src/buildings.js");
const { footprint, snapshotBuildings, planBuildings, buildingFormation, Hotkeys } = globalThis.BanditFormations;
const building = (id, x, y = 1, size = 1) => ({ id, type: id + 10, x, y, size, movable: true, occupant: 0 });
function world(buildings = [building(1, 1), building(2, 2)], width = 10, height = 10) {
  const tiles = [];
  for (let y = 1; y <= height; y++) for (let x = 1; x <= width; x++) {
    const owner = buildings.find(b => footprint(b).some(c => c.x === x && c.y === y));
    tiles.push({ x, y, allowed: true, occupied: !!owner, building: owner?.id || 0 });
  }
  return { saveId: 12345678, mapId: 28, token: "map-28", buildings, tiles };
}
const tile = (current, x, y = 1) => current.tiles.find(t => t.x === x && t.y === y);

test("building footprints use native 1x1, 2x2 corner, and 3x3 centered anchors", () => {
  assert.deepEqual(footprint({ x: 2, y: 2, size: 1 }), [{ x: 2, y: 2 }]);
  assert.deepEqual(footprint({ x: 2, y: 2, size: 2 }), [
    { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 3 },
  ]);
  const large = footprint({ x: 2, y: 2, size: 3 });
  assert.equal(large.length, 9); assert.deepEqual(large[0], { x: 1, y: 1 }); assert.deepEqual(large[8], { x: 3, y: 3 });
  assert.throws(() => footprint({ size: 4 }), /unsupported/);
});
test("building snapshots copy positions and types, exclude locked buildings, and allow occupied buildings to be saved", () => {
  const current = world(); current.buildings[0].occupant = 7; current.buildings[1].movable = false;
  const saved = snapshotBuildings(current); current.buildings[0].x = 9;
  assert.equal(saved.version, 2); assert.equal("mapId" in saved, false);
  assert.deepEqual(saved.buildings, [{ id: 1, type: 11, x: 1, y: 1 }]);
  assert.throws(() => snapshotBuildings(world([])), /No completed/);
});
test("swaps and longer cycles are fully planned with an empty buffer and leave input untouched", () => {
  for (const targets of [[2, 1], [2, 3, 1]]) {
    const current = world(targets.map((_, i) => building(i + 1, i + 1)));
    const before = JSON.stringify(current);
    const saved = snapshotBuildings(world(targets.map((x, i) => building(i + 1, x))));
    const plan = planBuildings(saved, current);
    assert.equal(plan.moves.length, targets.length); assert.equal(plan.steps.length, targets.length + 1);
    assert.equal(JSON.stringify(current), before);
    const positions = new Map(current.buildings.map(b => [b.id, { x: b.x, y: b.y }]));
    for (const step of plan.steps) {
      assert.deepEqual(step.from, positions.get(step.id));
      assert.ok(![...positions.values()].some(p => p.x === step.x && p.y === step.y));
      positions.set(step.id, { x: step.x, y: step.y });
    }
    assert.deepEqual([...positions.values()].map(p => p.x), targets);
  }
});
test("dependency chains move the blocking building first without a buffer", () => {
  const plan = planBuildings(snapshotBuildings(world([building(1, 2), building(2, 3)])), world());
  assert.deepEqual(plan.steps.map(s => s.id), [2, 1]);
});
test("2x2 swaps reserve all four cells and 3x3 buildings may move across part of their old footprint", () => {
  const current = world([building(1, 1, 1, 2), building(2, 3, 1, 2)]);
  const saved = snapshotBuildings(world([building(1, 3, 1, 2), building(2, 1, 1, 2)]));
  const plan = planBuildings(saved, current);
  assert.equal(plan.steps.length, 3);
  assert.ok(plan.steps[0].x >= 5 || plan.steps[0].y >= 3);
  const large = world([building(1, 3, 3, 3)]);
  const target = snapshotBuildings(world([building(1, 4, 3, 3)]));
  assert.equal(planBuildings(target, large).steps.length, 1);
});
test("locked terrain, characters, facilities, and unknown obstacles block a target before any moves", () => {
  const saved = snapshotBuildings(world([building(1, 3), building(2, 4)]));
  for (const block of [{ allowed: false }, { character: true }, { facility: true }, { occupied: true }]) {
    const current = world(); Object.assign(tile(current, 4), block);
    const before = JSON.stringify(current);
    assert.throws(() => planBuildings(saved, current), /blocked/);
    assert.equal(JSON.stringify(current), before);
  }
});
test("all footprint cells are checked for terrain and overlap", () => {
  const current = world([building(1, 2, 2, 3)]);
  const saved = snapshotBuildings(world([building(1, 6, 6, 3)]));
  tile(current, 7, 7).allowed = false;
  assert.throws(() => planBuildings(saved, current), /blocked/);
  const overlap = snapshotBuildings(world()); overlap.buildings[1].x = 1;
  assert.throws(() => planBuildings(overlap, world()), /overlap/);
});
test("occupied and unfinished moving buildings stop the restore, while stationary occupants are left alone", () => {
  const saved = snapshotBuildings(world([building(1, 3), building(2, 2)]));
  for (const block of [c => { c.buildings[0].occupant = 8; }, c => { tile(c, 1).character = true; },
    c => { c.buildings[0].movable = false; }]) {
    const current = world(); block(current); assert.throws(() => planBuildings(saved, current), /characters|construction/);
  }
  const current = world(); current.buildings[1].occupant = 8;
  assert.equal(planBuildings(saved, current).moves.length, 1);
});
test("missing or changed building types are skipped, and newer buildings can block their old slots", () => {
  const saved = snapshotBuildings(world([building(1, 3), building(2, 4), building(3, 5)]));
  const current = world(); current.buildings[1].type = 100;
  const plan = planBuildings(saved, current);
  assert.equal(plan.skipped, 2); assert.equal(plan.moves.length, 1);
  const blocked = world([building(1, 1), building(9, 3)]);
  assert.throws(() => planBuildings(saved, blocked), /Another building/);
});
test("a packed cycle needs free space and an inconsistent source is rejected without mutation", () => {
  const current = world(undefined, 2, 1);
  const saved = snapshotBuildings(world([building(1, 2), building(2, 1)], 2, 1));
  assert.throws(() => planBuildings(saved, current), /empty building-sized/);
  const target = snapshotBuildings(world([building(1, 3)]));
  tile(current, 1).building = 0;
  assert.throws(() => planBuildings(target, current), /still updating/);
});
test("building layouts restore across maps but still check destination terrain", () => {
  const saved = snapshotBuildings(world([building(1, 3), building(2, 4)]));
  const current = { ...world(), mapId: 29, token: "map-29" };
  assert.equal(planBuildings(saved, current).moves.length, 2);
  tile(current, 4).allowed = false;
  assert.throws(() => planBuildings(saved, current), /blocked/);
});
test("malformed saves, wrong campaigns, duplicate IDs, and invalid coordinates are rejected", () => {
  const current = world(), saved = snapshotBuildings(current);
  for (const invalid of [null, {}, { ...saved, saveId: 1 }, { ...saved, version: 3 },
    { ...saved, buildings: [] }, { ...saved, buildings: [saved.buildings[0], saved.buildings[0]] },
    ...[0, NaN, 1.5, "3"].map(x => ({ ...saved, buildings: [{ ...saved.buildings[0], x }] }))]) {
    assert.throws(() => planBuildings(invalid, current));
  }
});
test("building holds and taps share four persistent campaign slots and cancel a pending read on map changes", async () => {
  let current = world(), clock = 0, applies = 0;
  const stored = new Map(), notices = [];
  const storage = { getItem: async k => stored.get(k), setItem: async (k, v) => stored.set(k, v) };
  const keys = new Hotkeys({ formation: buildingFormation, context: () => current, storage,
    now: () => clock, notify: text => notices.push(text), apply: () => { applies++; } });
  for (let slot = 1; slot <= 4; slot++) {
    keys.key("down", slot); clock += 1000; await keys.tick(); await keys.key("up", slot);
    assert.ok(stored.has(`cjs-formations:buildings:v2:12345678:${slot}`));
  }
  assert.equal(applies, 0); assert.equal(stored.size, 4);
  current = { ...current, token: "map-29", mapId: 29 };
  keys.key("down", 1); await keys.key("up", 1); assert.equal(applies, 1);
  keys.key("down", 1); clock += 1000; await keys.tick(); await keys.key("up", 1);
  assert.equal(stored.size, 4, "saving on another map replaces the shared slot");
  let resolve; storage.getItem = () => new Promise(r => { resolve = r; });
  keys.key("down", 1); const pending = keys.key("up", 1);
  const saved = snapshotBuildings(current); current = { ...current, token: "new-map", mapId: 30 };
  resolve(saved); await pending; assert.equal(applies, 1);
});

function migrationHarness(entries = []) {
  let current = world();
  const stored = new Map(entries), notices = [], applied = [];
  const storage = { getItem: async k => stored.get(k), setItem: async (k, v) => stored.set(k, v),
    keys: async () => [...stored.keys()] };
  const keys = new Hotkeys({ formation: buildingFormation, context: () => current, storage,
    notify: text => notices.push(text), apply: plan => applied.push(plan) });
  return { stored, storage, notices, applied, keys, setMap: mapId => { current = { ...current, mapId, token: `map-${mapId}` }; },
    async tap(slot = 1) { keys.key("down", slot); await keys.key("up", slot); } };
}
const oldKey = (map, slot = 1) => `cjs-formations:buildings:v1:12345678:${map}:${slot}`;
const sharedKey = slot => `cjs-formations:buildings:v2:12345678:${slot}`;
const legacy = (mapId, x = 3) => ({ ...snapshotBuildings(world([building(1, x)])), version: 1, mapId });

test("old slots migrate from the current map and the shared choice wins on every later map", async () => {
  const first = legacy(28), second = legacy(29, 4);
  const h = migrationHarness([[oldKey(28), first], [oldKey(29), second]]);
  await h.tap();
  assert.deepEqual(h.stored.get(sharedKey(1)), { version: 2, saveId: 12345678, buildings: first.buildings });
  h.setMap(29); await h.tap();
  assert.deepEqual(h.applied.map(p => p.moves[0].x), [3, 3]);
  assert.deepEqual(h.stored.get(oldKey(28)), first);
  assert.deepEqual(h.stored.get(oldKey(29)), second, "legacy copies remain intact");
});
test("a unique old layout is found from another map, ignoring other campaigns and slots", async () => {
  const saved = legacy(29);
  const h = migrationHarness([[oldKey(29), saved], [oldKey(28, 2), legacy(28, 4)],
    ["cjs-formations:buildings:v1:99999999:28:1", { ...legacy(28, 5), saveId: 99999999 }]]);
  await h.tap();
  assert.equal(h.applied[0].moves[0].x, 3);
  assert.equal(h.stored.get(sharedKey(1)).version, 2);
  h.setMap(30); await h.tap();
  assert.equal(h.applied.length, 2);
});
test("identical old layouts on different maps migrate without a conflict regardless of building order", async () => {
  const first = { ...legacy(29), buildings: snapshotBuildings(world()).buildings };
  const second = { ...first, mapId: 30, buildings: [...first.buildings].reverse() };
  const h = migrationHarness([[oldKey(30), second], [oldKey(29), first]]);
  await h.tap();
  assert.equal(h.applied.length, 1);
  assert.ok(h.stored.has(sharedKey(1)));
});
test("conflicting old layouts require choosing their original map without overwriting anything", async () => {
  const h = migrationHarness([[oldKey(29), legacy(29)], [oldKey(30), legacy(30, 4)]]);
  await h.tap();
  assert.equal(h.applied.length, 0); assert.equal(h.stored.size, 2);
  assert.match(h.notices.at(-1), /different.*maps.*Shift \+ 1/i);
  h.setMap(30); await h.tap();
  assert.equal(h.stored.get(sharedKey(1)).buildings[0].x, 4);
  assert.equal(h.applied.length, 1);
});
test("empty and malformed legacy slots never create or apply a shared layout", async () => {
  const empty = migrationHarness(); await empty.tap();
  assert.equal(empty.stored.size, 0); assert.match(empty.notices.at(-1), /empty/);
  for (const bad of [{ ...legacy(28), saveId: 11111111 }, { ...legacy(28), mapId: 29 },
    { ...legacy(28), buildings: [{ id: 1, type: 11, x: 0, y: 1 }] }]) {
    const h = migrationHarness([[oldKey(28), bad]]); await h.tap();
    assert.equal(h.applied.length, 0); assert.equal(h.stored.size, 1);
    assert.match(h.notices.at(-1), /Invalid|match/);
  }
});
test("legacy migration stops on storage failure and reports no successful restore", async () => {
  const h = migrationHarness([[oldKey(28), legacy(28)]]);
  h.storage.setItem = async () => { throw Error("disk full"); };
  await h.tap();
  assert.equal(h.applied.length, 0); assert.equal(h.stored.size, 1);
  assert.deepEqual(h.notices, ["disk full"]); assert.equal(h.keys.busy, false);
});
test("map changes during legacy discovery or migration never apply a layout to the new map", async () => {
  for (const phase of ["read", "write"]) {
    const h = migrationHarness([[oldKey(28), legacy(28)]]);
    let release;
    if (phase === "read") {
      h.storage.getItem = async k => k === oldKey(28)
        ? new Promise(resolve => { release = () => resolve(legacy(28)); }) : h.stored.get(k);
    } else {
      h.storage.setItem = (k, v) => new Promise(resolve => {
        release = () => { h.stored.set(k, v); resolve(); };
      });
    }
    const pending = h.tap();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof release, "function");
    h.setMap(29); release(); await pending;
    assert.equal(h.applied.length, 0); assert.equal(h.notices.length, 0);
    assert.equal(h.stored.has(sharedKey(1)), phase === "write");
  }
});
