(() => {
  "use strict";
  const prefix = "cjs-formations:crafting:v1:";
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const valid = entry => entry && [entry.id, entry.type, entry.owner, entry.recipe].every(positive) &&
    [1, 10, 100].includes(entry.multiplier);

  function attachCrafting(runtime, engine, notify) {
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const first = name => runtime.objects[name]?.getFirstInstance();
    const campaigns = new Map();
    let next = 0, hooked = false, failed = false, automatic = false, moving = false, variables;
    const fail = error => {
      if (failed) return;
      failed = true;
      console.error("[Bandit TD Formations] Auto crafting stopped", error);
      notify("Auto crafting stopped: " + error.message);
    };
    function persist(state) {
      if (!state.ready) return;
      const data = { version: 1, stations: [...state.entries.values()].filter(Boolean) };
      state.writes = state.writes.then(() => runtime.storage.setItem(prefix + state.id, data)).catch(fail);
    }
    function campaign(id) {
      if (campaigns.has(id)) return campaigns.get(id);
      const state = { id, ready: false, entries: new Map(), writes: Promise.resolve() };
      campaigns.set(id, state);
      state.load = Promise.resolve().then(() => runtime.storage.getItem(prefix + id)).then(data => {
        // Choices/cancellations made during the read take precedence over disk.
        const changed = state.entries.size > 0;
        if (data?.version === 1 && Array.isArray(data.stations)) {
          for (const entry of data.stations) if (valid(entry) && !state.entries.has(entry.id)) state.entries.set(entry.id, entry);
        }
        state.ready = true;
        if (changed) persist(state);
      }).catch(fail);
      return state;
    }
    function remember(current, station, recipe, multiplier) {
      const entry = { id: station.id, type: station.type, owner: station.owner, recipe, multiplier };
      if (!valid(entry)) return;
      const state = campaign(current.saveId);
      if (JSON.stringify(state.entries.get(entry.id)) === JSON.stringify(entry)) return;
      state.entries.set(entry.id, entry);
      persist(state);
    }
    function forget(current, id) {
      const state = campaign(current.saveId);
      if (state.entries.get(id) === null) return;
      state.entries.set(id, null);
      persist(state);
    }
    function context() {
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面") return null;
      const save = first("save"), ss = first("ss"), wp = first("wp"), g = runtime.globalVars;
      if (!save || !ss || !wp || !positive(g["主地图编号起始"])) return null;
      const saveId = save.getAt(0, 1, 0), base = g["主地图编号起始"];
      if (!Number.isSafeInteger(saveId) || saveId < 10000000) return null;
      const stations = [];
      for (const tile of all("地面")) {
        const v = tile.instVars, type = v["设施编号"], kind = ss.getAt(type, 30);
        if (v["用途"] !== "主地图" || ![4, 5, 6].includes(kind)) continue;
        const x = v["X坐标"], y = v["Y坐标"], id = save.getAt(x - base + 150, y - base, 6);
        const owner = save.getAt(id, 2, 21);
        if (!positive(id) || save.getAt(id, 0, 21) !== id || save.getAt(id, 1, 21) !== type || !positive(owner)) continue;
        stations.push({ id, type, kind, owner, x, y, queue: save.getAt(id, 3, 21),
          usable: !!v["有效解锁"] && !["失效", "满仓"].includes(v["资源类型"]) &&
            save.getAt(owner, 1, 1) > 0 && save.getAt(owner, 4, 1) <= 0 });
      }
      // Soul Tower locks character movement; native station work remains allowed.
      const blocked = g["游戏暂停"] || runtime.timeScale === 0 || g["分页界面"] || g["拖动模式"] ||
        ["二级页面背景", "转场云", "世界地图", "提示信息", "对话选择框", "角色拖动点", "建造拖动点", "搬迁拖动点", "设施搬迁拖动点"]
          .some(name => all(name).length) || all("黑幕").some(instance => instance.isVisible);
      return { save, wp, saveId, stations, blocked };
    }
    function observe(current, station, queue = station.queue) {
      const s = current.save;
      if (!positive(queue) || s.getAt(queue, 0, 13) !== queue) return;
      remember(current, station, s.getAt(queue, 3, 13), s.getAt(queue, 6, 13));
    }
    function installHooks() {
      const manager = engine.GetEventSheetManager();
      variables = [941173744256037, 351958427913412, 169707249134927].map(sid => manager.GetEventVariableBySID(sid));
      const names = ["加入锻造队列", "取消锻造", "取消设施进程", "删除地图设施"];
      const functions = names.map(name => manager.GetFunctionBlockByName(name));
      if (variables.some(v => typeof v?.GetValue !== "function" || typeof v?.SetValue !== "function") ||
          functions.some(f => typeof f?.GetEventBlock()?._RunAndBlock !== "function" || typeof f?.CaptureFunctionParameters !== "function")) {
        throw new Error("Crafting hooks are unavailable in this game build.");
      }
      functions.forEach((fn, index) => {
        const block = fn.GetEventBlock(), run = block._RunAndBlock;
        block._RunAndBlock = function (...args) {
          let current, station, params, previousMoving = moving;
          if (!automatic && !failed) {
            try {
              current = context(); params = fn.CaptureFunctionParameters();
              if (current) {
                const g = runtime.globalVars, s = current.save;
                const x = index === 0 ? g["选中地块X"] : index === 1 ? s.getAt(params[0], 1, 13) : params[0];
                const y = index === 0 ? g["选中地块Y"] : index === 1 ? s.getAt(params[0], 2, 13) : params[1];
                station = current.stations.find(st => st.x === x && st.y === y);
                if (index === 3) moving = !!params[7];
                if (station && index === 1 && (!params[1] || moving) && !sets.owns(current, station) &&
                    !sets.controls(current, station)) observe(current, station, params[0]);
              }
            } catch (error) { fail(error); }
          }
          try {
            const result = run.apply(this, args);
            if (station && !failed) {
              try {
                if (index === 0) {
                  observe(current, station, variables[2].GetValue());
                  if (station.kind !== 6) sets.cancel(current, station, true);
                }
                if (index !== 0) sets.cancel(current, station, !moving &&
                  (index === 1 ? !!params[1] : index === 2 || index === 3),
                  index === 3 && !moving && current.save.getAt(station.id, 0, 21) === 0);
                if (index === 1 && params[1] && !moving && current.save.getAt(params[0], 0, 13) === 0) forget(current, station.id);
                if (index === 2 && !moving && current.save.getAt(station.id, 3, 21) === 0) forget(current, station.id);
                if (index === 3 && !moving && current.save.getAt(station.id, 0, 21) === 0) forget(current, station.id);
              } catch (error) { fail(error); }
            }
            return result;
          } finally { moving = previousMoving; }
        };
      });
      hooked = true;
    }
    function repeat(current, station, entry, count = 10) {
      const { save, wp } = current, recipe = entry.recipe, tier = wp.getAt(recipe, 3);
      if (save.getAt(station.id, 3, 21) !== 0) return;
      const equipment = wp.getAt(recipe, 5) === "装备" && wp.getAt(recipe, 4) === "普通";
      const category = wp.getAt(recipe, 6);
      const matches = station.kind === 4 ? equipment && [1, 2].includes(category) :
        station.kind === 5 ? equipment && [3, 4].includes(category) :
          wp.getAt(recipe, 5) === "丹药" && wp.getAt(recipe, 4) === "普通丹药";
      if (!matches || !positive(tier) || tier > 9 || save.getAt(recipe, 19, 0) !== 1) return;
      const manager = engine.GetEventSheetManager();
      if (["加入锻造队列function", "生成单体设施function", "锻造材料编号function", "锻造材料数量function"]
        .some(name => !manager.GetEventGroupByName(name)?.IsGroupActive())) return;
      const costs = new Map();
      for (let i = 1; i <= 2; i++) {
        const material = runtime.callFunction("锻造材料编号", recipe, i);
        const amount = runtime.callFunction("锻造材料数量", recipe, tier, i, entry.multiplier, 0) * count;
        if (!positive(material) || !Number.isFinite(amount) || amount <= 0) return;
        costs.set(material, (costs.get(material) || 0) + amount);
      }
      const balances = new Map([...costs.keys()].map(id => [id, save.getAt(id, 6, 0)]));
      if ([...costs].some(([id, amount]) => !Number.isFinite(balances.get(id)) || balances.get(id) < amount)) return;
      let free = 0;
      for (let id = 1; id < save.width; id++) if (save.getAt(id, 0, 13) === 0) { free = id; break; }
      if (!free) return;
      const g = runtime.globalVars, names = ["选中地块X", "选中地块Y", "锻造物品编号"];
      const previous = names.map(name => g[name]), values = variables.map(v => v.GetValue());
      let committed = false;
      automatic = true;
      try {
        [station.x, station.y, recipe].forEach((value, i) => { g[names[i]] = value; });
        variables[0].SetValue(count); variables[1].SetValue(entry.multiplier);
        runtime.callFunction("加入锻造队列", false);
        if (variables[2].GetValue() !== free || save.getAt(free, 0, 13) !== free ||
            save.getAt(free, 1, 13) !== station.x || save.getAt(free, 2, 13) !== station.y ||
            save.getAt(free, 3, 13) !== recipe || save.getAt(free, 5, 13) !== tier ||
            save.getAt(free, 6, 13) !== entry.multiplier || save.getAt(free, 8, 13) !== count ||
            !Number.isFinite(save.getAt(free, 10, 13)) || save.getAt(free, 10, 13) <= 0) {
          throw new Error("The game refused a crafting queue. Restart the game to retry.");
        }
        for (const [id, amount] of costs) runtime.callFunction("失去材料", amount, id, false);
        if ([...costs].some(([id, amount]) => save.getAt(id, 6, 0) !== balances.get(id) - amount)) {
          throw new Error("The game refused the crafting material cost. Restart the game to retry.");
        }
        save.setAt(free, station.id, 3, 21);
        committed = true;
        runtime.callFunction("生成单体设施", station.type, station.owner, 3, "主地图", station.x, station.y, false, false, true, 0);
        engine.FlushPendingInstances();
        if (all("底部菜单背景").some(menu => menu.instVars["功能"] === "设施" &&
            menu.instVars["X坐标"] === station.x && menu.instVars["Y坐标"] === station.y)) {
          runtime.callFunction("刷新底部菜单", 8, "底部", "设施", 0, 0, "", true, 0, 0, 0, 0, 0, false, 0);
        }
        return free;
      } catch (error) {
        if (!committed) {
          // Only this synchronous attempt can own the previously free queue.
          for (let field = 0; field <= 11; field++) save.setAt(0, free, field, 13);
          for (const [id, balance] of balances) save.setAt(balance, id, 6, 0);
        }
        throw error;
      } finally {
        previous.forEach((value, i) => { g[names[i]] = value; });
        values.forEach((value, i) => variables[i].SetValue(value));
        automatic = false;
      }
    }
    const sets = globalThis.BanditFormations.attachCraftSets(runtime, engine, notify, { context, enqueue: repeat });
    return {
      leave() { sets.leave(); },
      tick() {
        if (failed || performance.now() < next) return;
        next = performance.now() + 1000;
        try {
          const current = context();
          if (!current) { sets.tick(null); return; }
          if (!hooked) installHooks();
          const state = campaign(current.saveId);
          sets.tick(current);
          for (const station of current.stations) {
            if (current.save.getAt(station.id, 3, 21) > 0) {
              if (!sets.owns(current, station) && !sets.controls(current, station)) observe(current, station);
              continue;
            }
            if (sets.controls(current, station)) continue;
            const entry = state.entries.get(station.id);
            if (!state.ready || current.blocked || station.queue !== 0 || !station.usable || !valid(entry)) continue;
            if (entry.type !== station.type || entry.owner !== station.owner) { forget(current, station.id); continue; }
            repeat(current, station, entry);
          }
        } catch (error) { fail(error); }
      },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachCrafting });
})();
