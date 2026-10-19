"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { drillEndJobs, drillPaths, drillTargets } = require("../src/study.js");
const { fixture, storageKey } = require("./helpers/study-fixture.js");

const settings = jobs => ({ version: 1, enabled: { research: false, drill: true }, stations: [], drillJobs: jobs });
const withJobs = jobs => fixture(new Map([[storageKey, settings(jobs)]]));
const change = (f, id, enabled) => f.handlers["study-drill-job"]({ token: f.status().token, id, enabled });
const selected = f => f.status().drillJobs.filter(job => job.selected).map(job => job.id);

test("end jobs are leaf nodes and selected paths include only their shared prerequisites", () => {
  const f = fixture();
  assert.deepEqual(drillEndJobs(f.zy), [3, 5, 9, 16]);
  assert.deepEqual([...drillPaths(f.zy, [16])].sort((a, b) => a - b), [1, 2, 4, 8, 16]);
  assert.deepEqual([...drillPaths(f.zy, [16, 9])].sort((a, b) => a - b), [1, 2, 4, 8, 9, 16]);
  assert.deepEqual([...drillPaths(f.zy, [])], []);
  assert.deepEqual([...drillPaths(f.zy, [2, 99])], [], "only real end jobs can be selected");
  assert.equal(drillPaths(f.zy).size, Object.keys(f.classes).length);
});

test("paths include all prerequisite fields and safely traverse shared or cyclic dependencies", () => {
  const f = fixture(); f.classes[17] = { 0: 17, 3: 6, 4: 1, 10: 16, 11: 3, 12: 5 };
  assert.deepEqual(drillEndJobs(f.zy), [9, 17]);
  assert.equal(drillPaths(f.zy, [17]).has(3), true);
  assert.equal(drillPaths(f.zy, [17]).has(5), true);
  f.classes[1][11] = 8;
  assert.equal(drillPaths(f.zy, [17]).size, 8);
});

test("automatic target filtering preserves unlock limits, locks and manual full-cap choices", () => {
  const f = fixture(), read = (jobs, auto = true) => drillTargets(f.zy, f.save, 20, id => id === 1 ? 5 : 10, () => f.familyOpen, auto, jobs);
  assert.deepEqual(read([16]).map(t => [t.id, t.maximum]), [[1, 5]]);
  f.save.setAt(5, 1, 5, 0); f.save.setAt(10, 2, 5, 0);
  assert.deepEqual(read([16]).map(t => [t.id, t.maximum]), [[4, 10]]);
  assert.deepEqual(read([]), []);
  assert.equal(read([], false).find(t => t.id === 3).maximum, 20);
  f.save.setAt(10, 4, 5, 0); f.save.setAt(10, 8, 5, 0); f.familyOpen = false;
  assert.deepEqual(read([16]), []);
  f.familyOpen = true; assert.deepEqual(read([16]).map(t => [t.id, t.maximum]), [[16, 1]]);
});

test("a selected branch trains only its ancestors and terminal job, then stays idle", async () => {
  const f = withJobs([16]); await f.ready(); await f.tick();
  for (const [id, limit] of [[1, 1], [2, 2], [4, 2], [8, 2], [16, 1]]) {
    assert.equal(f.queue(1), id);
    for (let level = 1; level <= limit; level++) f.complete(1);
    assert.equal(f.queue(1), 0); assert.equal(f.save.getAt(id, 5, 0), limit);
    await f.tick();
  }
  assert.equal(f.queue(1), 0); assert.match(f.status().message, /Selected jobs unlocked/);
  for (const id of [3, 5, 9]) assert.equal(f.save.getAt(id, 5, 0), 0);
});

test("legacy settings select every end job and explicit choices persist across reloads", async () => {
  const data = settings(); delete data.drillJobs;
  const stored = new Map([[storageKey, data]]), f = fixture(stored);
  await f.ready(); await f.tick(); assert.deepEqual(selected(f), [3, 5, 9, 16]);
  change(f, 3, false); change(f, 5, false); change(f, 9, false); await f.tick();
  assert.deepEqual(selected(f), [16]); assert.deepEqual(stored.get(storageKey).drillJobs, [16]);
  const reloaded = fixture(stored); await reloaded.ready(); await reloaded.tick();
  assert.deepEqual(selected(reloaded), [16]);
});

