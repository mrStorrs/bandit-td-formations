(() => {
  "use strict";
  function attachRecipeCosts(runtime, engine, notify) {
    const first = name => runtime.objects[name]?.getFirstInstance();
    // Supported builds use queue fields 0–11. Keep the paid cost with the queue
    // so cancellation after a reload uses the material prices paid at purchase.
    const costField = 12, rootCost = "cjs-roots-v1", realm2Cost = "cjs-realm2-v1";
    let hooked = false, failed = false, costMode = realm2Cost;
    const replacements = new Map();
    function realm2Ingredient(recipe, part) {
      if (first("wp")?.getAt(recipe, 3) !== 2 || ![1, 2].includes(part)) return 0;
      const key = `${recipe}:${part}`;
      if (replacements.has(key)) return replacements.get(key);
      const previous = costMode;
      // Query the native prices without applying our own replacement recursively.
      costMode = 0;
      try {
        const material = runtime.callFunction("锻造材料编号", recipe, part), cl = first("cl");
        if (cl.getAt(material, 2) !== 1 || cl.getAt(material + 1, 2) !== 2 ||
            cl.getAt(material, 3) !== cl.getAt(material + 1, 3) ||
            runtime.callFunction("锻造材料数量", recipe, 2, part, 1, 0) !== 17000) return 0;
        replacements.set(key, material + 1);
        return material + 1;
      } finally { costMode = previous; }
    }
    // Queues from the earlier roots-only adjustment must keep that exact refund.
    const rootIngredient = recipe => {
      const wp = first("wp");
      if (wp?.getAt(recipe, 3) !== 2) return 0;
      if (wp.getAt(recipe, 4) === "普通丹药" && wp.getAt(recipe, 5) === "丹药") return 1;
      return wp.getAt(recipe, 4) === "普通" && wp.getAt(recipe, 5) === "装备" &&
        [3, 4].includes(wp.getAt(recipe, 6)) ? 2 : 0;
    };
    return {
      tick() {
        if (hooked || failed || !engine.GetMainRunningLayout() || !first("wp") || !first("cl")) return;
        try {
          const manager = engine.GetEventSheetManager();
          const functions = ["锻造材料编号", "锻造材料数量", "加入锻造队列", "取消锻造"]
            .map(name => manager.GetFunctionBlockByName(name));
          const queueId = manager.GetEventVariableBySID(169707249134927);
          if (functions.some(fn => typeof fn?.GetEventBlock()?._RunAndBlock !== "function" ||
              typeof fn.CaptureFunctionParameters !== "function") || typeof queueId?.GetValue !== "function" ||
              typeof engine.GetEventStack !== "function") throw new Error("Recipe cost hooks are unavailable in this game build.");
          functions.forEach((fn, index) => {
            const block = fn.GetEventBlock(), run = block._RunAndBlock;
            block._RunAndBlock = function (...args) {
              const params = fn.CaptureFunctionParameters(), save = first("save"), previous = costMode;
              if (index === 3) costMode = save?.getAt(params[0], costField, 13);
              try {
                const result = run.apply(this, args);
                if (index <= 1) {
                  const part = params[index === 0 ? 1 : 2];
                  const material = costMode === realm2Cost ? realm2Ingredient(params[0], part) :
                    costMode === rootCost && part > 0 && part === rootIngredient(params[0]) ? 22 : 0;
                  if (material && (costMode === rootCost || index === 0 || params[1] === 2)) {
                    const value = index === 0 ? material : 1000 * params[3];
                    engine.GetEventStack().GetCurrentExpFuncStackFrame().SetFunctionReturnValue(value);
                  }
                }
                if (index === 2 && save) {
                  const id = queueId.GetValue();
                  if (id > 0 && save.getAt(id, 0, 13) === id) {
                    const recipe = save.getAt(id, 3, 13);
                    save.setAt([1, 2].some(part => realm2Ingredient(recipe, part)) ? realm2Cost : 0, id, costField, 13);
                  }
                }
                if (index === 3 && save?.getAt(params[0], 0, 13) === 0) save.setAt(0, params[0], costField, 13);
                return result;
              } finally { costMode = previous; }
            };
          });
          hooked = true;
        } catch (error) {
          failed = true;
          console.error("[Bandit TD Formations] Recipe cost adjustment unavailable", error);
          notify(`Recipe cost adjustment unavailable: ${error.message}`);
        }
      },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachRecipeCosts });
})();
