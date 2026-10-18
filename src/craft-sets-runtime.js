(() => {
  "use strict";
  function attachCraftSets(runtime, engine, notify, bridge) {
    const { craftRoles, craftDefaults, validateCraftOptions, craftTargets, isCraftKeeper, planCraftSets } = globalThis.BanditFormations;
    const prefix = "cjs-formations:craft-sets:v1:", batchSize = 10, states = new Map(), tickets = new Map();
    let hooked = false, activeWork = null, creating = null, epoch = 0, lastStatus = "";
    const token = current => `${current.saveId}:${current.save.uid}:${epoch}`;
    const running = state => state.ready && !state.error && !state.busy && state.enabled && state.options.mode === "sets";
    function fail(state, error) {
      if (state.error) return;
      state.error = error.message || String(error); state.enabled = false;
      console.error("[Bandit TD Formations] Set crafting", error);
      notify(`Set crafting stopped: ${state.error}`);
    }
    function load(current) {
      if (states.has(current.saveId)) return states.get(current.saveId);
      const state = { id: current.saveId, options: validateCraftOptions(craftDefaults), enabled: false,
        ready: false, busy: false, error: "", message: "Loading crafting settings…", kept: 0, sold: 0, revision: 0, writes: Promise.resolve() };
      states.set(current.saveId, state);
      state.loading = Promise.resolve().then(() => runtime.storage.getItem(prefix + state.id)).then(data => {
        if (data != null) {
          if (data.version !== 1 || typeof data.enabled !== "boolean") throw new Error("Saved crafting settings could not be read.");
          state.options = validateCraftOptions(data.options); state.enabled = data.enabled;
        }
      }).catch(error => fail(state, error)).finally(() => { state.ready = true; });
      return state;
    }
    function write(state, data) {
      state.writes = state.writes.catch(() => {}).then(() => runtime.storage.setItem(prefix + state.id, data));
      return state.writes;
    }
    const persist = state => write(state, { version: 1, options: state.options, enabled: state.enabled });
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
      const state = load(current), item = readItem(current, row, 7), s = current.save;
      if (item.recipe !== ticket.recipe || s.getAt(row, 2, 7) !== 1 || s.getAt(row, 7, 7) !== 0) {
        if (!ticket.owned) return;
        throw new Error("A crafted item could not be identified. It was kept.");
      }
      const qualifies = isCraftKeeper(item, current.wp, ticket.options) || isCraftKeeper(item, current.wp, state.options);
      if (qualifies) { s.setAt(1, row, 22, 7); state.kept++; return; }
      if (!ticket.owned || !running(state) || !state.options.autoSell || !sameOptions(state.options, ticket.options) || s.getAt(row, 22, 7) !== 0) return;
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
              const state = load(current), s = current.save;
              if (running(state) && s.getAt(station.queue, 0, 13) === station.queue) {
                ticket = { owned: false, token: token(current), recipe: s.getAt(station.queue, 3, 13), options: state.options };
              }
            }
            activeWork = ticket ? { current, ticket, consumed: false } : null;
            try { return run.apply(this, args); }
            finally { activeWork = previous; }
          }
          const work = activeWork;
          if (!work || work.consumed || params[1] !== work.ticket.recipe || params[6] !== 1 || params[9] !== "特定装备") return run.apply(this, args);
          const { current, ticket } = work, s = current.save, state = load(current);
          let row = 1;
          while (row < s.width && s.getAt(row, 1, 7) > 0) row++;
          if (row >= s.width) return run.apply(this, args);
          work.consumed = true;
          const previous = creating; creating = { row, current, ticket };
          let result;
          try { result = run.apply(this, args); }
          finally { creating = previous; }
          try { finishItem(current, ticket, row); } catch (error) { fail(state, error); }
          return result;
        };
      }
      hooked = true;
    }
    function publish(current, state) {
      const payload = current ? { visible: !runtime.objects["二级页面背景"]?.getAllInstances().length &&
          !runtime.objects["转场云"]?.getAllInstances().length && !runtime.objects["世界地图"]?.getAllInstances().length,
        token: token(current), options: state.options, running: running(state), busy: !state.ready || state.busy,
        message: state.error || state.message, error: !!state.error, kept: state.kept, sold: state.sold, roles: craftRoles } : { visible: false };
      const text = JSON.stringify(payload);
      if (text !== lastStatus) { lastStatus = text; engine.PostComponentMessageToDOM("cjs-formations", "craft-status", payload); }
    }
    async function edit(action, payload) {
      const current = bridge.context();
      if (!current || payload?.token !== token(current)) return;
      const state = load(current);
      if (!state.ready || state.busy) return;
      if (action === "pause") state.enabled = false;
      if (action === "sell" && payload.autoSell === false) state.options = { ...state.options, autoSell: false };
      const revision = ++state.revision;
      state.busy = true;
      publish(current, state);
      try {
        if (action === "configure") {
          const options = validateCraftOptions(payload.options);
          if (options.mode === "sets" && !craftTargets(current.wp, options).length) throw new Error("Check at least one role, or choose a single role to loop.");
          if (options.mode === "sets") installHooks();
          await write(state, { version: 1, options, enabled: options.mode === "sets" });
          if (revision !== state.revision) return;
          state.options = options; state.enabled = options.mode === "sets"; state.error = "";
        } else if (action === "sell") {
          if (typeof payload.autoSell !== "boolean") throw new Error("Invalid auto-sell setting.");
          state.options = { ...state.options, autoSell: payload.autoSell }; await persist(state);
        } else await persist(state);
      } catch (error) { fail(state, error); }
      finally {
        state.busy = false; state.message = state.enabled ? "Waiting for stations…" : "Set crafting paused.";
        const latest = bridge.context(); publish(latest, latest ? load(latest) : null);
      }
    }
    for (const action of ["configure", "pause", "sell"]) engine.AddDOMComponentMessageHandler("cjs-formations", `craft-${action}`, payload => edit(action, payload));
    return {
      owns,
      controls(current) {
        const state = load(current);
        return !state.ready || !!state.error || state.options.mode === "sets";
      },
      cancel(current, station, manual) {
        tickets.delete(station.id);
        const state = load(current);
        if (manual && (state.busy || state.options.mode === "sets" && state.enabled)) {
          state.revision++; state.enabled = false; state.message = "Paused by a manual station change. Apply / Start to resume.";
          Promise.resolve(persist(state)).catch(error => fail(state, error));
        }
      },
      tick(current) {
        if (!current) { publish(null); return true; }
        const state = load(current);
        try {
          if (state.ready && !state.error) {
            if (state.options.mode === "repeat") state.message = "Stations repeat their last recipe ×10.";
            else if (!running(state)) state.message = "Set crafting paused. Existing queues can finish.";
            else {
              installHooks();
              const targets = craftTargets(current.wp, state.options);
              if (!targets.length) throw new Error("Choose at least one crafting role.");
              if (current.blocked || runtime.globalVars["装备穿戴中"]) state.message = "Waiting for gameplay to resume…";
              else {
                const inventory = items(current), plan = planCraftSets(inventory, targets, state.options);
                for (const item of inventory) if (isCraftKeeper(item, current.wp, state.options)) current.save.setAt(1, item.row, 22, item.location);
                for (const [id] of tickets) if (!current.stations.some(st => st.id === id && owns(current, st))) tickets.delete(id);
                state.message = plan.cycles.map(cycle => `${cycle.name}: Round ${cycle.round} · ${cycle.target.name} · ${cycle.complete}/2 pieces`).join("\n") +
                  `\nT${state.options.tier} · Batches of ${batchSize}`;
                const capacity = runtime.callFunction("背包容量上限");
                if (!Number.isFinite(capacity) || capacity < 0) throw new Error("Inventory capacity is unavailable.");
                const bagCount = inventory.filter(item => item.location === 7).length;
                if (bagCount >= capacity) state.message += " · Inventory full";
                else {
                  let queued = false;
                  for (const station of current.stations) {
                    if (![4, 5].includes(station.kind) || !station.usable || current.save.getAt(station.id, 3, 21) !== 0) continue;
                    const cycle = plan.cycles.find(c => c.kind === station.kind), role = cycle.target, counts = plan.counts[cycle.index];
                    const slot = cycle.slots.find(i => counts[i] < cycle.round && ![...tickets.values()].some(t => t.role === role.id && t.slot === i));
                    if (slot === undefined) continue;
                    const recipe = role.recipes[slot];
                    if (!recipe || current.save.getAt(recipe, 19, 0) !== 1) { state.message += " · Waiting for recipe unlock"; continue; }
                    const queue = bridge.enqueue(current, station, { recipe, multiplier: state.options.multiplier }, batchSize);
                    if (queue) {
                      tickets.set(station.id, { owned: true, token: token(current), type: station.type, owner: station.owner, x: station.x, y: station.y,
                        queue, recipe, count: batchSize, role: role.id, slot, options: validateCraftOptions(state.options) });
                      queued = true;
                    }
                  }
                  if (!queued && !tickets.size) state.message += " · Waiting for stations or materials";
                }
              }
            }
          }
        } catch (error) { fail(state, error); }
        publish(current, state);
        return !state.ready || !!state.error || state.options.mode === "sets";
      },
      leave() { epoch++; tickets.clear(); activeWork = creating = null; lastStatus = ""; },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachCraftSets });
})();
