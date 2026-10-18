(() => {
  "use strict";
  const component = "cjs-formations";
  const createRuntime = self.C3_CreateRuntime;
  let engine;
  self.C3_CreateRuntime = (...args) => (engine = createRuntime(...args));

  runOnStartup(runtime => {
    const { Hotkeys, CombatToggle, ForestLoop, tileKey } = globalThis.BanditFormations;
    const first = name => runtime.objects[name]?.getFirstInstance();
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const notify = text => engine.PostComponentMessageToDOM(component, "notify", { text });
    const outfits = globalThis.BanditFormations.attachOutfits(runtime, engine, notify);

    function context() {
      const g = runtime.globalVars;
      if (!outfits.ready()) return null;
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面" || g["分页界面"] || g["爬塔挑战开关"] ||
          all("二级页面背景").length ||
          all("角色拖动点").length || all("建造拖动点").length || all("搬迁拖动点").length) return null;
      const save = first("save"), cores = all("角色核心");
      if (!save || !cores.length || cores.some(c => c.behaviors.DragDrop?.isDragging)) return null;
      const saveId = save.getAt(0, 1, 0), mapId = g["当前地图编号"];
      if (!Number.isSafeInteger(saveId) || saveId < 10000000 || !Number.isSafeInteger(mapId)) return null;
      const characters = cores.map(core => {
        const v = core.instVars, id = v["角色序号"];
        return {
          id, identity: JSON.stringify([save.getAt(id, 1, 2), save.getAt(id, 5, 2), save.getAt(id, 51, 2)]),
          x: v["X坐标"], y: v["Y坐标"], core,
          mode: v["设定状态"], priorityX: save.getAt(id, 57, 2), priorityY: save.getAt(id, 58, 2),
        };
      });
      const buildings = first("jz");
      const tiles = all("地面").map(instance => {
        const v = instance.instVars, building = v["建筑序号"];
        const slot = building > 0 && buildings.getAt(v["建筑编号"], 32) === 1 && save.getAt(building, 4, 1) <= 0;
        return {
          x: v["X坐标"], y: v["Y坐标"], allowed: !!v["角色许可"] || slot,
          occupied: !!v["占用开关"], building: slot ? building : 0,
          buildingOccupant: slot ? save.getAt(building, 7, 1) : 0, instance,
        };
      });
      return { saveId, mapId, token: `${saveId}:${mapId}:${cores[0].uid}`, characters, tiles, save };
    }

    async function apply({ moves, changes }, current) {
      const tiles = new Map(current.tiles.map(t => [tileKey(t), t]));
      // The native move function clears each source tile. Reconcile occupancy
      // after the synchronous batch so swaps do not leave occupied tiles free.
      for (const move of moves) {
        runtime.callFunction("角色位置移动", move.id, move.x, move.y, "主地图", false);
        if (move.from.core.instVars["X坐标"] !== move.x || move.from.core.instVars["Y坐标"] !== move.y) {
          throw new Error("The game refused a character move. Restore was interrupted.");
        }
      }
      const affected = new Set(moves.flatMap(m => [tileKey(m), tileKey(m.from)]));
      const occupants = new Map(all("角色核心").map(c => [
        `${c.instVars["X坐标"]},${c.instVars["Y坐标"]}`, c,
      ]));
      for (const key of affected) {
        const tile = tiles.get(key);
        if (!tile) continue;
        const occupant = occupants.get(key);
        if (tile.building) {
          current.save.setAt(occupant ? occupant.instVars["角色序号"] : 0, tile.building, 7, 1);
          if (occupant) occupant.instVars["特殊状态"] = "突破";
        } else {
          tile.instance.instVars["占用开关"] = !!occupant;
        }
      }
      // Moving clears work priorities. Apply the saved jobs after all moves,
      // including characters already standing on their destination tiles.
      await applyModes({ changes }, current);
      for (const move of moves) runtime.callFunction("角色自动逻辑", move.id);
    }

    async function applyModes({ changes }, current) {
      for (const { id, mode, priorityX, priorityY, from } of changes) {
        runtime.callFunction("改变角色状态", id, mode);
        if (current.save.getAt(id, 9, 2) !== mode || from.core.instVars["设定状态"] !== mode) {
          throw new Error("The game refused a job change. Restore was interrupted.");
        }
        // Native mode switching clears these four fields. Restore the saved
        // target before its delayed AI refresh, just as the work-target UI does.
        from.core.instVars["优先工作目标X"] = priorityX;
        from.core.instVars["优先工作目标Y"] = priorityY;
        current.save.setAt(priorityX, id, 57, 2);
        current.save.setAt(priorityY, id, 58, 2);
        outfits.request(id);
      }
      await outfits.flush();
      const latest = context();
      if (latest?.token !== current.token || changes.some(change => !latest.characters.some(c =>
        c.id === change.id && c.identity === change.from.identity && c.mode === change.mode &&
        c.priorityX === change.priorityX && c.priorityY === change.priorityY))) {
        throw new Error("The character or job changed during the outfit swap. Recall the formation again.");
      }
    }

    // Use the same map category as native auto-summon across all beast realms.
    const isBeastMap = mapId => Number.isSafeInteger(mapId) && first("zddt")?.getAt(mapId, 2) === "野外";
    let victories = 0, victoryHooked = false;
    function forestContext() {
      const g = runtime.globalVars, save = first("save"), cores = all("角色核心");
      const mapId = g["当前地图编号"];
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面" ||
          !isBeastMap(mapId) || !save || !cores.length) return null;
      const saveId = save.getAt(0, 1, 0);
      if (!Number.isSafeInteger(saveId) || saveId < 10000000) return null;
      const current = context();
      const blocked = !current || g["游戏暂停"] || !g["战斗开关"] || runtime.timeScale === 0 ||
        g["挑战城市开关"] || g["占领城市开关"] ||
        ["转场云", "世界地图", "提示信息", "对话选择框"].some(name => all(name).length) ||
        all("黑幕").some(instance => instance.isVisible);
      const threshold = blocked ? Infinity : runtime.callFunction("威胁度上限");
      return { ...current, saveId, mapId, token: `${saveId}:${mapId}:${cores[0].uid}`, blocked,
        active: !!g["挑战灵兽开关"], victories,
        ready: Number.isFinite(threshold) && threshold > 0 && Number(save.getAt(mapId, 10, 0)) >= threshold };
    }
    function suspendNativeAuto() {
      const manager = engine.GetEventSheetManager();
      const group = manager.GetEventGroupByName("自动开启灵兽挑战");
      const victory = manager.GetFunctionBlockByName("灵兽胜利")?.GetEventBlock();
      if (!group || typeof victory?._RunAndBlock !== "function") {
        throw new Error("Beast realm summon hooks are unavailable in this game build.");
      }
      if (!victoryHooked) {
        // Both native event calls and script calls enter this block. Observe the
        // actual victory function so timeouts/aborted fights never count as wins.
        const run = victory._RunAndBlock;
        victory._RunAndBlock = function (...args) {
          const result = run.apply(this, args);
          if (isBeastMap(runtime.globalVars["当前地图编号"])) victories++;
          return result;
        };
        victoryHooked = true;
      }
      const active = group.IsGroupActive();
      group.SetGroupActive(false);
      return () => group.SetGroupActive(active);
    }
    const hotkeys = new Hotkeys({ context, storage: runtime.storage, apply, notify,
      onSave: (slot, current) => { if (isBeastMap(current.mapId) && slot <= 2) forest.formationSaved(); } });
    const buildingHotkeys = globalThis.BanditFormations.attachBuildingFormations(runtime, engine, notify);
    const cancelKeys = () => { hotkeys.cancel(); buildingHotkeys.cancel(); };
    const combat = new CombatToggle({ context, storage: runtime.storage, apply: applyModes, notify });
    const forest = new ForestLoop({ context: forestContext, storage: runtime.storage, apply, notify,
      available: () => !hotkeys.pending && !hotkeys.busy && !buildingHotkeys.pending && !buildingHotkeys.busy && !combat.busy,
      status: text => engine.PostComponentMessageToDOM(component, "forest-status", { text }),
      suspendAuto: suspendNativeAuto,
      summon: current => {
        const latest = forestContext();
        if (!latest || latest.token !== current.token || latest.blocked || !latest.ready || latest.active) {
          throw new Error("Summon is no longer ready. Toggle F6 off/on to retry.");
        }
        runtime.callFunction("开始灵兽挑战", latest.mapId);
        if (!runtime.globalVars["挑战灵兽开关"]) throw new Error("The game refused the summon. Toggle F6 off/on to retry.");
      },
    });
    const recruitment = globalThis.BanditFormations.attachRecruitment(runtime, engine, notify);
    const crafting = globalThis.BanditFormations.attachCrafting(runtime, engine, notify);
    const study = globalThis.BanditFormations.attachStudy(runtime, engine, notify);
    engine.AddDOMComponentMessageHandler(component, "forest", () => { cancelKeys(); forest.toggle(); });
    engine.AddDOMComponentMessageHandler(component, "combat", () => {
      cancelKeys();
      if (!hotkeys.busy && !buildingHotkeys.busy) return combat.toggle();
    });
    engine.AddDOMComponentMessageHandler(component, "key", ({ phase, slot }) => {
      buildingHotkeys.cancel();
      if (!combat.busy && !buildingHotkeys.busy) return hotkeys.key(phase, slot);
    });
    engine.AddDOMComponentMessageHandler(component, "building-key", ({ phase, slot }) => {
      hotkeys.cancel();
      if (!combat.busy && !hotkeys.busy && outfits.ready()) return buildingHotkeys.key(phase, slot);
    });
    engine.AddDOMComponentMessageHandler(component, "cancel", cancelKeys);
    runtime.addEventListener("tick", () => { outfits.tick(); recruitment.tick(); crafting.tick(); study.tick(); return hotkeys.tick() || buildingHotkeys.tick() || forest.tick(); });
    runtime.addEventListener("beforelayoutstart", () => { cancelKeys(); forest.leave(); recruitment.leave(); outfits.leave(); crafting.leave(); study.leave(); });
    engine.PostComponentMessageToDOM(component, "ready", { version: "1.12.1" });
    console.info("[Bandit TD Formations] v1.12.1 ready: hold 1–4 to save positions and jobs, tap to restore; Shift + 1–4 for buildings; C toggles combat; Beast realm loop on, F6 toggles; auto recruit controls on the recruitment screen; Automation controls at the lower right for crafting, research and drilling; per-job outfits on the character panel.");
  });
})();
