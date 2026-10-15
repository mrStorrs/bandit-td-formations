(() => {
  "use strict";
  const component = "cjs-formations";
  const createRuntime = self.C3_CreateRuntime;
  let engine;
  self.C3_CreateRuntime = (...args) => (engine = createRuntime(...args));

  runOnStartup(runtime => {
    const { Hotkeys, tileKey } = globalThis.BanditFormations;
    const first = name => runtime.objects[name]?.getFirstInstance();
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const notify = text => engine.PostComponentMessageToDOM(component, "notify", { text });

    function context() {
      const g = runtime.globalVars;
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面" || g["分页界面"] || g["爬塔挑战开关"] ||
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

    function apply({ moves }, current) {
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
      for (const move of moves) runtime.callFunction("角色自动逻辑", move.id);
    }

    const hotkeys = new Hotkeys({ context, storage: runtime.storage, apply, notify });
    engine.AddDOMComponentMessageHandler(component, "key", ({ phase, slot }) => hotkeys.key(phase, slot));
    engine.AddDOMComponentMessageHandler(component, "cancel", () => hotkeys.cancel());
    runtime.addEventListener("tick", () => hotkeys.tick());
    runtime.addEventListener("beforelayoutstart", () => hotkeys.cancel());
    engine.PostComponentMessageToDOM(component, "ready", {});
    console.info("[Bandit TD Formations] v1.0.0 ready: hold 1–4 to save, tap to restore.");
  });
})();
