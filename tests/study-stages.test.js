"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { researchTargets, nextResearch } = require("../src/study.js");
const { fixture, storageKey } = require("./helpers/study-fixture.js");

const order = [34, 32, 41, 36, 31, 33, 35, 43, 42, 44, 37, 38, 39];
function stages(stored) {
  const f = fixture(stored);
  f.methods.get("科技等级上限").block._RunAndBlock = () => {
    const [id, level] = f.methods.get("科技等级上限").params;
    return f.research[id]?.[2] === "基础" ? 1 : Math.min(299, (level + 1) * 60 - 1);
  };
  f.save.setAt(1, 11, 5, 1);
  f.save.setAt(1e9, 1, 2, 0);
  return f;
}
async function ready(f) { await f.ready(); f.enabled("drill", false); await f.tick(); }
function levels(f, level) { for (const id of [...order, 40]) f.save.setAt(level, id, 4, 0); }

test("main unlocks and Research Tech precede the lowest unfinished 60-level stage", () => {
  const f = stages(); levels(f, 59);
  f.save.setAt(18, 38, 4, 0); f.save.setAt(18, 39, 4, 0); f.save.setAt(0, 2, 4, 0);
  const list = researchTargets(f.kj, f.save, () => 119);
  assert.deepEqual(list.map(t => [t.id, t.maximum]), [[2, 1], [40, 119], [38, 59], [39, 59]]);
  assert.equal(nextResearch(list, id => [2, 40, 38].includes(id)).id, 39);
  assert.equal(nextResearch(list, () => true), undefined);
  const manual = researchTargets(f.kj, f.save, () => 119, false);
  assert.equal(manual.find(t => t.id === 34).maximum, 119);
});

test("stage selection uses displayed levels at every boundary and keeps priority within a stage", () => {
  const f = stages(); levels(f, 299);
  for (const [level, goal] of [[0, 59], [58, 59], [59, 119], [118, 119], [119, 179], [178, 179], [179, 239], [238, 239], [239, 299], [298, 299]]) {
    f.save.setAt(level, 38, 4, 0);
    assert.equal(researchTargets(f.kj, f.save, () => 299)[0].maximum, goal);
  }
  levels(f, 119); f.save.setAt(58, 34, 4, 0); f.save.setAt(0, 38, 4, 0);
  assert.deepEqual(researchTargets(f.kj, f.save, () => 119).map(t => t.id), [34, 38]);
  f.save.setAt(59, 34, 4, 0);
  assert.deepEqual(researchTargets(f.kj, f.save, () => 119).map(t => t.id), [38]);
  f.save.setAt(0, 22, 4, 0);
  assert.deepEqual(researchTargets(f.kj, f.save, () => 119).map(t => t.id), [22, 34], "locked lower-stage trees cannot block available work");
});

test("Research Tech completes the full cap, then every other tree completes 60 before any reaches 120", async () => {
  const f = stages(); await ready(f);
  assert.equal(f.queue(0), 40);
  for (let level = 1; level <= 119; level++) {
    f.complete(0); assert.equal(f.queue(0), level < 119 ? 40 : 0);
  }
  for (const goal of [59, 119]) for (const id of order) {
    await f.tick(); assert.equal(f.queue(0), id);
    while (f.save.getAt(id, 4, 0) < goal) {
      const money = f.save.getAt(1, 2, 0); f.complete(0);
      const level = f.save.getAt(id, 4, 0);
      assert.equal(f.queue(0), level < goal ? id : 0);
      assert.equal(f.save.getAt(1, 2, 0), money - (level < goal ? 100 + level * 10 : 0));
      assert.equal(f.save.getAt(1, 5, 21), 1, "native Repeat preference is restored");
    }
  }
  await f.tick(); assert.equal(f.queue(0), 0);
});

test("Repeat off, copper shortages and reloads retain the current stage but release it at the boundary", async () => {
  const f = stages(); levels(f, 59); f.save.setAt(119, 40, 4, 0); f.save.setAt(57, 39, 4, 0);
  f.save.setAt(0, 1, 5, 21); await ready(f);
  assert.equal(f.queue(0), 39); f.complete(0);
  f.save.setAt(0, 1, 2, 0); await f.tick(); assert.equal(f.queue(0), 0);
  const reload = stages(f.stored); levels(reload, 59); reload.save.setAt(119, 40, 4, 0); reload.save.setAt(58, 39, 4, 0);
  reload.save.setAt(0, 1, 5, 21); await ready(reload);
  assert.equal(reload.queue(0), 39); reload.complete(0); await reload.tick();
  assert.equal(reload.queue(0), 34, "the last tree must release its pin instead of starting the next stage first");
  assert.equal(reload.save.getAt(1, 5, 21), 0);
});

