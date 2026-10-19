"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { drillTargets, drillUnlockLevel } = require("../src/study.js");
const { fixture, storageKey } = require("./helpers/study-fixture.js");

function unlockFixture(stored) {
  const f = fixture(stored);
  f.methods.get("转职等级要求").block._RunAndBlock = () => f.methods.get("转职等级要求").params[0] === 1 ? 5 : 10;
  f.methods.get("操练等级上限").block._RunAndBlock = () => 20;
  return f;
}
async function ready(f) { f.select(1); await f.ready(); f.enabled("research", false); await f.tick(); }

test("automatic limits come from native promotion requirements; terminal jobs need one unlock level", () => {
  const f = unlockFixture(), requirement = id => id === 1 ? 5 : 10;
  assert.equal(drillUnlockLevel(f.zy, 1, requirement), 5);
  assert.equal(drillUnlockLevel(f.zy, 2, requirement), 10);
  assert.equal(drillUnlockLevel(f.zy, 16, requirement), 1);
  f.classes[17] = { 0: 17, 3: 6, 10: 16, 11: 3, 12: 5 };
  for (const id of [16, 3, 5]) assert.equal(drillUnlockLevel(f.zy, id, requirement), 10);
  assert.equal(drillUnlockLevel(f.zy, 1, () => NaN), 0);
  const list = drillTargets(f.zy, f.save, 3, requirement, () => true);
  assert.equal(list[0].maximum, 3, "building cap still applies");
  assert.equal(drillTargets(f.zy, f.save, 20, requirement, () => true, false)[0].maximum, 20);
});

test("native repeat reaches level 5, pays no sixth level, then auto switches jobs", async () => {
  const f = unlockFixture(); await ready(f);
  for (let level = 1; level <= 5; level++) {
    const money = f.save.getAt(1, 2, 0); f.complete(1);
    assert.equal(f.save.getAt(1, 5, 0), level);
    assert.equal(f.queue(1), level < 5 ? 1 : 0);
    assert.equal(f.save.getAt(1, 2, 0), money - (level < 5 ? 100 + level * 10 : 0));
    assert.equal(f.save.getAt(2, 5, 21), 1);
  }
  await f.tick(); assert.equal(f.queue(1), 2);
  assert.equal(f.calls.filter(c => c[0] === "职业操练" && c[1] === 1).length, 1);
});

test("later prerequisite jobs stop at level 10 and terminal jobs stop after unlocking", async () => {
  const f = unlockFixture(); f.save.setAt(5, 1, 5, 0); await ready(f);
  assert.equal(f.queue(1), 2);
  for (let level = 1; level <= 10; level++) f.complete(1);
  assert.equal(f.queue(1), 0); assert.equal(f.save.getAt(2, 5, 0), 10);
  await f.tick(); assert.equal(f.queue(1), 3);
  f.complete(1); assert.equal(f.queue(1), 0); assert.equal(f.save.getAt(3, 5, 0), 1);
  await f.tick(); assert.equal(f.queue(1), 4);
});

test("Repeat off and copper shortages resume the same job only until its unlock level", async () => {
  const f = unlockFixture(); f.save.setAt(0, 2, 5, 21); await ready(f);
  for (let level = 1; level <= 5; level++) {
    f.complete(1); assert.equal(f.queue(1), 0);
    f.save.setAt(0, 1, 2, 0); await f.tick(); assert.equal(f.queue(1), 0);
    f.save.setAt(100000, 1, 2, 0); await f.tick();
    assert.equal(f.queue(1), level < 5 ? 1 : 2);
    assert.equal(f.save.getAt(2, 5, 21), 0);
  }
});

test("building upgrades resume an unmet unlock requirement without overtraining finished jobs", async () => {
  const f = unlockFixture();
  f.methods.get("操练等级上限").block._RunAndBlock = () => f.save.getAt(12, 5, 1) ? 20 : 3;
  await ready(f); for (let i = 0; i < 3; i++) f.complete(1);
  await f.tick(); assert.equal(f.queue(1), 0);
  f.save.setAt(1, 12, 5, 1); await f.tick(); assert.equal(f.queue(1), 1);
  f.complete(1); f.complete(1); await f.tick(); assert.equal(f.queue(1), 2);
  assert.equal(f.save.getAt(1, 5, 0), 5);
});

