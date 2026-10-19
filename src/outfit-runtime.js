(() => {
  "use strict";
  function attachOutfits(runtime, engine, notify) {
    const { outfitJobs, outfitFingerprint, validateOutfit, planOutfit } = globalThis.BanditFormations;
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const first = name => runtime.objects[name]?.getFirstInstance();
    const clean = text => String(text).replace(/\[[^\]]*\]/g, "");
    const pending = new Map();
    let state = null, running = null, saving = false, hooked = false, lastStatus = "", lastLocks = "", lastError = "", epoch = 0;
    const pause = () => new Promise(resolve => setTimeout(resolve, 16));
    function context() {
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面") return null;
      const save = first("save"), wp = first("wp"), g = runtime.globalVars;
      const saveId = save?.getAt(0, 1, 0);
      if (!wp || !Number.isSafeInteger(saveId) || saveId < 10000000) return null;
      return { save, wp, saveId, token: `${saveId}:${g["当前地图编号"]}:${save.uid}:${epoch}` };
    }
    function character(current, id) {
      const s = current.save;
      if (!Number.isSafeInteger(id) || id <= 0 || id >= s.width || !(s.getAt(id, 0, 2) > 0)) return null;
      const job = s.getAt(id, 9, 2) || "自动";
      return { id, job: job === "待命" ? "自动" : job, name: clean(s.getAt(id, 1, 2)),
        identity: JSON.stringify([s.getAt(id, 1, 2), s.getAt(id, 5, 2), s.getAt(id, 51, 2)]) };
    }
    function report(error) {
      const message = error.message || String(error);
      if (message === lastError) return;
      lastError = message;
      console.error("[Bandit TD Formations] Job outfits", error);
      notify(`Job outfits: ${message}`);
    }
    function load(current) {
      if (state?.saveId === current.saveId) return state;
      pending.clear(); lastError = "";
      const next = state = { saveId: current.saveId, key: `cjs-formations:outfits:v1:${current.saveId}`,
        enabled: true, outfits: [], references: new Map(), ready: false, error: null };
      next.loading = (async () => {
        try {
          const data = await runtime.storage.getItem(next.key);
          if (data != null) {
            if (data.version !== 1 || typeof data.enabled !== "boolean" || !Array.isArray(data.outfits) || data.outfits.length > 11000) {
              throw new Error("Saved outfits could not be read. Existing equipment was kept.");
            }
            const keys = new Set();
            for (const outfit of data.outfits) {
              validateOutfit(outfit);
              const key = `${outfit.id}:${outfit.job}`;
              if (keys.has(key)) throw new Error("Duplicate saved job outfits.");
              keys.add(key);
            }
            next.enabled = data.enabled; next.outfits = data.outfits;
            indexReferences(next);
          }
        } catch (error) { next.error = error; report(error); }
        finally { next.ready = true; }
      })();
      return next;
    }
    const findOutfit = (data, who) => data.outfits.find(o => o.id === who.id && o.identity === who.identity && o.job === who.job);
    function indexReferences(data) {
      data.references = new Map();
      for (const outfit of data.outfits) for (const key of new Set(outfit.slots.filter(Boolean))) {
        if (!data.references.has(key)) data.references.set(key, []);
        data.references.get(key).push(outfit);
      }
    }
    function references(current, key) {
      return (load(current).references.get(key) || []).filter(outfit => character(current, outfit.id)?.identity === outfit.identity);
    }
    function isProtected(save, row, layer = 7) {
      const current = context();
      if (!current || current.save !== save) return true;
      const data = load(current);
      // A pending or failed read/write cannot establish that selling is safe.
      if (!data.ready || data.error || saving) return true;
      const piece = item(current, row, layer);
      return !!piece && references(current, piece.key).length > 0;
    }
    function request(id) {
      const current = context();
      if (!current) return;
      load(current);
      const who = character(current, id);
      if (who && outfitJobs.includes(who.job)) pending.set(id, { ...who, token: current.token });
    }
    function installHook() {
      if (hooked) return;
      const fn = engine.GetEventSheetManager().GetFunctionBlockByName("改变角色状态");
      const block = fn?.GetEventBlock();
      if (typeof block?._RunAndBlock !== "function" || typeof fn.CaptureFunctionParameters !== "function") {
        throw new Error("The game's job-change hook is unavailable.");
      }
      const sale = engine.GetEventSheetManager().GetFunctionBlockByName("出售物品");
      const saleBlock = sale?.GetEventBlock();
      if (typeof saleBlock?._RunAndBlock !== "function" || typeof sale.CaptureFunctionParameters !== "function") {
        throw new Error("The game's equipment-sale hook is unavailable.");
      }
      const run = block._RunAndBlock;
      block._RunAndBlock = function (...args) {
        const [id] = fn.CaptureFunctionParameters();
        const result = run.apply(this, args);
        try { request(id); } catch (error) { report(error); }
        return result;
      };
      const sell = saleBlock._RunAndBlock;
      saleBlock._RunAndBlock = function (...args) {
        const [row, , automatic] = sale.CaptureFunctionParameters(), current = context();
        if (current && isProtected(current.save, row)) {
          if (!automatic) notify("Outfit lock: change or forget the saved outfits using this item before selling it.");
          return;
        }
        return sell.apply(this, args);
      };
      hooked = true;
    }
    function item(current, row, layer) {
      const s = current.save, type = s.getAt(row, 1, layer);
      if (!Number.isSafeInteger(row) || row <= 0 || row >= s.width || !(type > 0)) return null;
      return { row, type, slot: current.wp.getAt(type, 6),
        key: outfitFingerprint(Array.from({ length: 50 }, (_, field) => s.getAt(row, field, layer))) };
    }
    function equipment(current, id) {
      return Array.from({ length: 6 }, (_, i) => {
        const row = current.save.getAt(id, 16 + i, 2);
        if (!row) return null;
        const equipped = item(current, row, 9);
        if (!equipped || equipped.slot !== i + 1 || current.save.getAt(row, 7, 9) !== id) {
          throw new Error("Equipment is still changing. Try again after it finishes.");
        }
        return equipped;
      });
    }
    function inventory(current) {
      const items = [];
      for (let row = 1; row < current.save.width; row++) {
        if (current.save.getAt(row, 1, 7) > 0) items.push(item(current, row, 7));
      }
      return items;
    }
    function safe(current) {
      return context()?.token === current.token && !runtime.globalVars["装备穿戴中"] && runtime.timeScale !== 0 &&
        !["转场云", "世界地图", "提示信息", "对话选择框"].some(name => all(name).length) &&
        !all("黑幕").some(x => x.isVisible);
    }
    async function waitForEquipment(current) {
      const start = performance.now();
      // Native equip/unequip yields between inventory transfers, even while the
      // game is paused in a menu. Never overlap those global transfer variables.
      while (runtime.globalVars["装备穿戴中"]) {
        if (context()?.token !== current.token) throw new Error("The map changed during an outfit swap.");
        if (performance.now() - start > 5000) throw new Error("Equipment change did not finish. Restart the game before retrying.");
        await pause();
      }
    }
    function stillSelected(current, who) {
      const latest = context(), now = latest && character(latest, who.id);
      return latest?.token === current.token && now?.identity === who.identity && now.job === who.job;
    }
    function eligible(current, id, target) {
      const { wp, save } = current;
      if (wp.getAt(target.type, 5) === "内丹") return runtime.callFunction("内丹重复判断", id, target.type, 0, 0) === 0;
      return wp.getAt(target.type, 5) === "装备" && (wp.getAt(target.type, 4) === "宝物" ||
        save.getAt(id, 50, 2) + 1 >= save.getAt(target.row, 3, 7));
    }
    async function applyOutfit(current, who, outfit) {
      const equipped = equipment(current, who.id), bag = inventory(current);
      const claimed = new Set();
      for (let row = 1; row < current.save.width; row++) {
        if (current.save.getAt(row, 1, 9) > 0 && current.save.getAt(row, 7, 9) !== who.id) {
          claimed.add(item(current, row, 9).key);
        }
      }
      // Identical records elsewhere cannot prove that the available copy is the
      // saved piece. Keep the current slot instead of borrowing a lookalike.
      const plan = planOutfit(outfit, equipped, bag.filter(piece => !claimed.has(piece.key)));
      plan.changes = plan.changes.filter(change => {
        if (!change.to || eligible(current, who.id, change.to)) return true;
        plan.missing.push(change.slot); return false;
      });
      let count = bag.length;
      const capacity = Number(runtime.callFunction("背包容量上限"));
      if (plan.changes.length && (!Number.isFinite(capacity) || capacity < 0)) throw new Error("Inventory capacity is unavailable.");
      for (const change of plan.changes) {
        // Native swapping first takes the old piece out, then puts the new one
        // in. Reserve a physical inventory row for that intermediate step.
        if (change.from && count >= current.save.width - 1) throw new Error("Free an inventory space to change outfits.");
        count += Number(!!change.from) - Number(!!change.to);
        if (count > capacity) throw new Error("Free an inventory space to restore the outfit's empty slots.");
      }
      const manager = engine.GetEventSheetManager();
      if (plan.changes.length && ["穿戴装备function", "卸下装备function", "装备库数据存取function"].some(name =>
        !manager.GetEventGroupByName(name)?.IsGroupActive())) throw new Error("Equipment functions are unavailable.");
      let changed = false;
      for (const change of plan.changes) {
        if (!state.enabled || !stillSelected(current, who)) break;
        if (!safe(current)) throw new Error("Close the map or dialog before changing outfits.");
        const from = equipment(current, who.id)[change.slot - 1];
        if ((from?.key ?? null) !== (change.from?.key ?? null)) throw new Error("Equipment changed during the outfit swap. Select the job again.");
        if (change.to) {
          if (item(current, change.to.row, 7)?.key !== change.to.key) throw new Error("An outfit item moved. Select the job again.");
          if (!from && !Array.from({ length: current.save.width - 1 }, (_, i) => i + 1).some(row => current.save.getAt(row, 1, 9) <= 0)) {
            throw new Error("The equipment store is full.");
          }
          runtime.callFunction("穿戴装备", 0, change.to.row, who.id, false, false);
        } else runtime.callFunction("卸下装备", change.slot, from.row, who.id, false, false);
        await waitForEquipment(current);
        if (context()?.token !== current.token) throw new Error("The map changed during an outfit swap.");
        const after = equipment(current, who.id)[change.slot - 1];
        if ((after?.key ?? null) !== (change.to?.key ?? null)) throw new Error("The game refused an outfit item. Select the job again.");
        changed = true;
      }
      if (changed && runtime.globalVars["选中角色序号"] === who.id &&
          all("底部菜单背景").some(p => p.instVars["功能"] === "角色")) {
        runtime.callFunction("刷新底部菜单", 8, "底部", "角色", 0, 0, "", true, 0, 0, 0, 0, 0, false, 0);
      }
      if (plan.missing.length) notify(`${who.name}: ${plan.missing.length} outfit slot(s) unavailable or ambiguous; current pieces kept.`);
    }
    function flush() {
      if (running) return running;
      const initial = context();
      if (!initial) return Promise.resolve();
      const data = load(initial);
      running = (async () => {
        await data.loading;
        if (data.error) throw data.error;
        while (pending.size && state === data) {
          const [id, who] = pending.entries().next().value;
          pending.delete(id);
          const current = context();
          if (!data.enabled || !current || !stillSelected(current, who) || who.token !== current.token) continue;
          const outfit = findOutfit(data, who);
          if (!outfit) continue;
          await waitForEquipment(current);
          if (!stillSelected(current, who)) continue;
          await applyOutfit(current, who, outfit);
        }
      })().finally(() => { running = null; });
      return running;
    }
    function selection(current) {
      const id = runtime.globalVars["选中角色序号"], who = character(current, id);
      const page = all("二级页面背景").filter(p => p.isVisible);
      const visible = page.length ? page.every(p => ["角色详情", "装备", "角色丹药"].includes(p.instVars["功能"])) :
        all("底部菜单背景").some(p => p.instVars["功能"] === "角色");
      return visible && who && outfitJobs.includes(who.job) ? { ...who, token: `${current.token}:${id}:${who.identity}:${who.job}` } : null;
    }
    function publish() {
      const current = context(), who = current && selection(current);
      const data = current && load(current);
      const payload = who ? { visible: true, ...who, jobName: clean(runtime.callFunction("文本", who.job, 0)),
        enabled: data.enabled, saved: !!findOutfit(data, who), busy: !data.ready || !!running || saving || pending.size > 0 || !safe(current),
        error: data.error?.message || "" } : { visible: false };
      const text = JSON.stringify(payload);
      if (text !== lastStatus) { lastStatus = text; engine.PostComponentMessageToDOM("cjs-formations", "outfit-status", payload); }
      publishLocks(current);
    }
    function publishLocks(current) {
      const markers = [], data = current && load(current);
      const pages = all("二级页面背景").some(p => p.isVisible);
      const blocked = runtime.globalVars["装备穿戴中"] ||
        ["转场云", "世界地图", "提示信息", "对话选择框"].some(name => all(name).length) || all("黑幕").some(p => p.isVisible);
      if (data?.ready && !data.error && !blocked && data.references.size) for (const icon of all("物品图标")) {
        const v = icon.instVars;
        if (!icon.isVisible || icon.opacity === 0 || icon.layer.isSelfAndParentsVisible === false ||
            (pages && v["用途"] === "底部")) continue;
        const equipped = ["角色装备", "角色装备丹药"].includes(v["功能"]);
        if (!equipped && !["物品", "装备", "当铺", "物品选择", "角色丹药", "词条洗练", "合成材料", "宝物分解"].includes(v["功能"])) continue;
        const layer = equipped ? 9 : v["库序号"];
        if (![7, 9].includes(layer)) continue;
        const piece = item(current, v["物品序号"], layer);
        if (!piece || piece.type !== v["物品编号"]) continue;
        const owners = references(current, piece.key).map(outfit => ({
          name: character(current, outfit.id).name, job: clean(runtime.callFunction("文本", outfit.job, 0)),
        }));
        if (!owners.length) continue;
        const box = icon.getBoundingBox(), [left, top] = icon.layer.layerToCssPx(box.left, box.top);
        const [right, bottom] = icon.layer.layerToCssPx(box.right, box.bottom);
        const size = Math.max(14, Math.min(22, (right - left) * 0.34));
        if (![left, top, right, bottom, size].every(Number.isFinite) || right <= left || bottom <= top) continue;
        markers.push({ uid: icon.uid, x: Math.round(left), y: Math.round(top), size: Math.round(size), owners });
      }
      const text = JSON.stringify(markers);
      if (text !== lastLocks) { lastLocks = text; engine.PostComponentMessageToDOM("cjs-formations", "outfit-locks", { markers }); }
    }
    async function edit(action, payload) {
      if (saving || running || pending.size) return;
      const current = context(), who = current && selection(current);
      if (!who || payload?.token !== who.token || !safe(current)) return;
      const data = load(current);
      if (!data.ready || data.error) return;
      saving = true;
      try {
        let outfits = data.outfits, enabled = data.enabled;
        if (action === "enabled") enabled = !!payload.enabled;
        else {
          outfits = outfits.filter(o => o.id !== who.id || o.job !== who.job);
          if (action === "save") outfits.push(validateOutfit({ id: who.id, identity: who.identity, job: who.job,
            slots: equipment(current, who.id).map(piece => piece?.key ?? null) }));
        }
        await runtime.storage.setItem(data.key, { version: 1, enabled, outfits });
        data.enabled = enabled; data.outfits = outfits; lastError = "";
        indexReferences(data);
        if (action !== "enabled") notify(`${who.name}: ${clean(runtime.callFunction("文本", who.job, 0))} outfit ${action === "save" ? "saved" : "forgotten"}.`);
      } catch (error) { report(error); }
      finally { saving = false; publish(); }
    }
    for (const action of ["save", "forget", "enabled"]) {
      engine.AddDOMComponentMessageHandler("cjs-formations", `outfit-${action}`, payload => edit(action, payload));
    }
    return {
      request, flush, isProtected,
      ready() {
        const current = context();
        return !current || (state?.saveId === current.saveId && !!state.ready && !running && !saving && !pending.size && !runtime.globalVars["装备穿戴中"]);
      },
      tick() {
        const current = context();
        if (current) {
          const data = load(current);
          try { installHook(); } catch (error) { data.error = error; report(error); }
          if (!data.error) {
            if (data.ready && !data.error && pending.size && !saving && safe(current)) flush().catch(report);
          }
        }
        publish();
      },
      leave() {
        epoch++; pending.clear(); state = null; lastStatus = ""; lastLocks = "";
        engine.PostComponentMessageToDOM("cjs-formations", "outfit-locks", { markers: [] });
      },
    };
  }
  Object.assign(globalThis.BanditFormations, { attachOutfits });
})();
