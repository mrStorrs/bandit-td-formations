"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture, settle, storageKey } = require("./helpers/study-fixture.js");

const preferences = (f, id) => f.stored.get(storageKey).settings.find(setting => setting.id === id);
const select = async (f, index) => { f.select(index); await f.tick(); return f.status(); };
const toggle = (f, enabled) => f.handlers["study-enabled"]({ token: f.status().token,
  kind: f.status().station.kind === 8 ? "research" : "drill", enabled });
const job = (f, id, enabled) => f.handlers["study-drill-job"]({ token: f.status().token, id, enabled });

test("no global study panel remains; only the selected research or drill station publishes controls", async () => {
  const f = fixture(); f.select(null); await f.ready(); await f.tick();
  assert.deepEqual(f.status(), { visible: false });
  assert.deepEqual([f.queue(0), f.queue(1)], [40, 1], "automation runs with the popup closed");
  let state = await select(f, 0);
  assert.equal(state.station.kind, 8); assert.equal(state.station.id, 1); assert.deepEqual(state.drillJobs, []);
  assert.match(state.message, /^Research: Auto/); assert.doesNotMatch(state.message, /Drill:/);
  state = await select(f, 1);
  assert.equal(state.station.kind, 9); assert.equal(state.station.id, 2);
  assert.equal(state.drillJobs.length, 4); assert.match(state.message, /^Drill: Auto/);
  f.menus[0].instVars.功能 = "角色"; await f.tick(); assert.equal(f.status().visible, false);
  f.select(0); f.menus[0].instVars.X坐标 += 50; await f.tick(); assert.equal(f.status().visible, false);
});

test("research toggles are independent per station and survive reloads", async () => {
  const f = fixture(); f.add(8); await f.ready(); f.g.游戏暂停 = true;
  const first = await select(f, 0); toggle(f, false); await f.tick();
  assert.equal(f.status().enabled, false);
  const second = await select(f, 2); assert.equal(second.enabled, true); assert.notEqual(second.token, first.token);
  f.g.游戏暂停 = false; await f.tick();
  assert.deepEqual([f.queue(0), f.queue(2)], [0, 40]);
  assert.equal(preferences(f, 1).enabled, false); assert.equal(preferences(f, 3).enabled, true);
  const reload = fixture(f.stored); reload.add(8); await reload.ready(); await reload.tick();
  assert.deepEqual([reload.queue(0), reload.queue(2)], [0, 40]);
  assert.equal((await select(reload, 0)).enabled, false);
  assert.equal((await select(reload, 2)).enabled, true);
});

test("enabling automation after a manual cancellation resumes from the open station popup", async () => {
  for (const index of [0, 1]) {
    const f = fixture(); await f.ready(); await select(f, index);
    f.cancel(index); await f.tick(); await f.tick(); assert.equal(f.queue(index), 0);
    toggle(f, false); await f.tick(); assert.equal(f.queue(index), 0);
    toggle(f, true); await f.tick(); assert.equal(f.queue(index), index === 0 ? 40 : 1);
  }
});

test("drill stations use separate paths and turning one off leaves the other running", async () => {
  const f = fixture(); f.add(9); await f.ready(); f.g.游戏暂停 = true;
  await select(f, 1); for (const id of [5, 9, 16]) job(f, id, false); await f.tick();
  await select(f, 2); for (const id of [3, 9, 16]) job(f, id, false); await f.tick();
  assert.deepEqual(preferences(f, 2).drillJobs, [3]); assert.deepEqual(preferences(f, 3).drillJobs, [5]);
  f.save.setAt(1, 1, 5, 0); f.g.游戏暂停 = false; await f.tick();
  assert.deepEqual([f.queue(1), f.queue(2)], [3, 2]);
  await select(f, 1); toggle(f, false); f.complete(1); await f.tick();
  assert.equal(f.queue(1), 0); assert.equal(f.queue(2), 2);
  f.complete(2); f.complete(2); await f.tick(); assert.equal(f.queue(2), 5);
  f.complete(2); await f.tick(); assert.equal(f.queue(2), 0);
  assert.equal(f.save.getAt(5, 5, 0), 1); assert.equal(f.save.getAt(4, 5, 0), 0);
  const reload = fixture(f.stored); reload.add(9); await reload.ready();
  assert.deepEqual((await select(reload, 1)).drillJobs.filter(j => j.selected).map(j => j.id), [3]);
  assert.deepEqual((await select(reload, 2)).drillJobs.filter(j => j.selected).map(j => j.id), [5]);
});

test("legacy settings migrate once to every existing station including stations off the current map", async () => {
  const f = fixture(new Map([[storageKey, { version: 1, enabled: { research: false, drill: false }, drillJobs: [16], stations: [] }]]));
  f.add(9); const offMap = f.tiles.pop(); await f.ready(); await f.tick();
  const saved = f.stored.get(storageKey);
  assert.equal(saved.version, 2); assert.equal(saved.enabled, undefined); assert.equal(saved.drillJobs, undefined);
  assert.deepEqual(saved.settings.map(s => [s.id, s.enabled, s.drillJobs]), [[1, false, null], [2, false, [16]], [3, false, [16]]]);
  f.tiles.push(offMap); await select(f, 2); assert.equal(f.status().enabled, false);
  toggle(f, true); job(f, 16, false); await f.tick();
  assert.deepEqual(preferences(f, 2).drillJobs, [16]); assert.deepEqual(preferences(f, 3).drillJobs, []);
  f.add(9); await select(f, 3);
  assert.equal(f.status().enabled, true); assert.equal(f.status().drillJobs.filter(j => j.selected).length, 4);
});