test("unchecking a path refunds its active automatic order and preserves progress", async () => {
  const f = withJobs([3, 16]); f.save.setAt(1, 1, 5, 0); f.save.setAt(2, 2, 5, 0);
  await f.ready(); await f.tick(); assert.equal(f.queue(1), 3);
  f.save.setAt(25, 3, 14, 0); const money = f.save.getAt(1, 2, 0);
  change(f, 3, false); await f.tick(); assert.equal(f.queue(1), 4);
  assert.equal(f.save.getAt(1, 2, 0), money, "refund funds the new job");
  assert.equal(f.save.getAt(3, 14, 0), 25); assert.equal(f.save.getAt(3, 15, 0), 0);
});

test("shared ancestors keep running; removing every selection stops automatic spending", async () => {
  const f = withJobs([9, 16]); await f.ready(); await f.tick(); const money = f.save.getAt(1, 2, 0);
  change(f, 9, false); await f.tick(); assert.equal(f.queue(1), 1); assert.equal(f.save.getAt(1, 2, 0), money);
  change(f, 16, false); await f.tick(); assert.equal(f.queue(1), 0); assert.equal(f.save.getAt(1, 2, 0), money + 100);
  await f.tick(); assert.equal(f.queue(1), 0); assert.match(f.status().message, /No end jobs selected/);
});

test("native completion cannot repeat an unchecked automatic path before the next tick", async () => {
  const f = withJobs([16]); f.save.setAt(1, 1, 5, 0); await f.ready(); await f.tick();
  assert.equal(f.queue(1), 2); const money = f.save.getAt(1, 2, 0);
  change(f, 16, false); f.complete(1);
  assert.equal(f.queue(1), 0); assert.equal(f.save.getAt(1, 2, 0), money);
  assert.equal(f.save.getAt(2, 5, 21), 1); await f.tick(); assert.equal(f.queue(1), 0);
});

test("manual jobs outside the selected paths finish their full cap before filtered auto resumes", async () => {
  const f = withJobs([16]); f.save.setAt(1, 1, 5, 0); await f.ready(); await f.tick();
  f.choose(1, 3); assert.equal(f.queue(1), 3);
  change(f, 16, false); await f.tick(); assert.equal(f.queue(1), 3);
  for (let level = 1; level <= 3; level++) { f.complete(1); await f.tick(); }
  assert.equal(f.save.getAt(3, 5, 0), 3); assert.equal(f.queue(1), 0);
  change(f, 16, true); await f.tick(); assert.equal(f.queue(1), 2);
});

test("selection changes wait through blocked gameplay and cancel excluded orders after reload", async () => {
  const f = withJobs([16]); await f.ready(); await f.tick(); f.g.游戏暂停 = true;
  change(f, 16, false); await f.tick(); assert.equal(f.queue(1), 1);
  const reload = fixture(f.stored); reload.save.setAt(1, 2, 3, 21); reload.save.setAt(1, 1, 15, 0);
  await reload.ready(); await reload.tick(); assert.equal(reload.queue(1), 0);
  assert.deepEqual(selected(reload), []);
});

test("multiple drill stations follow selected paths without reserving unrelated jobs", async () => {
  const f = withJobs([9, 16]); f.add(9);
  for (const [id, level] of [[1, 1], [2, 2], [4, 2]]) f.save.setAt(level, id, 5, 0);
  await f.ready(); await f.tick(); assert.deepEqual([f.queue(1), f.queue(2)], [8, 9]);
  change(f, 9, false); await f.tick(); assert.deepEqual([f.queue(1), f.queue(2)], [8, 0]);
});

test("invalid and stale messages cannot alter selections, including across campaigns", async () => {
  const f = withJobs([16]); await f.ready(); await f.tick(); const token = f.status().token;
  for (const data of [{id:2,enabled:true},{id:99,enabled:true},{id:16,enabled:"no"},{id:16,enabled:false,token:"stale"}]) {
    f.handlers["study-drill-job"]({token,...data});
  }
  await f.tick(); assert.deepEqual(selected(f), [16]);
  f.loop.leave(); f.handlers["study-drill-job"]({token,id:16,enabled:false}); await f.tick();
  assert.deepEqual(selected(f), [16]);
  f.save.setAt(87654321, 0, 1, 0); await f.tick();
  f.handlers["study-drill-job"]({token,id:3,enabled:false}); await f.tick();
  assert.deepEqual(selected(f), [3, 5, 9, 16]);
  f.save.setAt(12345678, 0, 1, 0); await f.tick(); assert.deepEqual(selected(f), [16]);
});

test("malformed saved selections fail closed instead of training every job", async () => {
  for (const jobs of ["all", ["16"], [16, 16], [0]]) {
    const f = withJobs(jobs); await f.ready(); await f.tick();
    assert.equal(f.status().error, true); assert.equal(f.queue(1), 0);
  }
});
