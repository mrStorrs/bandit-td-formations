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
    [66, [2, "普通丹药", "丹药", 0]], [120, [2, "套装", "装备", 3]]]);
  const wp = { getAt: (id, field) => recipes.get(id)?.[field - 3] ?? 0 };
  const objects = { save, wp, cl: {} };
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
    ret(wp.getAt(recipe, 5) === "丹药" ? (part === 1 ? 21 : 2) : (part === 2 ? 21 : 12));
  });
  fn("锻造材料数量", () => {
    const p = functions.get("锻造材料数量").params, herbPart = wp.getAt(p[0], 5) === "丹药" ? 1 : 2;
    ret((p[2] === herbPart ? 17000 : 1000) * p[3]);
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
  return { runtime, save, mod, refunds, messages, cells, manager, call: runtime.callFunction.bind(runtime) };
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
test("other realms, forge recipes and special equipment keep native costs", () => {
  const f = fixture(); f.mod.tick();
  for (const recipe of [19, 165, 76, 88, 120, 0]) {
    assert.equal(f.call("锻造材料编号", recipe, 2), 21);
    assert.equal(f.call("锻造材料数量", recipe, 2, 2, 10, 0), 170000);
  }
  for (const recipe of [55, 67]) {
    assert.equal(f.call("锻造材料编号", recipe, 1), 21);
    assert.equal(f.call("锻造材料数量", recipe, 2, 1, 10, 0), 170000);
    assert.equal(f.call("锻造材料编号", recipe, 2), 2);
  }
});
test("new queues remember roots through reload and refund only remaining crafts", () => {
  for (const recipe of [91, 64, 65, 66]) {
    const f = fixture(); f.mod.tick(); f.call("加入锻造队列", recipe, 10, 10);
    f.save.setAt(7, 1, 8, 13);
    const reloaded = fixture(new Map(f.cells)); reloaded.mod.tick(); reloaded.call("取消锻造", 1, true);
    assert.deepEqual(reloaded.refunds, recipe === 91 ? [[12, 70000], [22, 70000]] : [[22, 70000], [2, 70000]]);
    assert.equal(reloaded.save.getAt(1, 12, 13), 0);
  }
});
test("pre-update queues refund their original herbs and do not affect later price calls", () => {
  for (const recipe of [91, 64, 65, 66]) {
    const f = fixture(); f.call("加入锻造队列", recipe, 1, 4); f.mod.tick(); f.call("取消锻造", 1, true);
    assert.deepEqual(f.refunds, recipe === 91 ? [[12, 4000], [21, 68000]] : [[21, 68000], [2, 4000]]);
    assert.equal(f.call("锻造材料编号", recipe, recipe === 91 ? 2 : 1), 22);
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
