"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture(saved = new Map()) {
  const cells = saved, messages = [], functions = new Map(), frames = [];
  const save = { getAt: (...p) => cells.get(p.join()) ?? 0, setAt: (v, ...p) => cells.set(p.join(), v) };
  const recipes = new Map([[91, [2, "普通", "装备", 3]], [100, [2, "普通", "装备", 4]],
    [19, [1, "普通", "装备", 3]], [165, [3, "普通", "装备", 3]],
    [76, [2, "普通", "装备", 1]], [88, [2, "普通", "装备", 2]],
    [55, [1, "普通丹药", "丹药", 0]], [67, [3, "普通丹药", "丹药", 0]],
    [64, [2, "普通丹药", "丹药", 0]], [65, [2, "普通丹药", "丹药", 0]],
    [66, [2, "普通丹药", "丹药", 0]], [292, [2, "套装", "装备", 1]],
    [294, [2, "套装", "装备", 3]]]);
  const wp = { getAt: (id, field) => recipes.get(id)?.[field - 3] ?? 0 };
  const cl = { getAt: (id, field) => field === 2 ? id % 10 : Math.floor(id / 10) };
  const objects = { save, wp, cl };
  const ingredients = new Map(), amounts = new Map();
  const material = (recipe, part) => {
    if (ingredients.has(`${recipe}:${part}`)) return ingredients.get(`${recipe}:${part}`);
    const tier = wp.getAt(recipe, 3), equipment = wp.getAt(recipe, 5) === "装备";
    const forge = equipment && [1, 2].includes(wp.getAt(recipe, 6));
    if (equipment) return part === 1 ? (forge ? 1 : 11) + Math.floor(tier / 2) :
      (forge ? 11 : 21) + Math.floor((tier + 1) / 2) - 1;
    return part === 1 ? 21 + Math.floor((tier + 1) / 2) - 1 : 1 + Math.floor(tier / 2);
  };
  let queue = 0;
  function fn(name, run) {
    const f = { params: [], CaptureFunctionParameters() { return this.params; }, GetEventBlock: () => block };
    const block = { _RunAndBlock: run }; functions.set(name, f); return f;
  }
  const runtime = {
    objects: Object.fromEntries(Object.entries(objects).map(([name, obj]) => [name, { getFirstInstance: () => obj }])),
    callFunction(name, ...params) {
      const f = functions.get(name), previous = f.params, frame = { value: 0, SetFunctionReturnValue(v) { this.value = v; } };
      frames.push(frame); f.params = params;
      try { f.GetEventBlock()._RunAndBlock(); return frame.value; }
      finally { f.params = previous; frames.pop(); }
    },
  };
  const ret = value => frames.at(-1).SetFunctionReturnValue(value);
  fn("锻造材料编号", () => {
    const [recipe, part] = functions.get("锻造材料编号").params;
    ret(material(recipe, part));
  });
  fn("锻造材料数量", () => {
    const [recipe, tier, part, multiplier] = functions.get("锻造材料数量").params;
    ret((amounts.get(`${recipe}:${part}`) ?? (tier > cl.getAt(material(recipe, part), 2) ? 17000 : 1000)) * multiplier);
  });
  fn("加入锻造队列", () => {
    const [recipe, multiplier = 1, count = 10] = functions.get("加入锻造队列").params;
    queue = 1;
    for (const [field, value] of [[0, queue], [3, recipe], [5, wp.getAt(recipe, 3)], [6, multiplier], [8, count]]) save.setAt(value, queue, field, 13);
  });
  const refunds = [];
  fn("取消锻造", () => {
    const [id, refund] = functions.get("取消锻造").params;
    if (refund) for (const part of [1, 2]) refunds.push([
      runtime.callFunction("锻造材料编号", save.getAt(id, 3, 13), part),
      runtime.callFunction("锻造材料数量", save.getAt(id, 3, 13), save.getAt(id, 5, 13), part, save.getAt(id, 6, 13), 0) * save.getAt(id, 8, 13),
    ]);
    for (let i = 0; i <= 11; i++) save.setAt(0, id, i, 13);
  });
  const manager = { GetFunctionBlockByName: name => functions.get(name), GetEventVariableBySID: () => ({ GetValue: () => queue }) };
  const engine = { GetMainRunningLayout: () => ({}), GetEventSheetManager: () => manager,
    GetEventStack: () => ({ GetCurrentExpFuncStackFrame: () => frames.at(-1) }) };
  const sandbox = { BanditFormations: {}, console: { error() {} } }; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${__dirname}/../src/recipe-costs.js`, "utf8"), sandbox);
  const mod = sandbox.BanditFormations.attachRecipeCosts(runtime, engine, text => messages.push(text));
  return { runtime, save, mod, refunds, messages, cells, manager, ingredients, amounts, call: runtime.callFunction.bind(runtime) };
}

test("all realm 2 crafting gear costs 1,000 roots per piece with native multipliers", () => {
  const f = fixture(); f.mod.tick(); f.mod.tick();
  for (const recipe of [91, 100]) for (const multiplier of [1, 10, 100]) {
    assert.equal(f.call("锻造材料编号", recipe, 2), 22);
    assert.equal(f.call("锻造材料数量", recipe, 2, 2, multiplier, 0), 1000 * multiplier);
    assert.equal(f.call("锻造材料编号", recipe, 1), 12);
    assert.equal(f.call("锻造材料数量", recipe, 2, 1, multiplier, 0), 1000 * multiplier);
  }
  assert.deepEqual(f.messages, []);
});
test("realm 2 STR, AGI and INT pills replace only their herb ingredient with 1,000 roots", () => {
  const f = fixture(); f.mod.tick();
  for (const recipe of [64, 65, 66]) for (const multiplier of [1, 10, 100]) {
    assert.equal(f.call("锻造材料编号", recipe, 1), 22);
    assert.equal(f.call("锻造材料数量", recipe, 2, 1, multiplier, 0), 1000 * multiplier);
    assert.equal(f.call("锻造材料编号", recipe, 2), 2);
    assert.equal(f.call("锻造材料数量", recipe, 2, 2, multiplier, 0), 1000 * multiplier);
  }
  assert.deepEqual(f.messages, []);
});
test("realm 2 forge weapons, gloves and matching set recipes replace stone with iron ore", () => {
  const f = fixture(); f.mod.tick();
  for (const recipe of [76, 88, 292]) for (const multiplier of [1, 10, 100]) {
    assert.equal(f.call("锻造材料编号", recipe, 2), 12);
    assert.equal(f.call("锻造材料数量", recipe, 2, 2, multiplier, 0), 1000 * multiplier);
    assert.equal(f.call("锻造材料编号", recipe, 1), 2);
    assert.equal(f.call("锻造材料数量", recipe, 2, 1, multiplier, 0), 1000 * multiplier);
  }
  assert.equal(f.call("锻造材料编号", 294, 2), 22);
  assert.equal(f.call("锻造材料数量", 294, 2, 2, 1, 0), 1000);
});
test("other realms and non-17,000 ingredients keep native costs", () => {
  const f = fixture();
  f.amounts.set("76:2", 16000);
  const queries = [[19, 1], [165, 3], [55, 1], [67, 3], [0, 0], [76, 2]];
  const costs = () => queries.map(([recipe, tier]) => [1, 2].map(part => [
    f.call("锻造材料编号", recipe, part), f.call("锻造材料数量", recipe, tier, part, 10, 0),
  ]));
  const before = costs(); f.mod.tick(); assert.deepEqual(costs(), before);
});
test("either ingredient can replace a 17,000 realm 1 material with its realm 2 equivalent", () => {
  for (const oldMaterial of [1, 11, 21]) for (const part of [1, 2]) {
    const f = fixture(); f.ingredients.set(`76:${part}`, oldMaterial); f.mod.tick();
    assert.equal(f.call("锻造材料编号", 76, part), oldMaterial + 1);
    assert.equal(f.call("锻造材料数量", 76, 2, part, 10, 0), 10000);
  }
});
test("price lookups work before material lookups without discounting existing realm 2 ingredients", () => {
  const f = fixture(); f.amounts.set("76:1", 17000); f.mod.tick();
  assert.equal(f.call("锻造材料数量", 76, 2, 2, 10, 0), 10000);
  assert.equal(f.call("锻造材料编号", 76, 2), 12);
  assert.equal(f.call("锻造材料数量", 76, 2, 1, 10, 0), 170000);
  assert.equal(f.call("锻造材料编号", 76, 1), 2);
});
test("new queues remember realm 2 materials through reload and refund only remaining crafts", () => {
  for (const recipe of [76, 88, 292, 294, 91, 64, 65, 66]) {
    const f = fixture(); f.mod.tick(); f.call("加入锻造队列", recipe, 10, 10);
    f.save.setAt(7, 1, 8, 13);
    const reloaded = fixture(new Map(f.cells)); reloaded.mod.tick(); reloaded.call("取消锻造", 1, true);
    const expected = [76, 88, 292].includes(recipe) ? [[2, 70000], [12, 70000]] :
      [91, 294].includes(recipe) ? [[12, 70000], [22, 70000]] : [[22, 70000], [2, 70000]];
    assert.deepEqual(reloaded.refunds, expected);
    assert.equal(reloaded.save.getAt(1, 12, 13), 0);
  }
});
test("unmarked queues refund their original materials and later prices use the new costs", () => {
  for (const recipe of [76, 88, 91, 64, 65, 66]) {
    const f = fixture(); f.call("加入锻造队列", recipe, 1, 4);
    const part = [64, 65, 66].includes(recipe) ? 1 : 2;
    const expected = [1, 2].map(p => [f.call("锻造材料编号", recipe, p), f.call("锻造材料数量", recipe, 2, p, 1, 0) * 4]);
    f.mod.tick(); f.call("取消锻造", 1, true);
    assert.deepEqual(f.refunds, expected);
    assert.equal(f.call("锻造材料编号", recipe, part), [76, 88].includes(recipe) ? 12 : 22);
  }
});
test("queues from the earlier roots update retain exactly their paid costs after reload", () => {
  for (const recipe of [76, 91, 64, 294]) {
    const f = fixture(); f.call("加入锻造队列", recipe, 10, 4); f.save.setAt("cjs-roots-v1", 1, 12, 13);
    const reloaded = fixture(new Map(f.cells)); reloaded.mod.tick(); reloaded.call("取消锻造", 1, true);
    const expected = recipe === 76 ? [[2, 40000], [11, 680000]] :
      recipe === 294 ? [[12, 40000], [21, 680000]] :
      recipe === 91 ? [[12, 40000], [22, 40000]] : [[22, 40000], [2, 40000]];
    assert.deepEqual(reloaded.refunds, expected);
    assert.equal(reloaded.call("锻造材料数量", recipe, 2, 2, 1, 0), 1000);
  }
});
test("completed and reused queue slots clear cost markers", () => {
  const f = fixture(); f.mod.tick(); f.call("加入锻造队列", 91); f.call("取消锻造", 1, false);
  assert.deepEqual(f.refunds, []); assert.equal(f.save.getAt(1, 12, 13), 0);
  f.save.setAt("cjs-roots-v1", 1, 12, 13); f.call("加入锻造队列", 19);
  assert.equal(f.save.getAt(1, 12, 13), 0);
});
test("missing recipe hooks leave native functions unchanged and report once", () => {
  const f = fixture(); f.manager.GetEventVariableBySID = () => null;
  f.mod.tick(); f.mod.tick();
  assert.equal(f.messages.length, 1); assert.equal(f.call("锻造材料编号", 91, 2), 21);
});
