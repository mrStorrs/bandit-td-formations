(() => {
  "use strict";
  function attachCraftSets(runtime, engine, notify, bridge) {
    const { craftRoles, craftDefaults, validateCraftOptions, craftTargets, isCraftKeeper, planCraftSets } = globalThis.BanditFormations;
    const prefix = "cjs-formations:craft-stations:v1:", legacyPrefix = "cjs-formations:craft-sets:v1:";
    const batchSize = 10, campaigns = new Map(), tickets = new Map();
    let hooked = false, activeWork = null, creating = null, epoch = 0, lastStatus = "";
    const token = current => `${current.saveId}:${current.save.uid}:${epoch}`;
    const stationToken = (current, station) => `${token(current)}:${station.id}:${station.type}:${station.owner}:${station.x}:${station.y}`;
    const running = state => state && !state.error && !state.busy && state.enabled && state.options.mode === "sets";
    const identity = (state, station) => state && state.type === station.type && state.owner === station.owner;
    function fail(state, error) {
      if (state.error) return;
      state.error = error.message || String(error); state.enabled = false;
      console.error("[Bandit TD Formations] Station crafting", error);
      notify(`Crafting stopped${state.type ? ` at station #${state.id}` : ""}: ${state.error}`);
    }
    function entry(station, options = craftDefaults, enabled = true) {
      return { id: station.id, type: station.type, owner: station.owner, options: validateCraftOptions(options), enabled,
        busy: false, error: "", message: "Waiting for station…", kept: 0, sold: 0 };
    }
    function persist(campaign) {
      const data = { version: 1, stations: [...campaign.stations.values()].map(({ id, type, owner, options, enabled }) =>
        ({ id, type, owner, options, enabled })) };
      campaign.writes = campaign.writes.catch(() => {}).then(() => runtime.storage.setItem(prefix + campaign.id, data));
      return campaign.writes;
    }
    function load(current) {
      if (campaigns.has(current.saveId)) return campaigns.get(current.saveId);
      const campaign = { id: current.saveId, stations: new Map(), pending: new Map(), ready: false, error: "", writes: Promise.resolve() };
      campaigns.set(current.saveId, campaign);
      campaign.loading = Promise.resolve().then(async () => {
        const data = await runtime.storage.getItem(prefix + campaign.id);
        if (data != null) {
          if (data.version !== 1 || !Array.isArray(data.stations)) throw new Error("Saved station settings could not be read.");
          for (const record of data.stations) {
            if (!record || ![record.id, record.type, record.owner].every(n => Number.isSafeInteger(n) && n > 0) ||
                typeof record.enabled !== "boolean" || campaign.stations.has(record.id)) throw new Error("Invalid saved station settings.");
            campaign.stations.set(record.id, entry(record, validateCraftOptions(record.options), record.enabled));
          }
        } else {
          const legacy = await runtime.storage.getItem(legacyPrefix + campaign.id);
          if (legacy != null && (legacy.version !== 1 || typeof legacy.enabled !== "boolean")) throw new Error("Saved crafting settings could not be read.");
          const options = validateCraftOptions(legacy?.options || craftDefaults);
          const latest = bridge.context();
          for (const station of (latest?.saveId === campaign.id ? latest : current).stations) {
            const gear = station.kind !== 6;
            campaign.stations.set(station.id, entry(station, gear ? options : craftDefaults,
              !gear || options.mode === "repeat" || !!legacy?.enabled));
          }
          await persist(campaign);
        }
      }).catch(error => fail(campaign, error)).finally(() => {
        // A native change made while storage is loading wins over the saved choice.
        for (const [id, change] of campaign.pending) {
          const state = campaign.stations.get(id);
          if (change.removed) campaign.stations.delete(id);
          else if (identity(state, change.station) && state.options.mode === "sets") state.enabled = false;
        }
        campaign.ready = true;
        if (campaign.pending.size && !campaign.error) persist(campaign).catch(error => fail(campaign, error));
        campaign.pending.clear();
      });
      return campaign;
    }
    function stateFor(current, station) {
      const campaign = load(current);
      if (!campaign.ready || campaign.error) return null;
      let state = campaign.stations.get(station.id);
      if (!identity(state, station)) {
        state = entry(station); campaign.stations.set(station.id, state);
        tickets.delete(station.id);
        persist(campaign).catch(error => fail(campaign, error));
      }
      return state;
    }
    function readItem(current, row, location) {
      const { save, wp } = current, recipe = save.getAt(row, 1, location);
      return { row, location, recipe, slot: wp.getAt(recipe, 6), tier: save.getAt(row, 3, location),
        quality: save.getAt(row, 5, location), bonuses: Array.from({ length: 6 }, (_, i) => save.getAt(row, 9 + i, location)) };
    }
    function items(current) {
      const result = [];
      for (const location of [7, 9]) for (let row = 1; row < current.save.width; row++) {
        if (current.save.getAt(row, 1, location) > 0 && (location === 7 || current.save.getAt(row, 7, location) > 0)) result.push(readItem(current, row, location));
      }
      return result;
    }
    const sameOptions = (a, b) => JSON.stringify({ ...a, autoSell: false }) === JSON.stringify({ ...b, autoSell: false });
    function owns(current, station) {
      const ticket = tickets.get(station.id), s = current.save, remaining = ticket && s.getAt(ticket.queue, 8, 13);
      return ticket && ticket.token === token(current) && ticket.type === station.type && ticket.owner === station.owner &&
        ticket.x === station.x && ticket.y === station.y && ticket.queue === s.getAt(station.id, 3, 21) &&
        s.getAt(ticket.queue, 0, 13) === ticket.queue && s.getAt(ticket.queue, 3, 13) === ticket.recipe &&
        s.getAt(ticket.queue, 5, 13) === ticket.options.tier && s.getAt(ticket.queue, 6, 13) === ticket.options.multiplier &&
        Number.isInteger(remaining) && remaining >= 0 && remaining <= ticket.count ? ticket : null;
    }
    function nativeGroups(names) {
      const manager = engine.GetEventSheetManager();
      return names.every(name => manager.GetEventGroupByName(name)?.IsGroupActive());
    }
    function finishItem(current, ticket, row) {
      const latest = bridge.context();
      if (!latest || ticket.token !== token(latest)) return;
      const station = latest.stations.find(st => st.id === ticket.id && identity(ticket, st));
      if (!station) return;
      const state = stateFor(latest, station), item = readItem(current, row, 7), s = current.save;
      if (item.recipe !== ticket.recipe || s.getAt(row, 2, 7) !== 1 || s.getAt(row, 7, 7) !== 0) {
        if (!ticket.owned) return;
        throw new Error("A crafted item could not be identified. It was kept.");
      }
      const qualifies = isCraftKeeper(item, current.wp, ticket.options) || (state && isCraftKeeper(item, current.wp, state.options));
      if (qualifies) { s.setAt(1, row, 22, 7); if (state) state.kept++; return; }
      if (!ticket.owned || load(current).error || !running(state) || !state.options.autoSell || !sameOptions(state.options, ticket.options) || s.getAt(row, 22, 7) !== 0) return;
      // Only the immediately-created, previously-empty row reaches this path.
      // Never sweep the inventory or retry a sale after a partial native failure.
      const manager = engine.GetEventSheetManager();
      if (!nativeGroups(["出售装备function", "失去物品function", "获得铜钱function", "装备价格function"]) ||
          ["出售物品", "失去物品", "获得铜钱", "装备价格"].some(name => manager.GetFunctionBlockByName(name)?.IsEnabled?.() === false)) {
        throw new Error("The game's equipment sale functions are unavailable. The craft was kept.");
      }
      runtime.callFunction("出售物品", row, false, true);
      if (s.getAt(row, 1, 7) !== 0) throw new Error("The game did not finish an equipment sale. Restart to retry.");
      state.sold++;
    }
    function installHooks() {
      if (hooked) return;
      const manager = engine.GetEventSheetManager();
      const names = ["采集核心碰撞", "获得物品", "出售物品"];
      const fns = names.map(name => manager.GetFunctionBlockByName(name));
      if (fns.some(fn => typeof fn?.CaptureFunctionParameters !== "function" || typeof fn?.GetEventBlock()?._RunAndBlock !== "function")) {
        throw new Error("The game's crafting completion hooks are unavailable.");
      }
      for (const [index, fn] of fns.entries()) {
        const block = fn.GetEventBlock(), run = block._RunAndBlock;
        block._RunAndBlock = function (...args) {
          const params = fn.CaptureFunctionParameters();
          if (index === 2) {
            // Native quality-based selling runs inside item creation. Defer just
            // this new Auto-all item until all its rolls have been inspected.
            if (creating && params[0] === creating.row && params[2]) {
              const { current, ticket, row } = creating;
              if (ticket.owned || isCraftKeeper(readItem(current, row, 7), current.wp, ticket.options)) return;
            }
            return run.apply(this, args);
          }
          if (index === 0) {
            const previous = activeWork, current = bridge.context();
            const tile = runtime.objects["地面"]?.getAllInstances().find(t => t.uid === params[1]);
            const station = tile && current?.stations.find(st => st.x === tile.instVars["X坐标"] && st.y === tile.instVars["Y坐标"]);
            let ticket = station && owns(current, station);
            // Queues already present at load are never claimed for selling.
            // Protect qualifying results from them while Auto-all is active.
            if (!ticket && station && [4, 5].includes(station.kind) && station.queue > 0) {
              const state = stateFor(current, station), s = current.save;
              if (!load(current).error && running(state) && s.getAt(station.queue, 0, 13) === station.queue) {
                ticket = { owned: false, id: station.id, type: station.type, owner: station.owner, token: token(current), recipe: s.getAt(station.queue, 3, 13), options: state.options };
              }
            }
            activeWork = ticket ? { current, ticket, consumed: false } : null;
            try { return run.apply(this, args); }
            finally { activeWork = previous; }
          }
          const work = activeWork;
          if (!work || work.consumed || params[1] !== work.ticket.recipe || params[6] !== 1 || params[9] !== "特定装备") return run.apply(this, args);
          const { current, ticket } = work, s = current.save;
          let row = 1;
          while (row < s.width && s.getAt(row, 1, 7) > 0) row++;
          if (row >= s.width) return run.apply(this, args);
          work.consumed = true;
          const previous = creating; creating = { row, current, ticket };
          let result;
          try { result = run.apply(this, args); }
          finally { creating = previous; }
          try { finishItem(current, ticket, row); } catch (error) { fail(load(current).stations.get(ticket.id) || load(current), error); }
          return result;
        };
      }
      hooked = true;
    }
    function selected(current) {
      if (!current || runtime.objects["二级页面背景"]?.getAllInstances().length ||
          runtime.objects["转场云"]?.getAllInstances().length || runtime.objects["世界地图"]?.getAllInstances().length ||
          runtime.globalVars["拖动模式"] || runtime.objects["设施搬迁拖动点"]?.getAllInstances().length) return null;
      const menus = runtime.objects["底部菜单背景"]?.getAllInstances() || [];
      return current.stations.find(st => menus.some(menu => menu.instVars["功能"] === "设施" &&
        menu.instVars["X坐标"] === st.x && menu.instVars["Y坐标"] === st.y)) || null;
    }
    function publish(current) {
      const station = selected(current), campaign = current && load(current), state = station && stateFor(current, station);
      const payload = station ? { visible: true, station: { id: station.id, kind: station.kind, x: station.x, y: station.y,
          name: ({ 4: "Forge", 5: "Crafting station", 6: "Brewery" })[station.kind] },
        token: stationToken(current, station), options: state?.options || craftDefaults,
        running: !campaign.error && !!running(state), enabled: !campaign.error && !!state?.enabled,
        busy: !campaign.ready || !!state?.busy,
        message: campaign.error || state?.error || state?.message || "Loading station settings…",
        error: !!(campaign.error || state?.error), kept: state?.kept || 0, sold: state?.sold || 0, roles: craftRoles } : { visible: false };
      const text = JSON.stringify(payload);
      if (text !== lastStatus) { lastStatus = text; engine.PostComponentMessageToDOM("cjs-formations", "craft-status", payload); }
    }
    async function edit(action, payload) {
      const current = bridge.context(), station = selected(current);
      if (!station || payload?.token !== stationToken(current, station)) return;
      const campaign = load(current), state = stateFor(current, station);
      if (!state || state.busy) return;
      state.busy = true;
      try {
        if (action === "configure") {
          const options = validateCraftOptions(payload.options);
          if (options.mode === "sets" && station.kind === 6) throw new Error("Breweries support Repeat current ×10 only.");
          if (options.mode === "sets" && !craftTargets(current.wp, options).length) throw new Error("Check at least one role, or choose a single role to loop.");
          if (options.mode === "sets") installHooks();
          state.options = options; state.enabled = true; state.error = "";
        } else if (action === "sell") {
          if (typeof payload.autoSell !== "boolean") throw new Error("Invalid auto-sell setting.");
          state.options = { ...state.options, autoSell: payload.autoSell };
        } else state.enabled = false;
        publish(current);
        await persist(campaign);
      } catch (error) { fail(state, error); }
      finally {
        state.busy = false; state.message = state.enabled ? "Waiting for station…" : "Paused. Existing queue can finish.";
        publish(bridge.context());
      }
    }
    for (const action of ["configure", "pause", "sell"]) engine.AddDOMComponentMessageHandler("cjs-formations", `craft-${action}`, payload => edit(action, payload));
    function schedule(current, station, state, inventory) {
      if (state.options.mode === "repeat") {
        state.message = state.enabled ? "Repeating this station’s last recipe ×10." : "Paused. Existing queue can finish.";
        return;
      }
      if (!running(state)) { state.message = "Auto-all paused. Existing queue can finish."; return; }
      if (station.kind === 6) throw new Error("Auto-all requires an equipment station.");
      installHooks();
      const targets = craftTargets(current.wp, state.options);
      if (!targets.length) throw new Error("Choose at least one crafting role.");
      if (current.blocked || runtime.globalVars["装备穿戴中"]) { state.message = "Waiting for gameplay to resume…"; return; }
      const plan = planCraftSets(inventory, targets, state.options), cycle = plan.cycles.find(c => c.kind === station.kind);
      for (const item of inventory) if (isCraftKeeper(item, current.wp, state.options)) current.save.setAt(1, item.row, 22, item.location);
      state.message = `${cycle.name}: Round ${cycle.round} · ${cycle.target.name} · ${cycle.complete}/2 pieces` +
        `\nT${state.options.tier} · Batches of ${batchSize}`;
      if (!station.usable || current.save.getAt(station.id, 3, 21) !== 0) return;
      const capacity = runtime.callFunction("背包容量上限");
      if (!Number.isFinite(capacity) || capacity < 0) throw new Error("Inventory capacity is unavailable.");
      if (inventory.filter(item => item.location === 7).length >= capacity) { state.message += " · Inventory full"; return; }
      const role = cycle.target, counts = plan.counts[cycle.index];
      const slot = cycle.slots.find(i => counts[i] < cycle.round && ![...tickets.values()].some(t =>
        t.role === role.id && t.slot === i && t.options.tier === state.options.tier && t.options.minimum === state.options.minimum));
      if (slot === undefined) { state.message += " · Matching pieces queued at another station"; return; }
      const recipe = role.recipes[slot];
      if (!recipe || current.save.getAt(recipe, 19, 0) !== 1) { state.message += " · Waiting for recipe unlock"; return; }
      const queue = bridge.enqueue(current, station, { recipe, multiplier: state.options.multiplier }, batchSize);
      if (queue) tickets.set(station.id, { owned: true, id: station.id, token: token(current), type: station.type, owner: station.owner,
        x: station.x, y: station.y, queue, recipe, count: batchSize, role: role.id, slot, options: validateCraftOptions(state.options) });
      else state.message += " · Waiting for materials or station";
    }
    return {
      owns,
      controls(current, station) {
        const state = stateFor(current, station);
        return !state || !!state.error || state.busy || !state.enabled || state.options.mode === "sets";
      },
      cancel(current, station, manual, removed = false) {
        tickets.delete(station.id);
        const campaign = load(current), state = stateFor(current, station);
        if (!campaign.ready && (manual || removed)) {
          campaign.pending.set(station.id, { station, removed });
          return;
        }
        if (removed) {
          campaign.stations.delete(station.id);
          if (campaign.ready) persist(campaign).catch(error => fail(campaign, error));
        } else if (manual && state && (state.busy || state.options.mode === "sets" && state.enabled)) {
          state.enabled = false; state.message = "Paused by a manual station change. Apply / Start to resume.";
          persist(campaign).catch(error => fail(state, error));
        }
      },
      tick(current) {
        if (!current) { publish(null); return; }
        const campaign = load(current);
        if (campaign.ready && !campaign.error) {
          for (const [id] of tickets) if (!current.stations.some(st => st.id === id && owns(current, st))) tickets.delete(id);
          let inventory;
          for (const station of current.stations) {
            const state = stateFor(current, station);
            if (!state || state.error || state.busy) continue;
            try {
              if (running(state)) inventory ||= items(current);
              schedule(current, station, state, inventory);
            } catch (error) { fail(state, error); }
          }
        }
        publish(current);
      },
      leave() { epoch++; tickets.clear(); activeWork = creating = null; lastStatus = ""; },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachCraftSets });
})();
