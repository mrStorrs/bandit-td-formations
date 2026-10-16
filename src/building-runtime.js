(() => {
  "use strict";
  function attachBuildingFormations(runtime, engine, notify) {
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const first = name => runtime.objects[name]?.getFirstInstance();
    function context() {
      const g = runtime.globalVars;
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面" || g["分页界面"] ||
          g["爬塔挑战开关"] || g["拖动模式"] ||
          ["二级页面背景", "世界地图", "转场云", "提示信息", "对话选择框", "角色拖动点", "建造拖动点", "搬迁拖动点", "设施拖动点", "设施搬迁拖动点", "拆除拖动点"].some(n => all(n).length) ||
          all("黑幕").some(o => o.isVisible) || all("角色核心").some(c => c.behaviors.DragDrop?.isDragging)) return null;
      const save = first("save"), jz = first("jz"), mc = first("mc"), ground = all("地面");
      if (!save || !jz || !mc || !ground.length) return null;
      const saveId = save.getAt(0, 1, 0), mapId = g["当前地图编号"];
      if (!Number.isSafeInteger(saveId) || saveId < 10000000 || !Number.isSafeInteger(mapId)) return null;
      const characters = new Set(all("角色核心").map(c => `${c.instVars["X坐标"]},${c.instVars["Y坐标"]}`));
      const tiles = ground.map(t => {
        const v = t.instVars;
        return { x: v["X坐标"], y: v["Y坐标"], allowed: !!v["建设许可"] && v["区域"] === "山寨",
          building: v["建筑序号"], occupied: !!v["占用开关"], facility: v["设施编号"] > 0,
          character: characters.has(`${v["X坐标"]},${v["Y坐标"]}`) };
      });
      const buildings = all("地图建筑").filter(b => b.instVars["用途"] === "主地图" && b.instVars["建筑序号"] > 0).map(b => {
        const v = b.instVars, id = v["建筑序号"], type = save.getAt(id, 1, 1);
        return { id, type, x: save.getAt(id, 2, 1), y: save.getAt(id, 3, 1), size: jz.getAt(type, 8),
          occupant: save.getAt(id, 7, 1), movable: !!v["有效解锁"] && save.getAt(id, 4, 1) <= 0 &&
            type === v["建筑编号"] && mc.getAt(jz.getAt(type, 25), 2) === "搬迁" };
      });
      return { saveId, mapId, token: `${saveId}:${mapId}:${ground[0].uid}`, save, tiles, buildings };
    }
    function apply(plan, current) {
      if (!plan.steps.length) return;
      const manager = engine.GetEventSheetManager();
      if (typeof engine.FlushPendingInstances !== "function") throw new Error("Building relocation is unavailable in this game build. No buildings moved.");
      for (const name of ["建筑搬迁function", "生成单体建筑function"]) {
        if (!manager.GetEventGroupByName(name)?.IsGroupActive()) throw new Error("Building relocation is unavailable right now. No buildings moved.");
      }
      for (const step of plan.steps) {
        const save = current.save;
        if (save.getAt(step.id, 1, 1) !== step.type || save.getAt(step.id, 2, 1) !== step.from.x ||
            save.getAt(step.id, 3, 1) !== step.from.y || save.getAt(step.id, 7, 1) > 0) {
          throw new Error("A building changed during restore. Relocation was interrupted.");
        }
        runtime.callFunction("建筑搬迁", step.id, step.from.x, step.from.y, step.x, step.y, 3, 0);
        // Native event selections cannot see a newly created building until
        // this queue is flushed. A buffered swap relocates that building twice.
        engine.FlushPendingInstances();
        const placed = all("地图建筑").filter(b => b.instVars["用途"] === "主地图" && b.instVars["建筑序号"] === step.id);
        if (save.getAt(step.id, 2, 1) !== step.x || save.getAt(step.id, 3, 1) !== step.y ||
            placed.length !== 1 || placed[0].instVars["X坐标"] !== step.x || placed[0].instVars["Y坐标"] !== step.y) {
          throw new Error("The game refused a building move. Relocation was interrupted.");
        }
      }
      runtime.callFunction("关闭底部菜单", true);
    }
    return new globalThis.BanditFormations.Hotkeys({ context, storage: runtime.storage, apply, notify,
      formation: globalThis.BanditFormations.buildingFormation });
  }
  Object.assign(globalThis.BanditFormations, { attachBuildingFormations });
})();