test("legacy automatic orders ahead of the minimum stage finish their paid level and then catch up", async () => {
  const stored = new Map([[storageKey, { version: 1, enabled: { research: true, drill: false }, stations: [
    { id: 1, type: 1, owner: 11, kind: 8, target: 36, mode: "auto", level: 59 },
  ] }]]);
  const f = stages(stored); levels(f, 119); f.save.setAt(101, 36, 4, 0); f.save.setAt(18, 38, 4, 0);
  f.save.setAt(36, 1, 3, 21); f.save.setAt(1, 36, 13, 0); await ready(f);
  assert.equal(f.queue(0), 36);
  const money = f.save.getAt(1, 2, 0); f.complete(0);
  assert.equal(f.save.getAt(36, 4, 0), 102); assert.equal(f.queue(0), 0); assert.equal(f.save.getAt(1, 2, 0), money);
  await f.tick(); assert.equal(f.queue(0), 38);
});

test("multiple stations finish the minimum stage together before any starts the next", async () => {
  const f = stages(); f.add(8); f.save.setAt(1, 13, 5, 1);
  levels(f, 59); f.save.setAt(119, 40, 4, 0); f.save.setAt(58, 38, 4, 0); f.save.setAt(57, 39, 4, 0);
  await ready(f); assert.deepEqual([f.queue(0), f.queue(2)], [38, 39]);
  f.complete(0); await f.tick(); assert.equal(f.queue(0), 0, "another station still needs to finish this stage");
  f.complete(2); f.complete(2); await f.tick();
  assert.deepEqual([f.queue(0), f.queue(2)], [34, 32]);
});

test("an academy upgrade preserves the current stage boundary and then unlocks more Research bonus", async () => {
  const f = stages(); f.save.setAt(0, 11, 5, 1); f.save.setAt(59, 40, 4, 0); f.save.setAt(57, 34, 4, 0);
  await ready(f); assert.equal(f.queue(0), 34);
  f.save.setAt(1, 11, 5, 1); f.complete(0); assert.equal(f.queue(0), 34);
  f.complete(0); assert.equal(f.queue(0), 0);
  await f.tick(); assert.equal(f.queue(0), 40);
  for (let i = 0; i < 60; i++) f.complete(0);
  await f.tick(); assert.equal(f.queue(0), 32);
});

test("manual choices including a higher-stage tree retain the native cap before auto catches up", async () => {
  for (const repeat of [0, 1]) {
    const f = stages(); f.save.setAt(119, 40, 4, 0); f.save.setAt(59, 38, 4, 0); await ready(f);
    assert.equal(f.queue(0), 34); f.save.setAt(repeat, 1, 5, 21); f.choose(0, 38);
    assert.equal(f.queue(0), 38);
    for (let level = 60; level <= 119; level++) {
      f.complete(0); assert.equal(f.save.getAt(38, 4, 0), level); await f.tick();
      assert.equal(f.queue(0), level < 119 ? 38 : 34);
    }
    assert.equal(f.save.getAt(1, 5, 21), repeat);
  }
});

test("selecting the active automatic tree manually lets it cross a stage boundary", async () => {
  const f = stages(); f.save.setAt(119, 40, 4, 0); f.save.setAt(58, 34, 4, 0); await ready(f);
  f.choose(0, 34); f.complete(0);
  assert.equal(f.save.getAt(34, 4, 0), 59); assert.equal(f.queue(0), 34);
  await f.tick(); assert.match(f.status().message, /Manual/);
  for (let level = 60; level <= 119; level++) f.complete(0);
  await f.tick(); assert.equal(f.queue(0), 32);
});

test("disabling automation lets the active stage finish without starting another", async () => {
  const f = stages(); f.save.setAt(119, 40, 4, 0); f.save.setAt(58, 34, 4, 0); await ready(f);
  f.enabled("research", false); f.complete(0); await f.tick();
  assert.equal(f.queue(0), 0); assert.equal(f.save.getAt(34, 4, 0), 59); assert.equal(f.save.getAt(1, 5, 21), 1);
});

test("partial strikes and native errors restore Repeat at a research stage boundary", async () => {
  for (const throws of [false, true]) {
    const f = stages(); f.save.setAt(119, 40, 4, 0); f.save.setAt(58, 34, 4, 0);
    if (throws) f.methods.get("采集核心碰撞").block._RunAndBlock = () => {
      assert.equal(f.save.getAt(1, 5, 21), 0); throw Error("Native failure");
    };
    await ready(f);
    if (throws) assert.throws(() => f.complete(0), /Native failure/);
    else f.runtime.callFunction("采集核心碰撞", 1, f.tiles[0].uid);
    assert.equal(f.queue(0), 34); assert.equal(f.save.getAt(34, 4, 0), 58); assert.equal(f.save.getAt(1, 5, 21), 1);
  }
});
