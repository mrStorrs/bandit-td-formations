"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../src/formations.js");
require("../src/forest.js");
const { ForestLoop, snapshot } = globalThis.BanditFormations;

function fixture() {
  let clock = 0, nativeAuto = true, available = true;
  let current = { saveId: 12345678, mapId: 28, token: "forest-a", blocked: false,
    active: false, ready: false, victories: 0,
    characters: [{ id: 1, identity: "one", x: 1, y: 0, mode: "采矿", priorityX: 4, priorityY: 0 },
      { id: 2, identity: "two", x: 2, y: 0, mode: "自动", priorityX: 0, priorityY: 0 }],
    tiles: [1, 2, 3, 4].map(x => ({ x, y: 0, allowed: true, occupied: false })) };
  const first = snapshot(current);
  const second = { ...first, characters: first.characters.map(c => ({ ...c, x: c.x + 2 })) };
  const storage = new Map([["cjs-formations:v1:12345678:28:1", first], ["cjs-formations:v1:12345678:28:2", second]]);
  const calls = [], notices = [], statuses = [];
  const loop = new ForestLoop({ context: () => current,
    storage: { getItem: async key => storage.get(key) },
    apply: ({ moves }) => {
      for (const move of moves) Object.assign(move.from, { x: move.x, y: move.y });
      calls.push(["formation", ...current.characters.map(c => c.x)]);
    }, summon: () => { calls.push(["summon"]); current.active = true; },
    suspendAuto: () => { const before = nativeAuto; nativeAuto = false; return () => { nativeAuto = before; }; },
    notify: text => notices.push(text), status: text => statuses.push(text), available: () => available,
    now: () => clock,
  });
  return { loop, current, storage, first, second, calls, notices, statuses,
    nativeAuto: () => nativeAuto, setNativeAuto: value => { nativeAuto = value; },
    setContext: value => { current = value; }, available: value => { available = value; },
    tick: () => { clock += 250; return loop.tick(); } };
}

