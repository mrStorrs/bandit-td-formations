(() => {
  "use strict";
  function attachStudy(runtime, engine, notify) {
    const { researchLimit, researchTargets, drillUnlockLevel, drillEndJobs, drillPaths, drillTargets, nextResearch } = globalThis.BanditFormations;
    const prefix = "cjs-formations:study:v1:", states = new Map(), cooldowns = new Map();
    const first = name => runtime.objects[name]?.getFirstInstance();
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const positive = n => Number.isSafeInteger(n) && n > 0;
    const key = kind => kind === 8 ? "research" : "drill";
    const fields = kind => kind === 8 ? { level: 4, active: 13, start: "科技研究", cost: "科技货币需求" } :
      { level: 5, active: 15, start: "职业操练", cost: "操练货币需求" };
    const validStation = entry => entry && [entry.id, entry.type, entry.owner].every(positive) && [8, 9].includes(entry.kind);
    const validJobs = jobs => jobs === null || (Array.isArray(jobs) && jobs.every(positive) && new Set(jobs).size === jobs.length);
    const valid = entry => validStation(entry) && positive(entry.target) && ["auto", "manual"].includes(entry.mode) &&
      Number.isSafeInteger(entry.level) && entry.level >= 0;
    const sameStation = (a, b) => a && a.id === b.id && a.type === b.type && a.owner === b.owner && a.kind === b.kind;
    let hooked = false, automatic = false, moving = false, next = 0, epoch = 0, lastStatus = "";
    const token = current => `${current.saveId}:${current.save.uid}:${epoch}`;
    const stationToken = (current, station) => `${token(current)}:${station.id}:${station.type}:${station.owner}:${station.x}:${station.y}`;
    const defaults = station => ({ id: station.id, type: station.type, owner: station.owner, kind: station.kind, enabled: true, drillJobs: null });

    function fail(state, error) {
      if (state.error) return;
      state.error = error.message || String(error);
      console.error("[Bandit TD Formations] Research / drilling stopped", error);
      notify(`Research / drilling stopped: ${state.error}`);
    }
    function persist(state) {
      if (!state.ready || state.error) return;
      const data = { version: 2, settings: [...state.settings.values()].filter(Boolean).map(setting =>
        ({ ...setting, drillJobs: setting.drillJobs?.slice() ?? null })),
        stations: [...state.entries.values()].filter(Boolean) };
      state.writes = state.writes.then(() => runtime.storage.setItem(prefix + state.id, data)).catch(error => fail(state, error));
    }
    function load(current) {
      const id = current.saveId;
      if (states.has(id)) return states.get(id);
      const state = { id, ready: false, error: "", settings: new Map(), entries: new Map(), writes: Promise.resolve() };
      states.set(id, state);
      // Include stations on other maps when copying the former global settings.
      const existing = [];
      for (let row = 1; row < current.save.width; row++) {
        const type = current.save.getAt(row, 1, 21), station = { id: row, type,
          owner: current.save.getAt(row, 2, 21), kind: current.ss.getAt(type, 30) };
        if (current.save.getAt(row, 0, 21) === row && validStation(station)) existing.push(station);
      }
      state.loading = Promise.resolve().then(() => runtime.storage.getItem(prefix + id)).then(data => {
        const changed = state.entries.size > 0;
        if (data != null) {
          if (![1, 2].includes(data.version) || !Array.isArray(data.stations) || !data.stations.every(valid) ||
              new Set(data.stations.map(entry => entry.id)).size !== data.stations.length) throw new Error("Saved research / drilling settings could not be read.");
          if (data.version === 1) {
            if (typeof data.enabled?.research !== "boolean" || typeof data.enabled?.drill !== "boolean" || !validJobs(data.drillJobs ?? null)) {
              throw new Error("Saved research / drilling preferences could not be read.");
            }
            for (const station of existing) if (!state.settings.has(station.id)) state.settings.set(station.id,
              { ...defaults(station), enabled: data.enabled[key(station.kind)], drillJobs: station.kind === 9 ? data.drillJobs?.slice() ?? null : null });
          } else {
            if (!Array.isArray(data.settings) || !data.settings.every(setting => validStation(setting) &&
                typeof setting.enabled === "boolean" && validJobs(setting.drillJobs)) ||
                new Set(data.settings.map(setting => setting.id)).size !== data.settings.length) throw new Error("Saved station preferences could not be read.");
            for (const setting of data.settings) if (!state.settings.has(setting.id)) state.settings.set(setting.id, setting);
          }
          for (const entry of data.stations) if (!state.entries.has(entry.id)) state.entries.set(entry.id, entry);
        }
        state.ready = true;
        if (changed || data?.version === 1) persist(state);
      }).catch(error => { state.ready = true; fail(state, error); });
      return state;
    }
    function settingsFor(state, station) {
      if (!state.ready || state.error) return null;
      let setting = state.settings.get(station.id);
      if (!sameStation(setting, station)) {
        setting = defaults(station); state.settings.set(station.id, setting); persist(state);
      }
      return setting;
    }
    function remember(state, station, target, mode, level) {
      const entry = { id: station.id, type: station.type, owner: station.owner, kind: station.kind, target, mode, level };
      if (!valid(entry) || JSON.stringify(state.entries.get(station.id)) === JSON.stringify(entry)) return;
      state.entries.set(station.id, entry); persist(state);
    }
    function forget(state, id) {
      if (state.entries.get(id) === null) return;
      state.entries.set(id, null); persist(state);
    }
    function context() {
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面") return null;
      const save = first("save"), ss = first("ss"), kj = first("kj"), zy = first("zy"), g = runtime.globalVars;
      if (!save || !ss || !kj || !zy || !positive(g["主地图编号起始"])) return null;
      const saveId = save.getAt(0, 1, 0), base = g["主地图编号起始"];
      if (!Number.isSafeInteger(saveId) || saveId < 10000000) return null;
      const stations = [];
      for (const tile of all("地面")) {
        const v = tile.instVars, type = v["设施编号"], kind = ss.getAt(type, 30);
        if (v["用途"] !== "主地图" || ![8, 9].includes(kind)) continue;
        const x = v["X坐标"], y = v["Y坐标"], id = save.getAt(x - base + 150, y - base, 6), owner = save.getAt(id, 2, 21);
        if (!positive(id) || save.getAt(id, 0, 21) !== id || save.getAt(id, 1, 21) !== type || !positive(owner)) continue;
        stations.push({ id, type, kind, owner, x, y, tile, level: save.getAt(owner, 5, 1),
          target: save.getAt(id, 3, 21), usable: !!v["有效解锁"] && !["失效", "满仓"].includes(v["资源类型"]) &&
            save.getAt(owner, 1, 1) === (kind === 8 ? 5 : 6) && save.getAt(owner, 4, 1) <= 0 });
      }
      const blocked = g["游戏暂停"] || runtime.timeScale === 0 || g["分页界面"] || g["拖动模式"] ||
        ["二级页面背景", "转场云", "世界地图", "提示信息", "对话选择框", "角色拖动点", "建造拖动点", "搬迁拖动点", "设施搬迁拖动点"]
          .some(name => all(name).length) || all("黑幕").some(i => i.isVisible);
      return { save, ss, kj, zy, saveId, stations, blocked };
    }
    function selected(station) {
      return all("底部菜单背景").some(menu => menu.instVars["功能"] === "设施" &&
        menu.instVars["X坐标"] === station.x && menu.instVars["Y坐标"] === station.y);
    }
    function selectedStation(current) {
      if (!current || runtime.globalVars["拖动模式"] || runtime.globalVars["分页界面"] ||
          ["二级页面背景", "转场云", "世界地图", "设施搬迁拖动点", "角色拖动点", "建造拖动点", "搬迁拖动点"].some(name => all(name).length) ||
          all("黑幕").some(instance => instance.isVisible)) return null;
      return current.stations.find(selected) || null;
    }
    function installHooks() {
      if (hooked) return;
      const manager = engine.GetEventSheetManager();
      const names = ["科技研究", "职业操练", "取消设施进程", "删除地图设施", "关闭二级页面", "刷新底部菜单", "界面音效"];
      const functions = names.map(name => manager.GetFunctionBlockByName(name));
      const work = manager.GetFunctionBlockByName("采集核心碰撞");
      if ([...functions, work].some(fn => typeof fn?.GetEventBlock()?._RunAndBlock !== "function" || typeof fn?.CaptureFunctionParameters !== "function")) {
        throw new Error("Research / drilling hooks are unavailable in this game build.");
      }
      for (const [index, fn] of functions.entries()) {
        const block = fn.GetEventBlock(), run = block._RunAndBlock;
        block._RunAndBlock = function (...args) {
          // Automatic selection must not close or replace the player's menus.
          if (index >= 4) return automatic ? undefined : run.apply(this, args);
          let current, station, state, params;
          const previousMoving = moving;
          try {
            current = context(); params = fn.CaptureFunctionParameters();
            if (index === 3) moving = !!params[7];
            if (current) {
              state = load(current);
              const g = runtime.globalVars;
              station = current.stations.find(st => st.x === (index < 2 ? g["选中地块X"] : params[0]) &&
                  st.y === (index < 2 ? g["选中地块Y"] : params[1]));
              const entry = station && state.entries.get(station.id);
              if (index < 2 && !automatic && station?.kind === (index === 0 ? 8 : 9) &&
                  sameStation(entry, station) && entry.mode === "auto" && entry.target === station.target &&
                  station.target !== params[0]) {
                const chosen = targets(current, station, "manual").find(t => t.id === params[0]), f = fields(station.kind);
                if (chosen && !occupied(current, station.kind, chosen.id) &&
                    ["取消设施进程function", "获得铜钱function", f.cost + "function"].every(name => manager.GetEventGroupByName(name)?.IsGroupActive())) {
                  const cost = runtime.callFunction(f.cost, chosen.id), refund = runtime.callFunction(f.cost, station.target);
                  if (Number.isFinite(cost) && cost >= 0 && Number.isFinite(refund) && refund >= 0 && current.save.getAt(1, 2, 0) + refund >= cost) {
                    automatic = true;
                    try { runtime.callFunction("取消设施进程", station.x, station.y, false, 0); engine.FlushPendingInstances(); }
                    finally { automatic = false; }
                    if (current.save.getAt(station.id, 3, 21) !== 0) throw new Error("The game refused to replace an automatic order.");
                  }
                }
              }
            }
          } catch (error) { if (state) fail(state, error); }
          try {
            const result = run.apply(this, args);
            if (station && !automatic) {
              try {
                const s = current.save, target = s.getAt(station.id, 3, 21);
                if (index < 2 && station.kind === (index === 0 ? 8 : 9) && target === params[0] && positive(target)) {
                  remember(state, station, target, "manual", s.getAt(target, fields(station.kind).level, 0));
                  cooldowns.delete(`${state.id}:${station.id}`);
                }
                if (index >= 2 && !moving) {
                  if (index === 3) state.settings.set(station.id, null);
                  forget(state, station.id); persist(state);
                  cooldowns.set(`${state.id}:${station.id}`, performance.now() + 2000);
                }
              } catch (error) { fail(state, error); }
            }
            return result;
          } finally {
            moving = previousMoving;
          }
        };
      }
      const block = work.GetEventBlock(), run = block._RunAndBlock;
      block._RunAndBlock = function (...args) {
        let current, station, state, repeat;
        try {
          current = context();
          station = current?.stations.find(st => st.tile.uid === work.CaptureFunctionParameters()[1]);
          if (station) {
            state = load(current);
            const entry = state.entries.get(station.id), setting = settingsFor(state, station);
            if (state.ready && !state.error && sameStation(entry, station) && entry.mode === "auto" &&
                entry.target === station.target) {
              let stop;
              if (station.kind === 8) {
                const target = targets(current, station).find(t => t.id === station.target);
                stop = !target || target.level + 1 >= researchLimit(current.kj, target.id, entry.level, target.maximum);
              } else {
                const limit = drillLimit(current, station.target);
                stop = !drillPaths(current.zy, setting.drillJobs).has(station.target) ||
                  (limit > 0 && current.save.getAt(station.target, 5, 0) + 1 >= limit);
              }
              if (stop) {
                // Native completion pays for the next level immediately. Suppress
                // that repeat at the research stage or drill unlock boundary.
                repeat = current.save.getAt(station.id, 5, 21);
                current.save.setAt(0, station.id, 5, 21);
              }
            }
          }
        } catch (error) { if (state) fail(state, error); }
        try { return run.apply(this, args); }
        finally {
          if (repeat !== undefined && first("save") === current.save && current.save.getAt(0, 1, 0) === current.saveId &&
              current.save.getAt(station.id, 1, 21) === station.type && current.save.getAt(station.id, 2, 21) === station.owner) {
            current.save.setAt(repeat, station.id, 5, 21);
          }
        }
      };
      hooked = true;
    }
    const drillLimit = (current, id) => drillUnlockLevel(current.zy, id, target => runtime.callFunction("转职等级要求", target));
    function targets(current, station, mode = "auto", drillJobs = null) {
      const { save, kj, zy } = current;
      if (station.kind === 8) return researchTargets(kj, save, id => runtime.callFunction("科技等级上限", id, station.level), mode !== "manual");
      const maximum = Math.min(runtime.globalVars["职业等级上限"], runtime.callFunction("操练等级上限", station.level));
      return drillTargets(zy, save, maximum, id => runtime.callFunction("转职等级要求", id),
        family => runtime.callFunction("操练按钮解锁判断", ["", "力量系", "敏捷系", "智力系", "生产系"][family]) === 1, mode !== "manual", drillJobs);
    }
    function occupied(current, kind, target) {
      const s = current.save;
      for (let id = 1; id < s.width; id++) if (s.getAt(id, 0, 21) === id && s.getAt(id, 3, 21) === target &&
          s.getAt(s.getAt(id, 2, 21), 1, 1) === (kind === 8 ? 5 : 6)) return true;
      return false;
    }
    function start(current, state, station, target, mode) {
      const s = current.save, f = fields(station.kind), manager = engine.GetEventSheetManager();
      if ([f.start + "function", f.cost + "function", "生成单体设施function", "相同进程检测function", "获得铜钱function"]
        .some(name => !manager.GetEventGroupByName(name)?.IsGroupActive())) return false;
      const cost = runtime.callFunction(f.cost, target.id), balance = s.getAt(1, 2, 0);
      if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(balance) || balance < cost) return false;
      if (s.getAt(station.id, 3, 21) !== 0 || occupied(current, station.kind, target.id)) return false;
      const g = runtime.globalVars, x = g["选中地块X"], y = g["选中地块Y"];
      automatic = true;
      try {
        g["选中地块X"] = station.x; g["选中地块Y"] = station.y;
        runtime.callFunction(f.start, target.id, station.level);
        engine.FlushPendingInstances();
        if (s.getAt(station.id, 3, 21) !== target.id || s.getAt(target.id, f.active, 0) !== 1 || s.getAt(1, 2, 0) !== balance - cost) {
          throw new Error("The game did not finish a research / drill order. Restart to retry.");
        }
        remember(state, station, target.id, mode, target.level);
      } finally { g["选中地块X"] = x; g["选中地块Y"] = y; automatic = false; }
      if (selected(station)) runtime.callFunction("刷新底部菜单", 8, "底部", "设施", 0, 0, "", true, 0, 0, 0, 0, 0, false, 0);
      return true;
    }
    function publish(current, state, messages = new Map()) {
      const station = selectedStation(current), setting = station && settingsFor(state, station);
      const data = station ? { visible: true,
        station: { id: station.id, kind: station.kind, name: station.kind === 8 ? "Research station" : "Drill station" },
        token: stationToken(current, station), enabled: setting?.enabled ?? false, busy: !state.ready, error: !!state.error,
        drillJobs: station.kind === 9 ? drillEndJobs(current.zy).map(id => ({ id, name: runtime.callFunction("文本", current.zy.getAt(id, 1), 0),
          family: current.zy.getAt(id, 4), selected: !!setting && (setting.drillJobs === null || setting.drillJobs.includes(id)) })) : [],
        message: state.error || (!state.ready ? "Loading station settings…" : messages.get(station.id) || "Waiting for station…") } : { visible: false };
      const text = JSON.stringify(data);
      if (lastStatus !== text) { lastStatus = text; engine.PostComponentMessageToDOM("cjs-formations", "study-status", data); }
    }
    engine.AddDOMComponentMessageHandler("cjs-formations", "study-enabled", payload => {
      const current = context(), station = selectedStation(current);
      if (!station || payload?.token !== stationToken(current, station) || payload.kind !== key(station.kind) || typeof payload.enabled !== "boolean") return;
      const state = load(current);
      const setting = settingsFor(state, station);
      if (!setting) return;
      setting.enabled = payload.enabled;
      if (payload.enabled) cooldowns.delete(`${state.id}:${station.id}`);
      persist(state); next = 0;
    });
    engine.AddDOMComponentMessageHandler("cjs-formations", "study-drill-job", payload => {
      const current = context(), station = selectedStation(current);
      if (station?.kind !== 9 || payload?.token !== stationToken(current, station) || typeof payload.enabled !== "boolean") return;
      const ends = drillEndJobs(current.zy);
      if (!ends.includes(payload.id)) return;
      const state = load(current);
      const setting = settingsFor(state, station);
      if (!setting) return;
      const chosen = new Set(setting.drillJobs ?? ends);
      if (payload.enabled) chosen.add(payload.id); else chosen.delete(payload.id);
      setting.drillJobs = ends.filter(id => chosen.has(id)); persist(state); next = 0;
    });
    return {
      leave() { epoch++; next = 0; cooldowns.clear(); publish(null); },
      tick() {
        if (performance.now() < next) return;
        next = performance.now() + 1000;
        const current = context();
        if (!current) { publish(null); return; }
        const state = load(current), messages = new Map();
        try {
          installHooks();
          if (state.ready && !state.error) for (const station of current.stations) {
            const s = current.save, f = fields(station.kind), label = station.kind === 8 ? "Research" : "Drill";
            const setting = settingsFor(state, station), report = message => messages.set(station.id, message);
            let entry = state.entries.get(station.id);
            if (entry && !sameStation(entry, station)) { forget(state, station.id); entry = null; }
            if (station.target > 0 && (!entry || entry.target !== station.target)) {
              remember(state, station, station.target, "manual", s.getAt(station.target, f.level, 0));
              entry = state.entries.get(station.id);
            }
            const describe = (target, mode) => `${label}: ${mode === "manual" ? "Manual" : "Auto"} · ${runtime.callFunction("文本", (station.kind === 8 ? current.kj : current.zy).getAt(target, 1), 0)}`;
            const limit = station.kind === 9 && station.target > 0 && entry?.mode === "auto" ? drillLimit(current, station.target) : 0;
            const excluded = station.kind === 9 && station.target > 0 && entry?.mode === "auto" &&
              !drillPaths(current.zy, setting.drillJobs).has(station.target);
            if (!current.blocked && (excluded || (limit > 0 && s.getAt(station.target, 5, 0) >= limit))) {
              const manager = engine.GetEventSheetManager();
              if (!["取消设施进程function", "获得铜钱function", "操练货币需求function"]
                .every(name => manager.GetEventGroupByName(name)?.IsGroupActive())) continue;
              automatic = true;
              try { runtime.callFunction("取消设施进程", station.x, station.y, false, 0); engine.FlushPendingInstances(); }
              finally { automatic = false; }
              if (s.getAt(station.id, 3, 21) !== 0) throw new Error("The game refused to stop an automatic drill target.");
              forget(state, station.id); entry = null; station.target = 0;
            }
            if (station.target > 0) { report(describe(station.target, entry?.mode)); continue; }
            if (!setting.enabled) { report(`${label}: Off`); continue; }
            if (!station.usable) { report(`${label}: Waiting for station`); continue; }
            if (current.blocked) { report(`${label}: Waiting for gameplay`); continue; }
            const cooldown = cooldowns.get(`${state.id}:${station.id}`);
            if (cooldown) {
              if (cooldown > performance.now() || selected(station)) { report(`${label}: Waiting for your selection`); continue; }
              cooldowns.delete(`${state.id}:${station.id}`);
            }
            const available = targets(current, station, "auto", setting.drillJobs);
            let target;
            if (entry) target = (entry.mode === "manual" ? targets(current, station, "manual") : available)
              .find(t => t.id === entry.target);
            if (target && station.kind === 8 && entry.mode === "auto" &&
                target.level >= researchLimit(current.kj, target.id, entry.level, target.maximum)) target = undefined;
            if (entry && !target) { forget(state, station.id); entry = null; }
            if (!target) target = station.kind === 8 ? nextResearch(available, id => occupied(current, 8, id)) :
              available.find(t => !occupied(current, 9, t.id));
            if (!target) {
              const jobs = station.kind === 9 ? drillEndJobs(current.zy).filter(id => setting.drillJobs === null || setting.drillJobs.includes(id)) : null;
              report(jobs?.length === 0 ? "Drill: No end jobs selected" :
                jobs?.every(id => s.getAt(id, 5, 0) >= 1) ? "Drill: Selected jobs unlocked" :
                  `${label}: Waiting for unlocks, levels or a building upgrade`);
              continue;
            }
            const mode = entry?.mode || "auto";
            const started = start(current, state, station, target, mode);
            report(describe(target.id, mode) + (started ? "" : " · Waiting for copper or target"));
          }
        } catch (error) { fail(state, error); }
        publish(current, state, messages);
      },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachStudy });
})();