test("manual choices above unlock thresholds replace auto orders and train to the native cap", async () => {
  const f = unlockFixture(); f.save.setAt(5, 1, 5, 0); await ready(f);
  assert.equal(f.queue(1), 2); f.choose(1, 1); assert.equal(f.queue(1), 1);
  for (let level = 6; level <= 20; level++) {
    f.complete(1); assert.equal(f.save.getAt(1, 5, 0), level);
    assert.equal(f.queue(1), level < 20 ? 1 : 0);
  }
  await f.tick(); assert.equal(f.queue(1), 2);
});

test("manual terminal jobs resume beyond their unlock level with Repeat off", async () => {
  const f = unlockFixture(); f.save.setAt(5, 1, 5, 0); f.save.setAt(10, 2, 5, 0); await ready(f);
  f.choose(1, 3); f.save.setAt(0, 2, 5, 21);
  for (let i = 0; i < 3; i++) { f.complete(1); await f.tick(); assert.equal(f.queue(1), 3); }
  assert.match(f.status().message, /Drill: Manual/);
});

test("saved auto orders already beyond the unlock level are refunded without another level", async () => {
  const stored = new Map([[storageKey, { version: 1, enabled: { research: false, drill: true }, stations: [
    { id: 2, type: 11, owner: 12, kind: 9, target: 1, mode: "auto", level: 0 },
  ] }]]);
  const f = unlockFixture(stored);
  f.save.setAt(1, 2, 3, 21); f.save.setAt(1, 1, 15, 0); f.save.setAt(8, 1, 5, 0); f.save.setAt(75, 1, 14, 0);
  await ready(f);
  assert.equal(f.queue(1), 2); assert.equal(f.save.getAt(1, 2, 0), 100080);
  assert.equal(f.save.getAt(1, 5, 0), 8); assert.equal(f.save.getAt(1, 14, 0), 75); assert.equal(f.save.getAt(1, 15, 0), 0);
});

test("saved automatic ownership survives reload and stops at the next unlock boundary", async () => {
  const stored = new Map(), f = unlockFixture(stored); await ready(f);
  const reload = unlockFixture(stored);
  reload.save.setAt(1, 2, 3, 21); reload.save.setAt(1, 1, 15, 0); reload.save.setAt(4, 1, 5, 0);
  await ready(reload); reload.complete(1);
  assert.equal(reload.queue(1), 0); assert.equal(reload.save.getAt(1, 5, 0), 5);
  await reload.tick(); assert.equal(reload.queue(1), 2);
});

test("turning auto drill off still bounds the active automatic job and does not schedule another", async () => {
  const f = unlockFixture(); await ready(f); f.enabled("drill", false);
  for (let i = 0; i < 5; i++) f.complete(1);
  await f.tick(); assert.equal(f.queue(1), 0); assert.equal(f.save.getAt(1, 5, 0), 5);
  assert.equal(f.save.getAt(2, 5, 21), 1);
});

test("partial work and thrown native errors restore the user's Repeat setting", async () => {
  for (const throws of [false, true]) {
    const f = unlockFixture(); f.save.setAt(4, 1, 5, 0);
    if (throws) f.methods.get("采集核心碰撞").block._RunAndBlock = () => {
      assert.equal(f.save.getAt(2, 5, 21), 0); throw Error("Native failure");
    };
    await ready(f);
    if (throws) assert.throws(() => f.complete(1), /Native failure/);
    else f.runtime.callFunction("采集核心碰撞", 1, f.tiles[1].uid);
    assert.equal(f.queue(1), 1); assert.equal(f.save.getAt(1, 5, 0), 4); assert.equal(f.save.getAt(2, 5, 21), 1);
  }
});