test("stale station tokens and commands for the wrong kind cannot change any preferences", async () => {
  const f = fixture(); f.add(9); await f.ready(); f.g.游戏暂停 = true;
  const old = await select(f, 1); await select(f, 2);
  f.handlers["study-enabled"]({ token: old.token, kind: "drill", enabled: false });
  f.handlers["study-drill-job"]({ token: old.token, id: 16, enabled: false });
  f.handlers["study-enabled"]({ token: f.status().token, kind: "research", enabled: false });
  await f.tick(); assert.equal(f.status().enabled, true); assert.equal(f.status().drillJobs.every(j => j.selected), true);
  await select(f, 0); job(f, 16, false); await f.tick(); assert.equal(preferences(f, 1).drillJobs, null);
  const token = f.status().token; f.select(null);
  f.handlers["study-enabled"]({ token, kind: "research", enabled: false });
  await select(f, 0); assert.equal(f.status().enabled, true);
});

test("overlays and relocation hide the popup and reject clicks from the old selection", async () => {
  for (const block of [f => { f.objects.二级页面背景.push({}); }, f => { f.objects.转场云.push({}); },
    f => { f.objects.世界地图.push({}); }, f => { f.objects.设施搬迁拖动点.push({}); },
    f => { f.objects.黑幕.push({ isVisible: true }); }, f => { f.g.拖动模式 = true; }, f => { f.g.分页界面 = true; }]) {
    const f = fixture(); await f.ready(); await f.tick(); const token = f.status().token; block(f);
    f.handlers["study-enabled"]({ token, kind: "research", enabled: false }); await f.tick();
    assert.equal(f.status().visible, false); assert.equal(preferences(f, 1).enabled, true);
  }
});

test("moving a station preserves preferences; replacing or demolishing it resets them", async () => {
  const f = fixture(); await f.ready(); f.g.游戏暂停 = true; await select(f, 1);
  toggle(f, false); job(f, 16, false); await f.tick(); const old = f.status().token;
  const v = f.tiles[1].instVars;
  f.runtime.callFunction("删除地图设施", v.X坐标, v.Y坐标, 0, 0, 0, "主地图", 0, true);
  f.save.setAt(0, v.X坐标 - 10000 + 150, v.Y坐标 - 10000, 6); v.X坐标 += 5;
  f.save.setAt(2, v.X坐标 - 10000 + 150, v.Y坐标 - 10000, 6); await select(f, 1);
  assert.equal(f.status().enabled, false); assert.notEqual(f.status().token, old);
  f.handlers["study-enabled"]({ token: old, kind: "drill", enabled: true }); await f.tick();
  assert.equal(f.status().enabled, false); assert.equal(f.status().drillJobs.find(j => j.id === 16).selected, false);
  f.save.setAt(13, 2, 2, 21); f.save.setAt(6, 13, 1, 1); await f.tick();
  assert.equal(f.status().enabled, true); assert.equal(f.status().drillJobs.every(j => j.selected), true);
  toggle(f, false); await f.tick();
  f.runtime.callFunction("删除地图设施", v.X坐标, v.Y坐标, 0, 0, 0, "主地图", 0, false); await f.tick();
  assert.equal(f.status().visible, false); assert.equal(preferences(f, 2), undefined);
});

test("demolition during loading cannot resurrect a station's saved preferences or order", async () => {
  const original = fixture(); await original.ready(); await original.tick();
  const data = original.stored.get(storageKey), f = fixture(original.stored); let release;
  f.runtime.storage.getItem = () => new Promise(resolve => { release = resolve; });
  await f.tick(); const v = f.tiles[0].instVars;
  f.runtime.callFunction("删除地图设施", v.X坐标, v.Y坐标, 0, 0, 0, "主地图", 0, false);
  release(data); await settle(); await f.tick();
  assert.equal(preferences(f, 1), undefined); assert.equal(f.stored.get(storageKey).stations.some(s => s.id === 1), false);
});

test("invalid per-station preferences and failed storage writes stop new automatic spending", async () => {
  const good = { id: 2, type: 11, owner: 12, kind: 9, enabled: true, drillJobs: [16] };
  for (const settings of [null, [good, good], [{ ...good, kind: 4 }], [{ ...good, enabled: "yes" }], [{ ...good, drillJobs: [16, 16] }]]) {
    const f = fixture(new Map([[storageKey, { version: 2, settings, stations: [] }]])); await f.ready(); await f.tick();
    assert.equal(f.status().error, true); assert.deepEqual([f.queue(0), f.queue(1)], [0, 0]);
  }
  const f = fixture(); await f.ready(); f.g.游戏暂停 = true; await select(f, 0);
  f.runtime.storage.setItem = async () => { throw Error("Storage full"); }; toggle(f, false); await settle();
  f.g.游戏暂停 = false; await f.tick();
  assert.equal(f.status().error, true); assert.deepEqual([f.queue(0), f.queue(1)], [0, 0]);
});
