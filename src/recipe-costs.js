(() => {
  "use strict";
  function attachRecipeCosts(runtime, engine, notify) {
    const first = name => runtime.objects[name]?.getFirstInstance();
    // Supported builds use queue fields 0–11. Keep the paid cost with the queue
    // so cancellation after a reload refunds roots, while older queues refund herbs.
    const costField = 12, rootCost = "cjs-roots-v1";
    let hooked = false, failed = false, legacyRefund = false;
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
              const params = fn.CaptureFunctionParameters(), save = first("save"), previous = legacyRefund;
              if (index === 3) legacyRefund = save?.getAt(params[0], costField, 13) !== rootCost;
              try {
                const result = run.apply(this, args);
                if (index <= 1 && !legacyRefund) {
                  const part = rootIngredient(params[0]);
                  if (part && params[index === 0 ? 1 : 2] === part) {
                    const value = index === 0 ? 22 : 1000 * params[3];
                    engine.GetEventStack().GetCurrentExpFuncStackFrame().SetFunctionReturnValue(value);
                  }
                }
                if (index === 2 && save) {
                  const id = queueId.GetValue();
                  if (id > 0 && save.getAt(id, 0, 13) === id) {
                    save.setAt(rootIngredient(save.getAt(id, 3, 13)) ? rootCost : 0, id, costField, 13);
                  }
                }
                if (index === 3 && save?.getAt(params[0], 0, 13) === 0) save.setAt(0, params[0], costField, 13);
                return result;
              } finally { legacyRefund = previous; }
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