test("default-on cycle restores 1, waits for readiness, restores 2 before summoning, and repeats after victory", async () => {
  const f = fixture(); await f.tick();
  assert.equal(f.loop.enabled, true); assert.equal(f.nativeAuto(), false);
  await f.tick(); assert.deepEqual(f.calls, [["formation", 1, 2]]);
  f.current.ready = true; await f.tick();
  assert.deepEqual(f.calls.slice(-2), [["formation", 3, 4], ["summon"]]);
  for (let i = 0; i < 5; i++) await f.tick();
  assert.equal(f.calls.filter(c => c[0] === "summon").length, 1);
  f.current.active = false; f.current.ready = false; f.current.victories++;
  await f.tick(); assert.deepEqual(f.calls.at(-1), ["formation", 1, 2]);
  f.current.ready = true; await f.tick();
  assert.equal(f.calls.filter(c => c[0] === "summon").length, 2);
});
test("F6 disables the default loop, restores native auto, and resumes in the current fight without summoning twice", async () => {
  const f = fixture(); await f.tick(); f.current.ready = true; await f.tick();
  f.loop.toggle(); await f.tick();
  assert.equal(f.loop.enabled, false); assert.equal(f.nativeAuto(), true);
  assert.equal(f.calls.length, 3);
  f.loop.toggle(); await f.tick();
  assert.equal(f.nativeAuto(), false);
  assert.deepEqual(f.calls.at(-1), ["formation", 3, 4]);
  assert.equal(f.calls.filter(c => c[0] === "summon").length, 1);
});
test("map exits release native auto and never move the new map; returning starts again", async () => {
  const f = fixture(); await f.tick(); f.setContext(null); await f.tick();
  assert.equal(f.nativeAuto(), true); assert.equal(f.statuses.at(-1), null);
  assert.equal(f.calls.length, 1);
  f.current.token = "forest-return"; f.setContext(f.current); await f.tick();
  assert.equal(f.nativeAuto(), false); assert.equal(f.calls.length, 2);
});
test("menus, pause, and manual hotkey operations suspend actions, then allow the cycle to continue", async () => {
  for (const block of [f => { f.current.blocked = true; }, f => f.available(false)]) {
    const f = fixture(); await f.tick(); f.current.ready = true; block(f); await f.tick();
    assert.equal(f.calls.length, 1);
    f.current.blocked = false; f.available(true); await f.tick();
    assert.equal(f.calls.at(-1)[0], "summon");
  }
});
test("missing presets notify once and begin automatically when the user saves them", async () => {
  const f = fixture(); const key = "cjs-formations:v1:12345678:28:2"; f.storage.delete(key);
  await f.tick(); await f.tick(); await f.tick();
  assert.equal(f.calls.length, 0); assert.equal(f.notices.length, 1); assert.equal(f.nativeAuto(), true);
  f.storage.set(key, f.second); f.loop.formationSaved(); await f.tick();
  assert.deepEqual(f.calls, [["formation", 1, 2]]);
});
test("invalid or incomplete presets never summon or move anyone on initial load", async () => {
  for (const change of [f => { f.second.characters[0].identity = "replaced"; },
    f => { f.second.characters.pop(); }, f => { f.second.characters[0].x = 999; },
    f => { f.first.characters = []; }, f => { f.current.tiles[2].occupied = true; }]) {
    const f = fixture(); change(f); f.current.ready = true; await f.tick(); await f.tick();
    assert.equal(f.calls.length, 0); assert.equal(f.notices.length, 1); assert.equal(f.nativeAuto(), true);
  }
});
test("a changed roster or blocked return formation prevents the next summon", async () => {
  for (const change of [f => { f.current.characters[0].identity = "replacement"; },
    f => { f.current.tiles[2].allowed = false; }]) {
    const f = fixture(); await f.tick(); change(f); f.current.ready = true; await f.tick();
    assert.equal(f.calls.length, 1); assert.equal(f.notices.length, 1);
  }
});
test("timeout or cancellation returns to formation 1 and pauses instead of treating it as a win", async () => {
  const f = fixture(); await f.tick(); f.current.ready = true; await f.tick();
  f.current.active = false; await f.tick(); await f.tick();
  assert.deepEqual(f.calls.at(-1), ["formation", 1, 2]);
  assert.match(f.notices.at(-1), /without a win/);
  assert.equal(f.calls.filter(c => c[0] === "summon").length, 1);
});
test("a fight already running at map entry gets formation 2 and is not summoned again", async () => {
  const f = fixture(); f.current.active = true; await f.tick(); await f.tick();
  assert.deepEqual(f.calls, [["formation", 3, 4]]);
  f.current.active = false; f.current.victories++; await f.tick();
  assert.deepEqual(f.calls.at(-1), ["formation", 1, 2]);
});
test("native auto that was already disabled stays disabled when the loop is turned off", async () => {
  const f = fixture(); f.setNativeAuto(false); await f.tick(); f.loop.toggle();
  assert.equal(f.nativeAuto(), false);
});
test("storage failure pauses without moving or summoning", async () => {
  const f = fixture(); f.loop.storage.getItem = async () => { throw new Error("disk unavailable"); };
  await f.tick(); assert.equal(f.calls.length, 0); assert.equal(f.nativeAuto(), true);
  assert.deepEqual(f.notices, ["disk unavailable"]);
});
test("map changes or toggling off while storage is pending cannot apply stale formations", async () => {
  for (const cancel of [f => f.setContext(null), f => f.loop.toggle(),
    f => { f.current.token = "new-save"; }, f => { f.current.blocked = true; }]) {
    const f = fixture(), resolves = [];
    f.loop.storage.getItem = () => new Promise(resolve => resolves.push(resolve));
    const pending = f.tick(); await f.tick();
    assert.equal(resolves.length, 2);
    cancel(f); resolves[0](f.first); resolves[1](f.second); await pending;
    assert.equal(f.calls.length, 0);
    if (!f.current.blocked) assert.equal(f.nativeAuto(), true);
  }
});
test("a failed native summon does not retry every tick", async () => {
  const f = fixture(); await f.tick();
  f.loop.summon = () => { throw new Error("game refused summon"); };
  f.current.ready = true; await f.tick(); await f.tick();
  assert.equal(f.calls.length, 2); assert.deepEqual(f.notices, ["game refused summon"]);
});
