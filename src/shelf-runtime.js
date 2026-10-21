(() => {
  "use strict";
  function attachShelves(runtime, engine, notify, available = () => true) {
    const { shelfKinds, shelfRange, planShelves } = globalThis.BanditFormations;
    const first = name => runtime.objects[name]?.getFirstInstance();
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const positive = value => Number.isSafeInteger(value) && value > 0;
    let next = 0, epoch = 0, lastStatus = "", busy = false, result = null;
    function context() {
      const g = runtime.globalVars, save = first("save"), ss = first("ss");
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面" || !save || !ss ||
          !positive(g["主地图编号起始"]) || !Number.isSafeInteger(g["当前地图编号"]) ||
          !Number.isSafeInteger(save.getAt(0, 1, 0)) || save.getAt(0, 1, 0) < 10000000 ||
          g["分页界面"] || g["拖动模式"] ||
          ["二级页面背景", "转场云", "世界地图", "提示信息", "对话选择框", "角色拖动点", "建造拖动点", "搬迁拖动点", "设施拖动点", "设施搬迁拖动点", "拆除拖动点"]
            .some(name => all(name).length) || all("黑幕").some(o => o.isVisible)) return null;
      const stations = [], base = g["主地图编号起始"];
      for (const tile of all("地面")) {
        const v = tile.instVars, type = v["设施编号"], kind = ss.getAt(type, 30);
        if (v["用途"] !== "主地图" || v["区域"] !== "山寨" || !v["有效解锁"] ||
            v["资源类型"] === "失效" || !shelfKinds.includes(kind)) continue;
        const x = v["X坐标"], y = v["Y坐标"], id = save.getAt(x - base + 150, y - base, 6), owner = save.getAt(id, 2, 21);
        if (!positive(id) || save.getAt(id, 0, 21) !== id || save.getAt(id, 1, 21) !== type ||
            !positive(owner) || !(save.getAt(owner, 1, 1) > 0)) continue;
        stations.push({ id, type, kind, owner, x, y, uid: tile.uid });
      }
      const menus = all("底部菜单背景").filter(m => m.instVars["功能"] === "设施");
      if (menus.length !== 1) return null;
      const menu = menus[0], selected = stations.find(s => s.x === menu.instVars["X坐标"] && s.y === menu.instVars["Y坐标"]);
      if (!selected) return null;
      const shelves = [];
      for (const core of all("建筑核心")) {
        const v = core.instVars, id = v["建筑序号"], x = v["X坐标"], y = v["Y坐标"];
        if (v["区域"] !== "山寨" || v["建筑编号"] !== 67 || !positive(id) ||
            save.getAt(id, 1, 1) !== 67 || save.getAt(id, 2, 1) !== x || save.getAt(id, 3, 1) !== y ||
            save.getAt(id, 4, 1) > 0 || !shelfRange({ x, y }, selected)) continue;
        const level = save.getAt(id, 5, 1);
        if (!Number.isSafeInteger(level) || level < 0 || shelves.some(s => s.id === id)) continue;
        shelves.push({ id, x, y, level, occupied: save.getAt(id, 9, 1) !== 0 });
      }
      const token = [save.getAt(0, 1, 0), save.uid, g["当前地图编号"], epoch, selected.id, selected.type,
        selected.owner, selected.x, selected.y, selected.uid].join(":");
      return { save, selected, stations, shelves, token };
    }
    function publish(current = context()) {
      const data = current ? { visible: true, token: current.token,
        station: { id: current.selected.id, kind: current.selected.kind },
        empty: current.shelves.filter(s => !s.occupied).length,
        busy: busy || !!runtime.globalVars["装备穿戴中"] || !available(),
        message: result?.token === current.token ? result.text : "" } : { visible: false };
      const key = JSON.stringify(data);
      if (key !== lastStatus) { lastStatus = key; engine.PostComponentMessageToDOM("cjs-formations", "shelf-status", data); }
    }
    const record = (save, row, layer) => Array.from({ length: 50 }, (_, f) => save.getAt(row, f, layer));
    function fill({ token } = {}) {
      const current = context();
      if (!current || token !== current.token || busy || runtime.globalVars["装备穿戴中"] || !available()) return;
      const { save } = current;
      let filled = 0, error;
      busy = true; publish(current);
      try {
        const manager = engine.GetEventSheetManager();
        for (const name of ["灵物库数据存取function", "刷新单体建筑function", "删除地图建筑function", "生成单体建筑function", "刷新地块灵气function", "地块范围判定function"]) {
          if (!manager.GetEventGroupByName(name)?.IsGroupActive()) throw new Error("Shelf placement is unavailable right now.");
        }
        if (typeof engine.FlushPendingInstances !== "function") throw new Error("Shelf refresh is unavailable in this build.");
        const transfer = manager.GetEventVariableBySID(838438864163447);
        if (typeof transfer?.GetValue !== "function" || typeof transfer?.SetValue !== "function") {
          throw new Error("Spirit storage is unavailable in this build.");
        }
        const items = [];
        let free = 0;
        for (let row = 1; row < save.width; row++) {
          if (save.getAt(row, 1, 19) <= 0) free++;
          if (positive(save.getAt(row, 1, 18)) && !save.getAt(row, 12, 18)) {
            items.push({ row, elements: Array.from({ length: 5 }, (_, i) => save.getAt(row, i + 5, 18)), record: record(save, row, 18) });
          }
        }
        const plan = planShelves(current.shelves, current.stations, items, current.selected);
        if (plan.length > free) throw new Error("Not enough placed-spirit slots for these shelves.");
        for (const { shelf, item } of plan) {
          if (context()?.token !== token || save.getAt(shelf.id, 9, 1) !== 0 ||
              record(save, item.row, 18).some((value, i) => value !== item.record[i])) {
            throw new Error("A shelf, station or spirit changed. Click Fill empty shelves again.");
          }
          let destination = 1;
          while (destination < save.width && save.getAt(destination, 1, 19) > 0) destination++;
          if (destination === save.width) throw new Error("No free placed-spirit slots.");
          const previous = record(save, destination, 19), g = runtime.globalVars, temp = transfer.GetValue();
          g["装备穿戴中"] = true;
          try {
            // The native storage transfer is synchronous. Link the two records
            // as native placement does, without closing/replacing the bench UI.
            try {
              runtime.callFunction("灵物库存入", item.row, true, 0);
              if (transfer.GetValue() !== destination || record(save, item.row, 18).some(v => v !== 0) ||
                  record(save, destination, 19).some((value, i) => value !== item.record[i])) throw new Error("Incomplete transfer");
            } catch (_) {
              item.record.forEach((value, i) => save.setAt(value, item.row, i, 18));
              previous.forEach((value, i) => save.setAt(value, destination, i, 19));
              throw new Error("The game refused a spirit transfer; its inventory record was restored.");
            }
            save.setAt(destination, shelf.id, 9, 1); save.setAt(shelf.id, destination, 12, 19);
          } finally { g["装备穿戴中"] = false; transfer.SetValue(temp); }
          filled++;
          runtime.callFunction("刷新单体建筑", shelf.id, false);
          engine.FlushPendingInstances();
        }
      } catch (caught) { error = caught.message || String(caught); console.error("[Bandit TD Formations] Shelf fill stopped", caught); }
      finally {
        if (filled) {
          try { runtime.callFunction("刷新地块灵气"); engine.FlushPendingInstances(); }
          catch (caught) { error ||= caught.message || String(caught); }
        }
        busy = false;
        const empty = current.shelves.filter(s => !s.occupied).length;
        const text = error ? `Filled ${filled}/${empty} shelves. ${error}` : !empty ? "No empty shelves in range." :
          `Filled ${filled}/${empty} empty shelves.${filled < empty ? " No more suitable spirits in inventory." : ""}`;
        result = { token, text }; notify(text); publish();
      }
    }
    engine.AddDOMComponentMessageHandler("cjs-formations", "shelf-fill", fill);
    return { tick() {
      if (performance.now() < next) return;
      next = performance.now() + 250;
      publish();
    }, leave() { epoch++; next = 0; result = null; lastStatus = ""; publish(null); } };
  }
  Object.assign(globalThis.BanditFormations, { attachShelves });
})();
