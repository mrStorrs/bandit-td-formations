"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture() {
  let clock = 0;
  const cells = new Map(), calls = [], messages = [], handlers = {}, notifications = [], disabled = new Set();
  const save = { uid: 101, width: 40, getAt: (...c) => cells.get(c.join()) ?? 0, setAt: (v, ...c) => cells.set(c.join(), v) };
  const g = { 当前地图编号: 28, 主地图编号起始: 10000, 选中地块X: 10010, 选中地块Y: 10010, 选中建筑序号: 99, 装备穿戴中: false };
  const transfer = { value: 17, GetValue() { return this.value; }, SetValue(value) { this.value = value; } };
  const tiles = [], cores = [], menus = [{ uid: 333, instVars: { 功能: "设施", X坐标: 10010, Y坐标: 10010 } }];
  const objects = { save: [save], ss: [{ getAt: (t, field) => field === 30 ? ({ 21:4, 31:5, 41:6, 1:8, 11:9 })[t] || 0 : 0 }],
    地面: tiles, 建筑核心: cores, 底部菜单背景: menus, 二级页面背景: [], 转场云: [], 黑幕: [] };
  const runtime = { layout: { name: "主界面" }, globalVars: g, timeScale: 1,
    objects: Object.fromEntries(Object.entries(objects).map(([n, list]) => [n, { getFirstInstance: () => list[0], getAllInstances: () => list }])),
    callFunction(name, ...args) {
      calls.push([name, ...args]);
      if (name === "灵物库存入") {
        if (f.refuse) return;
        const source = args[0]; let dest = 1;
        while (save.getAt(dest, 1, 19) > 0) dest++;
        transfer.value = dest;
        for (let i = 0; i < (f.partial ? 7 : 50); i++) { save.setAt(save.getAt(source, i, 18), dest, i, 19); save.setAt(0, source, i, 18); }
      } else assert.ok(["刷新单体建筑", "刷新地块灵气"].includes(name), name);
    } };
  const engine = { GetMainRunningLayout: () => runtime.layout, FlushPendingInstances() {},
    GetEventSheetManager: () => ({ GetEventGroupByName: name => ({ IsGroupActive: () => !disabled.has(name) }),
      GetEventVariableBySID: sid => sid === 838438864163447 ? transfer : null }),
    AddDOMComponentMessageHandler: (_, action, fn) => { handlers[action] = fn; },
    PostComponentMessageToDOM: (_, action, data) => messages.push([action, structuredClone(data)]) };
  const sandbox = { performance: { now: () => clock }, console: { error() {} } }; vm.createContext(sandbox);
  for (const name of ["shelves.js", "shelf-runtime.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../src/${name}`, "utf8"), sandbox);
  const loop = sandbox.BanditFormations.attachShelves(runtime, engine, text => notifications.push(text), () => !f.outfitBusy);
  const f = { save, g, transfer, runtime, engine, calls, messages, handlers, notifications, disabled, objects, tiles, cores, menus, loop,
    status: () => messages.at(-1)?.[1], tick() { clock += 250; loop.tick(); },
    fill(token = this.status().token) { handlers["shelf-fill"]({ token }); },
    bench(id, type, x, y) {
      const v = { 用途: "主地图", 区域: "山寨", 有效解锁: true, 资源类型: "锻造", 设施编号: type, X坐标: x, Y坐标: y };
      tiles.push({ uid: 200 + id, instVars: v });
      [id, type, 1].forEach((value, field) => save.setAt(value, id, field, 21));
      save.setAt(id, x - 10000 + 150, y - 10000, 6);
    },
    shelf(id, x, y, occupied = 0) {
      cores.push({ uid: 500 + id, instVars: { 区域: "山寨", 建筑编号: 67, 建筑序号: id, X坐标: x, Y坐标: y } });
      [id, 67, x, y, 0, 0].forEach((value, field) => save.setAt(value, id, field, 1)); save.setAt(occupied, id, 9, 1);
    },
    spirit(row, metal, wood = 0, locked = 0) {
      [row, 7, 3, 2, 6, metal, wood, 0, 0, 0, (metal + wood) / 5, locked, 0, 1].forEach((value, field) => save.setAt(value, row, field, 18));
    },
    record(row, layer) { return Array.from({ length: 50 }, (_, i) => save.getAt(row, i, layer)); },
  };
  save.setAt(12345678, 0, 1, 0); save.setAt(10, 1, 1, 1);
  f.bench(1, 21, 10010, 10010); f.bench(2, 31, 10014, 10010);
  f.shelf(2, 10009, 10010); f.shelf(3, 10012, 10010);
  f.spirit(1, 100, 50, 1); f.spirit(2, 100);
  f.tick(); return f;
}

test("native transfers fill the best shared placement, preserve locks and selection, and refresh bonuses", () => {
  const f = fixture(), g = { ...f.g }, original = [f.record(1, 18), f.record(2, 18)];
  f.menus[0].uid++;
  f.fill();
  assert.deepEqual(f.calls.filter(c => c[0] === "灵物库存入").map(c => c[1]), [2, 1]);
  for (const [shelf, item] of [[2, 1], [3, 0]]) {
    const placed = f.save.getAt(shelf, 9, 1), expected = [...original[item]]; expected[12] = shelf;
    assert.deepEqual(f.record(placed, 19), expected);
  }
  assert.deepEqual(f.g, g); assert.equal(f.menus[0].instVars.功能, "设施");
  assert.equal(f.transfer.value, 17);
  assert.ok(f.calls.some(c => c[0] === "刷新地块灵气"));
  assert.match(f.status().message, /Filled 2\/2/); assert.equal(f.status().empty, 0);
  assert.equal(f.record(1, 18).every(v => v === 0), true);
  assert.equal(f.record(2, 18).every(v => v === 0), true);
  const calls = f.calls.length; f.fill(); assert.equal(f.calls.length, calls);
});

test("works while paused and leaves populated, unfinished, foreign and out-of-range shelves alone", () => {
  const f = fixture(); f.g.游戏暂停 = true; f.runtime.timeScale = 0;
  f.save.setAt(9, 2, 9, 1); f.shelf(4, 10011, 10010); f.save.setAt(1, 4, 4, 1);
  f.shelf(5, 10012, 10012); f.shelf(6, 10010, 10011); f.cores.at(-1).instVars.区域 = "城市";
  f.tick(); f.fill(); assert.match(f.status().message, /Filled 1\/1/);
  assert.equal(f.save.getAt(2, 9, 1), 9);
  for (const id of [4, 5, 6]) assert.equal(f.save.getAt(id, 9, 1), 0);
});

test("stale station/map tokens, dialogs, equipment swaps and pending outfits cannot place spirits", () => {
  for (const block of [f => f.menus[0].instVars.X坐标++, f => f.g.当前地图编号++, f => f.objects.二级页面背景.push({}),
    f => { f.g.装备穿戴中 = true; }, f => { f.outfitBusy = true; }, f => f.loop.leave(),
    f => { f.tiles[0].instVars.有效解锁 = false; }]) {
    const f = fixture(), token = f.status().token; block(f); f.fill(token);
    assert.equal(f.calls.length, 0); assert.equal(f.save.getAt(1, 1, 18), 7);
  }
});

test("refused and partial native transfers restore the complete original records", () => {
  for (const partial of [false, true]) {
    const f = fixture(), bag = [f.record(1, 18), f.record(2, 18)], g = { ...f.g };
    f.refuse = !partial; f.partial = partial; f.fill();
    assert.deepEqual([f.record(1, 18), f.record(2, 18)], bag);
    assert.equal(f.record(1, 19).every(v => v === 0), true);
    assert.equal(f.save.getAt(2, 9, 1), 0); assert.deepEqual(f.g, g);
    assert.match(f.status().message, /restored/);
  }
});

test("missing hooks, full placed storage and no suitable inventory report without item loss", () => {
  for (const configure of [f => f.disabled.add("灵物库数据存取function"),
    f => { for (let r = 1; r < f.save.width; r++) f.save.setAt(9, r, 1, 19); },
    f => { f.save.setAt(0, 1, 5, 18); f.save.setAt(0, 2, 5, 18); }]) {
    const f = fixture(); configure(f); f.fill();
    assert.equal(f.calls.length, 0); assert.equal(f.save.getAt(1, 1, 18), 7);
    assert.match(f.status().message, /Filled 0\/2/);
  }
});

test("the control follows all five station kinds and rejects other facilities", () => {
  for (const [type, kind] of [[21,4], [31,5], [1,8], [41,6], [11,9]]) {
    const f = fixture(); f.tiles[0].instVars.设施编号 = type; f.save.setAt(type, 1, 1, 21); f.tick();
    assert.equal(f.status().visible, true); assert.equal(f.status().station.kind, kind);
  }
  const f = fixture(); f.tiles[0].instVars.设施编号 = 81; f.tick(); assert.equal(f.status().visible, false);
});
