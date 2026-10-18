"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const settle = () => new Promise(resolve => setImmediate(resolve));
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function fixture(stored = new Map(), extended = false) {
  let clock = 0;
  const cells = new Map(), notifications = [], calls = [], tiles = [], methods = new Map(), handlers = {}, messages = [];
  const save = { uid: 101, width: 64, getAt: (...coords) => cells.get(coords.join()) ?? 0,
    setAt: (value, ...coords) => cells.set(coords.join(), value) };
  const g = { 当前地图编号: 28, 主地图编号起始: 10000, 选中地块X: 44, 选中地块Y: 55, 锻造物品编号: 66 };
  const values = [7, 10, 42];
  const variables = values.map((_, i) => ({ GetValue: () => values[i], SetValue: value => { values[i] = value; } }));
  const groups = new Map(["加入锻造队列function", "生成单体设施function", "锻造材料编号function", "锻造材料数量function",
    "出售装备function", "失去物品function", "获得铜钱function", "装备价格function"]
    .map(name => [name, { active: true, IsGroupActive() { return this.active; } }]));
  const recipes = { 1: [1, "普通", "装备", 1], 2: [1, "普通", "装备", 2], 16: [1, "普通", "装备", 3], 30: [1, "普通丹药", "丹药", 0] };
  const catalog = {};
  for (let id = 1; id <= 27; id++) {
    const slot = id <= 9 ? 1 : id <= 15 ? 2 : id <= 21 ? 3 : 4;
    const stat = id <= 9 ? Math.ceil(id / 3) : ((id - 10) % 3) + 1;
    const production = id >= 10 && (id - 10) % 6 >= 3;
    catalog[id] = { 3:1,4:"普通",5:"装备",6:slot,8:id<=9?stat+3:0,9: id <= 9 ? [40,43,46,48,44,41,47,45,42][id-1] : production ? 72 : 28,
      10:stat,23:id<=9?"通用":production?"生产":"战斗" };
    recipes[id] ??= [1, "普通", "装备", slot];
  }
  catalog[30] = {3:1,4:"普通丹药",5:"丹药",6:0};
  const ss = { getAt: (id, field) => field === 30 ? ({ 21: 4, 31: 5, 41: 6 })[id] : 0 };
  const wp = { width:64, getAt: (id, field) => (extended ? catalog[id]?.[field] : recipes[id]?.[field - 3]) ?? 0 };
  const objects = { save: [save], ss: [ss], wp: [wp], 地面: tiles, 二级页面背景: [], 转场云: [], 世界地图: [], 黑幕: [], 设施搬迁拖动点: [] };
  const runtime = { layout: { name: "主界面" }, timeScale: 1, globalVars: g,
    objects: Object.fromEntries(Object.entries(objects).map(([name, items]) => [name, { getAllInstances: () => items, getFirstInstance: () => items[0] }])),
    storage: { getItem: async k => clone(stored.get(k)), setItem: async (k, v) => { stored.set(k, clone(v)); } },
    callFunction(name, ...args) {
      calls.push([name, ...args]);
      const fn = methods.get(name);
      assert.ok(fn, `Unexpected native function ${name}`);
      const previous = fn.params; fn.params = args;
      try { return fn.block._RunAndBlock(); } finally { fn.params = previous; }
    },
  };
  function native(name, body) {
    const fn = { params: [], CaptureFunctionParameters() { return this.params; }, GetEventBlock() { return this.block; } };
    fn.block = { _RunAndBlock: () => body(...fn.params) }; methods.set(name, fn);
  }
  function stationAt(x, y) { return save.getAt(x - g.主地图编号起始 + 150, y - g.主地图编号起始, 6); }
  native("锻造材料编号", (_, index) => index);
  native("锻造材料数量", (_, tier, index, multiplier) => (index === 1 ? 2 : 3) * multiplier);
  native("失去材料", (amount, id) => { if (!f.refusePayment || id === 1) save.setAt(save.getAt(id, 6, 0) - amount, id, 6, 0); });
  native("生成单体设施", () => {});
  native("背包容量上限", () => f.capacity ?? 60);
  native("出售物品", row => {
    if (f.refuseSale) return;
    save.setAt(save.getAt(1,2,0)+123,1,2,0);
    for (let field=0;field<50;field++) save.setAt(0,row,field,7);
  });
  native("获得物品", (check, recipe, quality, level, tier, coefficient, count, full, n, method, autoSell) => {
    let row=1;while(row<save.width&&save.getAt(row,1,7)>0)row++;
    if (row>=save.width) return;
    save.setAt(row,row,0,7);save.setAt(recipe,row,1,7);save.setAt(1,row,2,7);save.setAt(tier,row,3,7);
    save.setAt(quality,row,5,7);save.setAt(level,row,6,7);save.setAt(coefficient,row,8,7);
    for(let i=0;i<6;i++)save.setAt(f.bonuses?.[i]??0,row,9+i,7);
    if(autoSell&&quality<=save.getAt(9,1,0)) runtime.callFunction("出售物品",row,false,true);
  });
  native("采集核心碰撞", (character, uid) => {
    const tile=tiles.find(t=>t.uid===uid), v=tile.instVars, station=stationAt(v.X坐标,v.Y坐标), q=save.getAt(station,3,21);
    const recipe=save.getAt(q,3,13);
    if(!q) return;
    save.setAt(save.getAt(q,8,13)-1,q,8,13);
    runtime.callFunction("获得物品",true,recipe,f.quality??3,1,save.getAt(q,5,13),200,1,false,0,"特定装备",true,false);
    if(save.getAt(q,8,13)<=0){runtime.callFunction("取消锻造",q,false);save.setAt(0,station,3,21);}
  });
  native("加入锻造队列", () => {
    if (f.refuseQueue) return;
    values[2] = 0;
    for (let id = 1; id < save.width; id++) if (save.getAt(id, 0, 13) <= 0) {
      [id, g.选中地块X, g.选中地块Y, g.锻造物品编号, 0, 1, values[1], 0, values[0], 0, 1000, 0]
        .forEach((value, field) => save.setAt(value, id, field, 13));
      values[2] = id; break;
    }
  });
  native("取消锻造", (queue, refund) => {
    if (refund) for (let id = 1; id <= 2; id++) save.setAt(save.getAt(id, 6, 0) +
      (id === 1 ? 2 : 3) * save.getAt(queue, 6, 13) * save.getAt(queue, 8, 13), id, 6, 0);
    for (let field = 0; field <= 11; field++) save.setAt(0, queue, field, 13);
  });
  native("取消设施进程", (x, y) => {
    const id = stationAt(x, y), queue = save.getAt(id, 3, 21);
    if (queue > 0) runtime.callFunction("取消锻造", queue, true);
    save.setAt(0, id, 3, 21);
  });
  native("删除地图设施", (x, y, a, b, c, region, d, moving) => {
    const id = stationAt(x, y);
    runtime.callFunction("取消设施进程", x, y, false, 0);
    if (!moving) {
      for (let field = 0; field <= 18; field++) save.setAt(0, id, field, 21);
      save.setAt(0, x - 10000 + 150, y - 10000, 6);
    }
  });
  const engine = { GetMainRunningLayout: () => runtime.layout,
    AddDOMComponentMessageHandler(name, action, handler) { handlers[action]=handler; },
    PostComponentMessageToDOM(name, action, data) { messages.push([action, clone(data)]); },
    GetEventSheetManager: () => ({ GetEventVariableBySID: sid => variables[[941173744256037, 351958427913412, 169707249134927].indexOf(sid)],
      GetFunctionBlockByName: name => methods.get(name), GetEventGroupByName: name => groups.get(name) }),
    FlushPendingInstances: () => { f.flushes++; } };
  const sandbox = { BanditFormations: {}, performance: { now: () => clock }, console: { error() {} } };
  vm.createContext(sandbox);
  for (const name of ["craft-sets.js", "craft-sets-runtime.js", "crafting.js"]) vm.runInContext(fs.readFileSync(`${__dirname}/../../src/${name}`, "utf8"), sandbox);
  const loop = sandbox.BanditFormations.attachCrafting(runtime, engine, text => notifications.push(text));
  save.setAt(12345678, 0, 1, 0);
  for (const id of Object.keys(recipes)) save.setAt(1, Number(id), 19, 0);
  for (let index = 0; index < 3; index++) {
    const id = index + 3, type = [21, 31, 41][index], x = 10020 + index, y = 10010, owner = 6 + index;
    tiles.push({ uid:200+index, instVars: { 用途: "主地图", 设施编号: type, X坐标: x, Y坐标: y, 有效解锁: true, 资源类型: "" } });
    [id, type, owner, 0].forEach((value, field) => save.setAt(value, id, field, 21));
    save.setAt(id, x - 10000 + 150, y - 10000, 6); save.setAt(1, owner, 1, 1);
  }
  const f = { save, runtime, engine, g, values, stored, calls, notifications, tiles, objects, methods, groups, handlers, messages, wp, catalog, loop, flushes: 0,
    status: () => messages.filter(m=>m[0]==="craft-status").at(-1)?.[1],
    async configure(changes={}) { await handlers["craft-configure"]({token:this.status().token, options:{...this.status().options,mode:"sets",roles:["forge","research"],...changes}}); },
    complete(index, bonuses=[], quality=3) { this.bonuses=bonuses;this.quality=quality;runtime.callFunction("采集核心碰撞",1,tiles[index].uid,0,0,0,0,0,0); },
    balance: () => [save.getAt(1, 6, 0), save.getAt(2, 6, 0)],
    materials(a = 10000, b = a) { save.setAt(a, 1, 6, 0); save.setAt(b, 2, 6, 0); },
    queue(index) { return save.getAt(index + 3, 3, 21); },
    remaining(index) { return save.getAt(this.queue(index), 8, 13); },
    async tick() { clock += 1000; loop.tick(); await settle(); },
    start(index, recipe = [1, 16, 30][index], multiplier = 1, count = 2) {
      const v = tiles[index].instVars;
      Object.assign(g, { 选中地块X: v.X坐标, 选中地块Y: v.Y坐标, 锻造物品编号: recipe });
      values[0] = count; values[1] = multiplier;
      runtime.callFunction("加入锻造队列", false); save.setAt(values[2], index + 3, 3, 21);
    },
    finish(index) {
      const queue = this.queue(index); save.setAt(0, queue, 8, 13);
      runtime.callFunction("取消锻造", queue, false); save.setAt(0, index + 3, 3, 21);
    },
    cancel(index) { const v = tiles[index].instVars; runtime.callFunction("取消设施进程", v.X坐标, v.Y坐标, true, 0); },
  };
  f.materials();
  return f;
}

module.exports = { fixture };
