(() => {
  "use strict";
  function attachInventory(runtime, engine, notify, outfits) {
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const first = name => runtime.objects[name]?.getFirstInstance();
    const screens = ["物品", "装备", "角色丹药", "当铺", "宝物分解"];
    const visible = instance => instance.isVisible !== false && instance.opacity !== 0 && instance.layer?.isSelfAndParentsVisible !== false;
    let pressed = null, lastStatus = "", epoch = 0;

    function context() {
      const g = runtime.globalVars, save = first("save"), wp = first("wp");
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面" || !wp ||
          !Number.isSafeInteger(save?.getAt(0, 1, 0)) || save.getAt(0, 1, 0) < 10000000 || g["装备穿戴中"]) return null;
      if (["转场云", "世界地图", "提示信息", "对话选择框", "黑幕", "装备筛选背景", "装备筛选背景3", "数字输入背景"].some(name => all(name).some(visible))) return null;
      const pages = all("二级页面背景").filter(visible);
      if (pages.length !== 1 || !screens.includes(pages[0].instVars["功能"])) return null;
      const page = pages[0];
      return { save, wp, page, token: `${save.getAt(0, 1, 0)}:${g["当前地图编号"]}:${save.uid}:${page.uid}:${page.instVars["功能"]}:${epoch}` };
    }

    function items(current) {
      const result = [];
      for (const icon of all("物品图标")) {
        const v = icon.instVars, row = v["物品序号"], type = v["物品编号"];
        if (!visible(icon) || v["功能"] !== current.page.instVars["功能"] || v["库序号"] !== 7 ||
            !Number.isSafeInteger(row) || row <= 0 || row >= current.save.width || !(type > 0) ||
            current.save.getAt(row, 1, 7) !== type ||
            !["装备", "内丹"].includes(current.wp.getAt(type, 5))) continue;
        const box = icon.getBoundingBox();
        const [left, top] = icon.layer.layerToCssPx(box.left, box.top);
        const [right, bottom] = icon.layer.layerToCssPx(box.right, box.bottom);
        if (![left, top, right, bottom].every(Number.isFinite) || left >= right || top >= bottom) continue;
        // Hover can clear the new-item marker without changing the clicked piece.
        const key = JSON.stringify(Array.from({ length: 50 }, (_, field) => field === 24 ? 0 : current.save.getAt(row, field, 7)));
        result.push({ uid: icon.uid, row, type, key, left, top, right, bottom });
      }
      return result;
    }

    function click(payload) {
      const previous = pressed;
      pressed = null;
      if (!payload || !["down", "up"].includes(payload.phase)) return;
      const current = context();
      if (!current || payload.token !== current.token) return;
      if (![payload.x, payload.y].every(Number.isFinite)) return;
      const matches = items(current).filter(item => payload.x >= item.left && payload.x < item.right && payload.y >= item.top && payload.y < item.bottom);
      if (matches.length !== 1) return;
      const piece = matches[0];
      // DOM messages may arrive after a craft or sort. Match what was displayed
      // when the pointer went down, before remembering a release candidate.
      if (payload.phase === "down" && (payload.uid !== piece.uid || payload.key !== piece.key)) return;
      if (payload.phase === "down") { pressed = { ...piece, token: current.token }; return; }
      if (!previous || previous.token !== current.token || previous.uid !== piece.uid || previous.row !== piece.row || previous.key !== piece.key) return;
      if (!outfits.ready()) { notify("Inventory: wait for the outfit change to finish."); return; }
      if (current.save.getAt(piece.row, 22, 7)) { notify("Item locked: unlock it before selling or decomposing it."); return; }
      if (outfits.isProtected(current.save, piece.row)) {
        notify("Outfit lock: change or forget the saved outfits using this item before selling or decomposing it."); return;
      }
      const action = current.wp.getAt(piece.type, 4) === "宝物" ? "分解宝物" : "出售物品";
      runtime.callFunction("关闭tips");
      runtime.callFunction(action, piece.row, true, false);
      const screen = current.page.instVars["功能"];
      if (screen === "角色丹药") runtime.callFunction("刷新角色丹药", 8, screen, "二级页面", 0, 0, 0, "内丹", true);
      else runtime.callFunction("刷新物品", 8, screen, "二级页面", 0, 0, 0);
      engine.FlushPendingInstances();
    }

    engine.AddDOMComponentMessageHandler("cjs-formations", "inventory-click", payload => {
      try { click(payload); }
      catch (error) { pressed = null; console.error("[Bandit TD Formations] Inventory shortcut", error); notify(`Inventory: ${error.message || error}`); }
    });
    function publish(current) {
      const state = { active: !!current, token: current?.token || "", items: current ? items(current) : [] }, text = JSON.stringify(state);
      if (text !== lastStatus) { lastStatus = text; engine.PostComponentMessageToDOM("cjs-formations", "inventory-status", state); }
    }
    return {
      tick() { const current = context(); if (pressed?.token !== current?.token) pressed = null; publish(current); },
      leave() { epoch++; pressed = null; publish(null); },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachInventory });
})();
