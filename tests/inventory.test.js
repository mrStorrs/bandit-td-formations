"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture() {
  const cells = new Map(), handlers = {}, messages = [], calls = [], notices = [];
  const save = { uid: 10, width: 100, getAt: (...p) => cells.get(p.join()) ?? 0,
    setAt: (v, ...p) => cells.set(p.join(), v) };
  save.setAt(12345678, 0, 1, 0);
  const wp = { width: 4, getAt: (type, field) => field === 5 ? (type === 3 ? "内丹" : "装备") : field === 4 ? (type === 2 ? "宝物" : "普通") : ({ 3: 1, 6: 1, 9: 43, 10: 1 })[field] || 0 };
  const displayCells = new Map(), display = { width: 100, getAt: (...p) => displayCells.get(p.join()) || 0,
    setAt: (value, ...p) => displayCells.set(p.join(), value) };
  const layer = { isSelfAndParentsVisible: true, layerToCssPx: (x, y) => [x / 2 + 30, y / 2 + 50] };
  const icon = { uid: 100, isVisible: true, opacity: 1, layer,
    instVars: { 功能: "物品", 用途: "二级页面", 库序号: 7, 物品序号: 1, 物品编号: 1 },
    getBoundingBox: () => ({ left: 100, top: 200, right: 180, bottom: 280 }) };
  const page = { uid: 200, isVisible: true, opacity: 1, layer, instVars: { 功能: "物品" } };
  const objects = { save: [save], wp: [wp], 装备临时: [display], 物品图标: [icon], 二级页面背景: [page] };
  const nativeSort = { params: [7], CaptureFunctionParameters() { return this.params; }, GetEventBlock() { return this.block; },
    block: { _RunAndBlock() {
      nativeSort.lastMode = runtime.globalVars.当前装备排序属性编号;
      displayCells.clear(); let index = 0;
      for (let row = save.width - 1; row > 0; row--) if (save.getAt(row, 1, 7)) display.setAt(row, index++, 1);
      return "native result";
    } } };
  const runtime = { layout: { name: "主界面" }, globalVars: { 当前地图编号: 28, 当前装备排序属性编号: -1 },
    objects: new Proxy({}, { get: (_, name) => ({ getFirstInstance: () => objects[name]?.[0], getAllInstances: () => objects[name] || [] }) }),
    callFunction(name, ...args) {
      calls.push([name, ...args]);
      if (["刷新物品", "刷新角色丹药"].includes(name)) nativeSort.block._RunAndBlock();
      if (name === "装备主属性") return args[3] / 10;
      if (["出售物品", "分解宝物"].includes(name)) {
        save.setAt(0, args[0], 1, 7);
        save.setAt(save.getAt(1, name === "出售物品" ? 2 : 3, 0) + 25, 1, name === "出售物品" ? 2 : 3, 0);
      }
    } };
  const engine = { GetMainRunningLayout: () => runtime.layout,
    GetEventSheetManager: () => ({ GetFunctionBlockByName: name => name === "装备排序" ? nativeSort : null }),
    AddDOMComponentMessageHandler: (_, name, fn) => { handlers[name] = fn; },
    PostComponentMessageToDOM: (_, name, state) => messages.push([name, state]), FlushPendingInstances() {} };
  const outfits = { ready: () => true, isProtected: () => false };
  const sandbox = { BanditFormations: {}, console: { error() {} } };
  vm.createContext(sandbox);
  for (const file of ["craft-sets.js", "inventory-sort.js", "inventory.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../src/${file}`, "utf8"), sandbox);
  const inventory = sandbox.BanditFormations.attachInventory(runtime, engine, message => notices.push(message), outfits);
  function item(type = 1) {
    save.setAt(999, 1, 0, 7); save.setAt(type, 1, 1, 7); icon.instVars.物品编号 = type;
    inventory.tick();
  }
  item(); inventory.tick();
  const state = () => messages.filter(([name]) => name === "inventory-status").at(-1)[1];
  const pointer = (phase, fields = {}) => handlers["inventory-click"]({ phase, x: 100, y: 170, token: state().token,
    uid: state().items[0]?.uid, key: state().items[0]?.key, ...fields });
  return { save, icon, page, objects, runtime, inventory, outfits, calls, notices, state, pointer, item, nativeSort, display,
    sort(role, token = state().token) { handlers["inventory-sort"]({ role, token }); },
    enableSort() { objects.装备筛选下拉按钮 = [{ ...icon, instVars: { 功能: "装备排序" } }]; inventory.tick(); },
    click() { inventory.tick(); pointer("down"); pointer("up"); }, sales: () => calls.filter(([name]) => ["出售物品", "分解宝物"].includes(name)) };
}

test("Ctrl-click sells equipment and cores, decomposes treasures, and refreshes the existing inventory page", () => {
  for (const [type, action] of [[1, "出售物品"], [2, "分解宝物"], [3, "出售物品"]]) {
    const f = fixture(); f.item(type);
    f.pointer("down"); assert.equal(f.sales().length, 0);
    f.pointer("up"); assert.deepEqual(f.sales(), [[action, 1, true, false]]);
    assert.equal(f.save.getAt(1, 1, 7), 0);
    assert.equal(f.save.getAt(1, action === "出售物品" ? 2 : 3, 0), 25);
    assert.ok(f.calls.some(([name]) => name === "关闭tips"));
    assert.ok(f.calls.some(c => JSON.stringify(c) === JSON.stringify(["刷新物品", 8, "物品", "二级页面", 0, 0, 0])));
    f.pointer("up"); assert.equal(f.sales().length, 1, "duplicate release must not sell again");
  }
});

test("normal locks, saved outfits and incomplete outfit loading prevent both sales and decomposition", () => {
  for (const type of [1, 2, 3]) for (const protection of ["lock", "outfit", "loading"]) {
    const f = fixture(); f.item(type);
    if (protection === "lock") f.save.setAt(1, 1, 22, 7);
    if (protection === "outfit") f.outfits.isProtected = () => true;
    if (protection === "loading") f.outfits.ready = () => false;
    f.click(); assert.equal(f.sales().length, 0); assert.equal(f.save.getAt(1, 1, 7), type);
    assert.ok(f.notices.length);
  }
});

test("the pressed item must still be the same physical piece on release, even when its row is reused", () => {
  for (const change of [f => f.save.setAt(1000, 1, 0, 7), f => f.save.setAt(33, 1, 9, 7),
    f => f.save.setAt(0, 1, 1, 7), f => f.icon.uid++, f => { f.objects.物品图标 = []; }]) {
    const f = fixture(); f.pointer("down"); change(f); f.pointer("up"); assert.equal(f.sales().length, 0);
  }
  const f = fixture(); f.pointer("down"); f.save.setAt(1, 1, 24, 7); f.pointer("up");
  assert.equal(f.sales().length, 1, "the native seen/new-item flag does not change the physical item");
});

test("delayed pointer-down messages cannot discard a replacement item that was not displayed at the time", () => {
  const f = fixture(); const original = { ...f.state().items[0] };
  f.save.setAt(1000, 1, 0, 7); f.inventory.tick();
  f.pointer("down", { uid: original.uid, key: original.key }); f.pointer("up");
  assert.equal(f.sales().length, 0); assert.equal(f.save.getAt(1, 0, 7), 1000);
});

test("dragging away, another item, non-finite coordinates, cancellation and layout changes never sell", () => {
  for (const release of [{ x: 500 }, { x: NaN }, { y: Infinity }, { phase: "cancel" }]) {
    const f = fixture(); f.pointer("down"); f.pointer("up", release); assert.equal(f.sales().length, 0);
  }
  for (const change of [f => f.page.uid++, f => f.runtime.globalVars.当前地图编号++,
    f => f.save.setAt(87654321, 0, 1, 0), f => { f.runtime.layout.name = "开始界面"; }, f => f.inventory.leave()]) {
    const f = fixture(); const token = f.state().token; f.pointer("down"); change(f); f.pointer("up", { token });
    assert.equal(f.sales().length, 0);
  }
});

test("equipped, hidden, stale and unsupported icons are never actionable", () => {
  for (const change of [f => { f.icon.instVars.功能 = "角色装备"; }, f => { f.icon.instVars.库序号 = 9; },
    f => { f.icon.instVars.功能 = "合成材料"; }, f => { f.icon.instVars.功能 = "商店"; },
    f => { f.icon.isVisible = false; }, f => { f.icon.opacity = 0; }, f => { f.icon.layer.isSelfAndParentsVisible = false; },
    f => { f.icon.instVars.物品编号 = 2; }, f => { f.icon.instVars.物品序号 = 0; }]) {
    const f = fixture(); change(f); f.click(); assert.equal(f.sales().length, 0);
  }
});

test("native equipment swaps can leave an old owner marker in the bag; inventory location determines eligibility", () => {
  const f = fixture(); f.save.setAt(2, 1, 7, 7); f.click();
  assert.deepEqual(f.sales(), [["出售物品", 1, true, false]]);
});

test("dialogs, filters, equipment transfers and page closure block a pending click at release", () => {
  for (const name of ["转场云", "世界地图", "提示信息", "对话选择框", "黑幕", "装备筛选背景", "装备筛选背景3", "数字输入背景"]) {
    const f = fixture(); f.pointer("down"); f.objects[name] = [{ isVisible: true }];
    f.pointer("up"); assert.equal(f.sales().length, 0); f.inventory.tick(); assert.equal(f.state().active, false);
  }
  for (const change of [f => { f.runtime.globalVars.装备穿戴中 = true; }, f => { f.objects.二级页面背景 = []; }]) {
    const f = fixture(); f.pointer("down"); change(f); f.pointer("up"); assert.equal(f.sales().length, 0);
  }
});

test("inventory, character bag, pawnshop and treasure pages keep their own refresh context", () => {
  for (const screen of ["物品", "装备", "角色丹药", "当铺", "宝物分解"]) {
    const f = fixture(); f.page.instVars.功能 = f.icon.instVars.功能 = screen;
    if (screen === "宝物分解") f.item(2);
    f.inventory.tick(); f.click(); assert.equal(f.sales().length, 1);
    assert.equal(f.calls.find(([name]) => ["刷新物品", "刷新角色丹药"].includes(name))[2], screen);
  }
});

test("choosing a role sorts the display only, persists through refresh, and Game order restores the native choice", () => {
  const f = fixture(); f.enableSort();
  for (const [row, bonuses] of [[1, [51, 59]], [2, [59]], [3, [52]]]) {
    f.save.setAt(1, row, 1, 7); f.save.setAt(1, row, 3, 7); f.save.setAt(6, row, 5, 7);
    bonuses.forEach((id, i) => { f.save.setAt(id, row, 9 + i, 7); f.save.setAt(50, row, 15 + i, 7); });
  }
  assert.equal(f.state().sort.roles.length, 12);
  f.sort("forge"); assert.equal(f.state().sort.value, "forge");
  assert.deepEqual([0, 1, 2, 3].map(i => f.display.getAt(i, 1)), [1, 2, 3, 0]);
  assert.equal(f.nativeSort.block._RunAndBlock(), "native result");
  assert.deepEqual([0, 1, 2].map(i => f.display.getAt(i, 1)), [1, 2, 3]);
  assert.ok(f.calls.filter(c => c[0] === "装备主属性").every(c => c[1] === 0 && c[5] === 100 && c[6] === "副词条"));
  f.sort(""); assert.equal(f.runtime.globalVars.当前装备排序属性编号, -1);
  assert.deepEqual([0, 1, 2].map(i => f.display.getAt(i, 1)), [3, 2, 1]);
  assert.equal(f.sales().length, 0); assert.equal(f.save.getAt(1, 22, 7), 0);
});

test("native sorting overrides the role; malformed, stale, hidden and modal sort requests do nothing", () => {
  const f = fixture(); f.enableSort(); f.sort("forge");
  f.runtime.globalVars.当前装备排序属性编号 = 51; f.nativeSort.block._RunAndBlock(); f.inventory.tick();
  assert.equal(f.state().sort.value, "");
  for (const role of [null, "bogus", 1, {}]) f.sort(role);
  f.sort("forge", "old page"); assert.equal(f.runtime.globalVars.当前装备排序属性编号, 51);
  for (const change of [() => { f.objects.装备筛选下拉按钮[0].isVisible = false; },
    () => { f.objects.装备筛选背景 = [{ isVisible: true }]; }]) {
    change(); f.sort("forge"); assert.equal(f.runtime.globalVars.当前装备排序属性编号, 51);
  }
});

test("sort failures preserve the complete native order; sorting another inventory layer is not overridden", () => {
  const f = fixture(); f.enableSort();
  f.save.setAt(1, 1, 3, 7); f.save.setAt(6, 1, 5, 7); f.save.setAt(51, 1, 9, 7);
  f.save.setAt(1, 2, 1, 7);
  const call = f.runtime.callFunction;
  f.runtime.callFunction = (name, ...args) => name === "装备主属性" ? NaN : call(name, ...args);
  f.sort("forge");
  assert.equal(f.runtime.globalVars.当前装备排序属性编号, -1);
  assert.deepEqual([0, 1].map(i => f.display.getAt(i, 1)), [2, 1]);
  assert.match(f.notices.at(-1), /normal order was kept/);
  f.runtime.callFunction = call; f.sort("forge"); f.nativeSort.params = [9]; f.nativeSort.block._RunAndBlock();
  assert.deepEqual([0, 1].map(i => f.display.getAt(i, 1)), [2, 1]);
  assert.equal(f.nativeSort.lastMode, -1, "other layers still receive a valid native sort choice");
  assert.equal(f.runtime.globalVars.当前装备排序属性编号, -100, "the bag retains its selected role");
});

test("changing the sort during a Ctrl-click cancels that pending sale", () => {
  const f = fixture(); f.enableSort(); f.pointer("down"); f.sort("forge"); f.pointer("up");
  assert.equal(f.sales().length, 0);
});
