"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(options = {}) {
  const cells = options.cells || new Map(), stored = options.stored || new Map();
  const messages = [], notifications = [], calls = [], handlers = {}, objects = {}, errors = [];
  const save = { uid: 17, width: 100, getAt: (...p) => cells.get(p.join()) ?? 0, setAt: (value, ...p) => cells.set(p.join(), value) };
  if (!options.cells) {
    save.setAt(12345678, 0, 1, 0);
    for (const id of [1, 2]) {
      for (const [field, value] of [[0, id], [1, `hero-${id}`], [5, 10 + id], [9, "锻造"], [50, 9], [51, id + 100]]) save.setAt(value, id, field, 2);
    }
  }
  const wp = { getAt: (type, field) => field === 6 ? type % 10 : field === 5 ? type % 10 === 5 ? "内丹" : "装备" : field === 4 ? type % 10 === 6 ? "宝物" : "普通" : 0 };
  Object.assign(objects, { save: [save], wp: [wp], 底部菜单背景: [{ instVars: { 功能: "角色" } }], 二级页面背景: [], 转场云: [], 世界地图: [], 提示信息: [], 对话选择框: [], 黑幕: [] });
  const groups = new Map(["穿戴装备function", "卸下装备function", "装备库数据存取function"].map(name => [name, { IsGroupActive: () => true }]));
  const g = { 当前地图编号: 28, 选中角色序号: 1, 装备穿戴中: false };
  let params = [], capacity = 80, duplicateCore = false, refuse = false;
  const block = { _RunAndBlock() { save.setAt(params[1], params[0], 9, 2); } };
  const fn = { GetEventBlock: () => block, CaptureFunctionParameters: () => params.slice() };
  const read = (row, z) => Array.from({ length: 50 }, (_, j) => save.getAt(row, j, z));
  const write = (row, z, data) => data.forEach((v, j) => save.setAt(v, row, j, z));
  const free = z => { for (let row = 1; row < save.width; row++) if (!save.getAt(row, 1, z)) return row; throw new Error("No free row"); };
  const transfer = (row, from, to) => { const dest = free(to); write(dest, to, read(row, from)); write(row, from, Array(50).fill(0)); return dest; };
  const runtime = { layout: { name: "主界面" }, globalVars: g, timeScale: 1,
    objects: Object.fromEntries(Object.entries(objects).map(([name, list]) => [name, { getFirstInstance: () => list[0], getAllInstances: () => list }])),
    storage: { getItem: async key => stored.get(key), setItem: async (key, value) => stored.set(key, structuredClone(value)) },
    callFunction(name, ...args) {
      calls.push([name, ...args]);
      if (name === "文本") return args[0];
      if (name === "背包容量上限") return capacity;
      if (name === "内丹重复判断") return duplicateCore ? 1 : 0;
      if (name === "改变角色状态") { params = args; block._RunAndBlock(); return; }
      if (!["穿戴装备", "卸下装备"].includes(name) || refuse) return;
      assert.equal(g.装备穿戴中, false, "native transfers must never overlap");
      g.装备穿戴中 = true;
      const id = args[2], slot = name === "穿戴装备" ? wp.getAt(save.getAt(args[1], 1, 7), 6) : args[0];
      const old = save.getAt(id, 15 + slot, 2);
      if (old) { const row = transfer(old, 9, 7); if (name === "卸下装备") save.setAt(0, row, 7, 7); }
      setTimeout(() => {
        if (name === "穿戴装备") {
          const row = transfer(args[1], 7, 9);
          setTimeout(() => { save.setAt(row, id, 15 + slot, 2); save.setAt(id, row, 7, 9); g.装备穿戴中 = false; }, 1);
        } else { save.setAt(0, id, 15 + slot, 2); g.装备穿戴中 = false; }
      }, 1);
    } };
  const engine = { GetMainRunningLayout: () => runtime.layout,
    GetEventSheetManager: () => ({ GetFunctionBlockByName: name => name === "改变角色状态" ? fn : null, GetEventGroupByName: name => groups.get(name) }),
    PostComponentMessageToDOM: (_, name, value) => messages.push([name, value]),
    AddDOMComponentMessageHandler: (_, name, callback) => { handlers[name] = callback; } };
  const sandbox = { setTimeout, performance, console: { error: (...args) => errors.push(args) }, BanditFormations: {} };
  vm.createContext(sandbox);
  for (const file of ["outfits.js", "outfit-runtime.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../src/${file}`, "utf8"), sandbox);
  const api = sandbox.BanditFormations, outfits = api.attachOutfits(runtime, engine, message => notifications.push(message));
  const state = () => messages.filter(m => m[0] === "outfit-status").at(-1)?.[1];
  function add(type, marker = type) { const record = Array(50).fill(0); Object.assign(record, { 0: marker, 1: type, 2: 1, 3: 1, 5: 6, 6: 1, 8: 200, 9: 12, 15: marker / 10 }); const row = free(7); write(row, 7, record); return row; }
  function equip(row, id = 1) { const slot = wp.getAt(save.getAt(row, 1, 7), 6), old = save.getAt(id, slot + 15, 2); if (old) transfer(old, 9, 7); const dest = transfer(row, 7, 9); save.setAt(id, dest, 7, 9); save.setAt(dest, id, slot + 15, 2); return dest; }
  const equipped = id => Array.from({ length: 6 }, (_, i) => { const row = save.getAt(id, i + 16, 2); return row ? api.outfitFingerprint(read(row, 9)) : null; });
  return { api, outfits, save, cells, stored, runtime, engine, objects, g, handlers, calls, notifications, errors, groups,
    add, equip, equipped, read, write, free, state,
    async tick() { outfits.tick(); await delay(0); outfits.tick(); },
    async edit(action, fields = {}) { outfits.tick(); await handlers[`outfit-${action}`]({ token: state().token, ...fields }); },
    async job(job, id = 1) { runtime.callFunction("改变角色状态", id, job); await outfits.flush(); outfits.tick(); },
    setCapacity: value => { capacity = value; }, duplicateCore: value => { duplicateCore = value; }, refuse: value => { refuse = value; } };
}
const storeKey = "cjs-formations:outfits:v1:12345678";

test("per-character outfits restore distinct work jobs, retain unsaved-job gear, and only Save replaces a set", async () => {
  const f = fixture(); await f.tick();
  f.equip(f.add(11)); f.equip(f.add(12)); const forging = f.equipped(1);
  await f.edit("save");
  await f.job("炼丹"); assert.deepEqual(f.equipped(1), forging);
  f.equip(f.add(21)); const alchemy = f.equipped(1); await f.edit("save");
  await f.job("锻造"); assert.deepEqual(f.equipped(1), forging);
  await f.job("炼丹"); assert.deepEqual(f.equipped(1), alchemy);
  await f.job("采矿"); assert.deepEqual(f.equipped(1), alchemy);
  await f.job("锻造", 2); assert.deepEqual(f.equipped(2), Array(6).fill(null));
  await f.job("锻造"); f.equip(f.add(31)); const edited = f.equipped(1);
  await f.job("炼丹"); await f.job("锻造"); assert.deepEqual(f.equipped(1), forging, "manual gear edits do not replace saved outfits");
  f.equip(Array.from({ length: 99 }, (_, i) => i + 1).find(row => f.save.getAt(row, 1, 7) === 31)); await f.edit("save"); await f.job("炼丹"); await f.job("锻造"); assert.deepEqual(f.equipped(1), edited);
  assert.equal(f.stored.get(storeKey).outfits.length, 2);
});

test("all six slots, saved empty slots, native transfers and item conservation across repeated swaps", async () => {
  const f = fixture(); await f.tick();
  for (let slot = 1; slot <= 6; slot++) f.equip(f.add(10 + slot));
  const a = f.equipped(1); await f.edit("save");
  await f.job("战斗"); for (let slot = 1; slot <= 6; slot++) f.equip(f.add(20 + slot));
  const b = f.equipped(1); await f.edit("save");
  for (let i = 0; i < 3; i++) { await f.job("锻造"); assert.deepEqual(f.equipped(1), a); await f.job("战斗"); assert.deepEqual(f.equipped(1), b); }
  const records = []; for (const z of [7, 9]) for (let row = 1; row < 100; row++) if (f.save.getAt(row, 1, z)) records.push(f.api.outfitFingerprint(f.read(row, z)));
  assert.deepEqual(records.sort(), [...a, ...b].sort());
  const empty = fixture(); await empty.tick(); await empty.edit("save"); empty.equip(empty.add(11));
  await empty.job("锻造"); assert.deepEqual(empty.equipped(1), Array(6).fill(null));
});

test("saved outfits survive reloads and maps; campaign, character identity and stale UI actions stay isolated", async () => {
  const f = fixture(); await f.tick(); f.equip(f.add(11)); const original = f.equipped(1); await f.edit("save");
  await f.job("战斗"); f.equip(f.add(21));
  const reloaded = fixture({ cells: f.cells, stored: f.stored }); await reloaded.tick(); reloaded.g.当前地图编号 = 35;
  await reloaded.job("锻造"); assert.deepEqual(reloaded.equipped(1), original);
  const stale = reloaded.state().token; await reloaded.job("炼丹");
  await reloaded.handlers["outfit-save"]({ token: stale }); assert.equal(reloaded.stored.get(storeKey).outfits.length, 1);
  reloaded.save.setAt("replacement", 1, 1, 2); reloaded.equip(reloaded.add(31)); const replacement = reloaded.equipped(1);
  await reloaded.job("锻造"); assert.deepEqual(reloaded.equipped(1), replacement);
  reloaded.save.setAt(87654321, 0, 1, 0); await reloaded.tick(); await reloaded.job("锻造"); assert.deepEqual(reloaded.equipped(1), replacement);
});

test("missing, sold, other-character and ambiguous equipment keep the current piece without substituting different rolls", async () => {
  for (const scenario of ["sold", "other", "ambiguous", "other-copy"]) {
    const f = fixture(); await f.tick(); f.equip(f.add(11, 101)); const original = f.equipped(1)[0]; await f.edit("save");
    f.equip(f.add(11, 102)); const current = f.equipped(1);
    let row; for (let i = 1; i < 100; i++) if (f.save.getAt(i, 1, 7) && f.api.outfitFingerprint(f.read(i, 7)) === original) row = i;
    if (scenario === "sold") f.write(row, 7, Array(50).fill(0));
    if (scenario === "other") f.equip(row, 2);
    if (scenario === "other-copy") { const copy = f.free(7); f.write(copy, 7, f.read(row, 7)); f.equip(copy, 2); }
    if (scenario === "ambiguous") f.write(f.free(7), 7, f.read(row, 7));
    await f.job("锻造"); assert.deepEqual(f.equipped(1), current); assert.match(f.notifications.at(-1), /unavailable or ambiguous/);
  }
});

test("level upgrades and lock/new-item markers preserve item identity, while new rolls require saving again", async () => {
  const f = fixture(); await f.tick(); f.equip(f.add(11)); await f.edit("save");
  const row = f.save.getAt(1, 16, 2); for (const [field, value] of [[6, 30], [22, 1], [24, 1]]) f.save.setAt(value, row, field, 9);
  const upgraded = f.equipped(1); f.equip(f.add(21)); await f.job("锻造"); assert.deepEqual(f.equipped(1), upgraded);
  assert.equal(f.save.getAt(f.save.getAt(1, 16, 2), 6, 9), 30);
  f.save.setAt(999, f.save.getAt(1, 16, 2), 15, 9); f.equip(f.add(31)); const current = f.equipped(1);
  await f.job("锻造"); assert.deepEqual(f.equipped(1), current);
});

test("Forget and the persistent toggle leave equipment alone; saving remains available while disabled", async () => {
  const f = fixture(); await f.tick(); f.equip(f.add(11)); await f.edit("save");
  await f.edit("enabled", { enabled: false }); f.equip(f.add(21)); const current = f.equipped(1);
  await f.job("锻造"); assert.deepEqual(f.equipped(1), current); assert.equal(f.stored.get(storeKey).enabled, false);
  await f.edit("save"); await f.edit("enabled", { enabled: true }); await f.edit("forget");
  assert.deepEqual(f.equipped(1), current); assert.equal(f.stored.get(storeKey).outfits.length, 0);
  f.equip(f.add(31)); const after = f.equipped(1); await f.job("锻造"); assert.deepEqual(f.equipped(1), after);
});

test("full inventory, blocked native hooks, realm eligibility and absorbed-core restrictions are checked before mutation", async () => {
  const full = fixture(); await full.tick(); await full.edit("save"); full.equip(full.add(11)); full.setCapacity(0);
  await assert.rejects(full.job("锻造"), /inventory space/); assert.ok(full.equipped(1)[0]);
  const f = fixture(); await f.tick(); f.equip(f.add(11)); await f.edit("save"); f.equip(f.add(21));
  f.groups.set("穿戴装备function", { IsGroupActive: () => false });
  await assert.rejects(f.job("锻造"), /unavailable/); assert.equal(f.calls.filter(c => c[0] === "穿戴装备").length, 0);
  const realm = fixture(); await realm.tick(); const high = realm.add(11); realm.save.setAt(9, high, 3, 7); realm.equip(high); await realm.edit("save"); realm.equip(realm.add(21)); realm.save.setAt(0, 1, 50, 2);
  const current = realm.equipped(1); await realm.job("锻造"); assert.deepEqual(realm.equipped(1), current);
  const core = fixture(); await core.tick(); core.equip(core.add(15)); await core.edit("save"); core.equip(core.add(25)); core.duplicateCore(true);
  const before = core.equipped(1); await core.job("锻造"); assert.deepEqual(core.equipped(1), before);
});

test("native async swaps are awaited, repeated requests coalesce, and changing jobs interrupts the remaining old slots", async () => {
  const f = fixture(); await f.tick(); f.equip(f.add(11)); f.equip(f.add(12)); await f.edit("save");
  f.equip(f.add(21)); f.equip(f.add(22)); const secondSlot = f.equipped(1)[1];
  f.runtime.callFunction("改变角色状态", 1, "锻造"); f.outfits.request(1);
  const changing = f.outfits.flush(); await delay(1); assert.equal(f.outfits.ready(), false);
  f.runtime.callFunction("改变角色状态", 1, "采矿"); await changing;
  assert.equal(f.equipped(1)[1], secondSlot); assert.equal(f.calls.filter(c => c[0] === "穿戴装备").length, 1);
  assert.equal(f.outfits.ready(), true);
});

test("a job selection during delayed storage loading applies only the latest job after loading", async () => {
  const f = fixture(); await f.tick(); f.equip(f.add(11)); await f.edit("save"); f.equip(f.add(21)); const current = f.equipped(1);
  const reload = fixture({ cells: f.cells, stored: f.stored }); let resolve;
  reload.runtime.storage.getItem = () => new Promise(r => { resolve = r; }); reload.outfits.tick();
  reload.runtime.callFunction("改变角色状态", 1, "锻造"); const done = reload.outfits.flush();
  reload.runtime.callFunction("改变角色状态", 1, "采矿"); resolve(f.stored.get(storeKey)); await done;
  assert.deepEqual(reload.equipped(1), current);
});

test("storage write failures retain the old outfit, invalid records fail closed, and refused native swaps reject", async () => {
  const f = fixture(); await f.tick(); f.equip(f.add(11)); await f.edit("save"); const original = structuredClone(f.stored.get(storeKey));
  f.runtime.storage.setItem = async () => { throw new Error("Disk full"); }; f.equip(f.add(21)); await f.edit("save");
  assert.deepEqual(f.stored.get(storeKey), original); assert.match(f.notifications.at(-1), /Disk full/);
  f.refuse(true); await assert.rejects(f.job("锻造"), /refused/);
  assert.throws(() => f.api.validateOutfit({ id: 1, identity: "", job: "锻造", slots: ["bad"] }), /Invalid/);
  const bad = fixture({ stored: new Map([[storeKey, { version: 1, enabled: true, outfits: [{ ...original.outfits[0], slots: [] }] }]]) });
  await bad.tick(); assert.match(bad.state().error, /Invalid/, JSON.stringify({ state: bad.state(), notices: bad.notifications, errors: bad.errors.map(e => String(e[1])) })); assert.equal(bad.calls.filter(c => ["穿戴装备", "卸下装备"].includes(c[0])).length, 0);
});

test("reentering the same map invalidates an in-flight outfit before it can change more slots", async () => {
  const f = fixture(); await f.tick(); f.equip(f.add(11)); f.equip(f.add(12)); await f.edit("save");
  f.equip(f.add(21)); f.equip(f.add(22)); const second = f.equipped(1)[1];
  f.runtime.callFunction("改变角色状态", 1, "锻造"); const changing = f.outfits.flush();
  await delay(1); f.outfits.leave();
  await assert.rejects(changing, /map changed/);
  await delay(20);
  assert.equal(f.equipped(1)[1], second);
  assert.equal(f.calls.filter(c => c[0] === "穿戴装备").length, 1);
});
