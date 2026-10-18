(() => {
  "use strict";
  const jobs = new Set(["伐木", "采矿", "种植"]);

  function attachGathering(runtime, engine, notify) {
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const first = name => runtime.objects[name]?.getFirstInstance();
    const listening = new WeakSet();
    let focus = new WeakMap(), token = "", hooked = false, failed = false;
    const fail = error => {
      if (failed) return;
      failed = true;
      console.error("[Bandit TD Formations] Gatherer focus unavailable", error);
      notify(`Gatherer focus unavailable: ${error.message}`);
    };
    function context() {
      const save = first("save"), g = runtime.globalVars;
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面" || !save ||
          !Number.isSafeInteger(g["主地图编号起始"]) || g["主地图编号起始"] <= 0) return null;
      const id = save.getAt(0, 1, 0);
      if (!Number.isSafeInteger(id) || id < 10000000) return null;
      const current = `${id}:${save.uid}:${g["当前地图编号"]}:${g["主地图编号起始"]}`;
      if (token !== current) { token = current; focus = new WeakMap(); }
      return { save, base: g["主地图编号起始"] };
    }
    function resources({ save, base }) {
      const targets = [];
      for (const tile of all("地面")) {
        const v = tile.instVars;
        if (v["用途"] !== "主地图" || v["区域"] !== "山寨" || !v["有效解锁"] ||
            !jobs.has(v["资源类型"]) || v["城墙标识"] === 1) continue;
        const x = v["X坐标"] - base, y = v["Y坐标"] - base;
        let remaining, identity;
        if (v["设施编号"] > 0) {
          const id = save.getAt(x + 150, y, 6);
          if (id <= 0 || save.getAt(id, 0, 21) !== id || save.getAt(id, 1, 21) !== v["设施编号"]) continue;
          remaining = save.getAt(id, 4, 21);
          identity = `${tile.uid}:${id}:${v["设施编号"]}:${save.getAt(id, 3, 21)}`;
        } else if (v["材料编号"] > 0) {
          remaining = save.getAt(x + 100, y, 6);
          identity = `${tile.uid}:resource:${v["材料编号"]}`;
        } else continue;
        if (Number.isFinite(remaining) && remaining > 0) targets.push({ tile, remaining, identity });
      }
      return targets;
    }
    function select(core, targets) {
      const v = core.instVars, turret = core.behaviors["生产炮台"], job = v["执行状态"];
      if (!turret?.isEnabled || !jobs.has(job) || ![job, "自动"].includes(v["设定状态"]) ||
          v["特殊状态"] === "突破" || core.behaviors.DragDrop?.isDragging ||
          (v["X坐标"] >= 20000 && v["X坐标"] < 30000)) {
        focus.delete(core); return;
      }
      const candidates = targets.filter(({ tile }) => tile.instVars["资源类型"] === job &&
        (tile.x - core.x) ** 2 + (tile.y - core.y) ** 2 <= turret.range ** 2);
      const assignment = `${v["设定状态"]}:${job}:${v["X坐标"]}:${v["Y坐标"]}`;
      const old = focus.get(core);
      let target = old?.assignment === assignment && candidates.find(t =>
        t.identity === old.identity && t.remaining <= old.remaining);
      if (!target) target = candidates.reduce((best, t) => !best || t.remaining < best.remaining ||
        (t.remaining === best.remaining && t.tile.uid < best.tile.uid) ? t : best, null);
      if (!target) {
        if (old && turret.currentTarget?.uid === old.uid) turret.currentTarget = null;
        focus.delete(core); return;
      }
      focus.set(core, { assignment, identity: target.identity, remaining: target.remaining, uid: target.tile.uid });
      if (turret.currentTarget?.uid !== target.tile.uid) turret.currentTarget = target.tile;
    }
    function refresh(core) {
      if (failed) return;
      try {
        const current = context();
        if (current) select(core, resources(current));
      } catch (error) { fail(error); }
    }
    return {
      leave() { token = ""; focus = new WeakMap(); },
      tick() {
        if (failed) return;
        try {
          const current = context();
          if (!current) return;
          const cores = all("角色核心").filter(c => c.behaviors["生产炮台"]);
          if (!cores.length) return;
          if (!hooked) {
            const fn = engine.GetEventSheetManager().GetFunctionBlockByName("角色自动逻辑"), block = fn?.GetEventBlock();
            if (typeof block?._RunAndBlock !== "function" || typeof fn.CaptureFunctionParameters !== "function") {
              throw new Error("Gathering hooks are unavailable in this game build.");
            }
            const run = block._RunAndBlock;
            block._RunAndBlock = function (...args) {
              const id = fn.CaptureFunctionParameters()[0], result = run.apply(this, args);
              const core = all("角色核心").find(c => c.instVars["角色序号"] === id);
              if (core) refresh(core);
              return result;
            };
            hooked = true;
          }
          const targets = resources(current);
          for (const core of cores) {
            if (!listening.has(core)) {
              // The script shoot event runs before the native gather action.
              // Recheck depletion here so a worker never wastes a swing on the
              // resource another worker just finished earlier in the same tick.
              core.behaviors["生产炮台"].addEventListener("shoot", () => refresh(core));
              listening.add(core);
            }
            select(core, targets);
          }
        } catch (error) { fail(error); }
      },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachGathering });
})();
