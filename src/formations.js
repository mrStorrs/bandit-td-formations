/* Shared formation rules; also loaded directly by the Node tests. */
(() => {
  "use strict";
  const tileKey = (p) => `${p.x},${p.y}`;

  function snapshot(context) {
    if (!context.characters.length) throw new Error("No characters to save.");
    const data = {
      version: 2,
      saveId: context.saveId,
      mapId: context.mapId,
      characters: context.characters.map(({ id, identity, x, y, mode, priorityX, priorityY }) =>
        ({ id, identity, x, y, mode, priorityX, priorityY })),
    };
    planRestore(data, context);
    return data;
  }

  function planRestore(saved, current) {
    if (!saved || ![1, 2].includes(saved.version) || !Array.isArray(saved.characters) ||
        saved.characters.length > 1000 || saved.saveId !== current.saveId || saved.mapId !== current.mapId) {
      throw new Error("This formation does not match the current save and map.");
    }
    const characters = new Map(current.characters.map(c => [c.id, c]));
    const tiles = new Map(current.tiles.map(t => [tileKey(t), t]));
    const occupants = new Map(current.characters.map(c => [tileKey(c), c.id]));
    const ids = new Set(), destinations = new Set(), moves = [], changes = [];
    let skipped = 0;
    for (const entry of saved.characters) {
      if (!entry || !Number.isSafeInteger(entry.id) || entry.id <= 0 ||
          typeof entry.identity !== "string" || !Number.isSafeInteger(entry.x) ||
          !Number.isSafeInteger(entry.y) || ids.has(entry.id) || destinations.has(tileKey(entry))) {
        throw new Error("The saved formation is invalid. Hold the key to replace it.");
      }
      if (saved.version === 2 && (typeof entry.mode !== "string" || !entry.mode.length || entry.mode.length > 100 ||
          !Number.isSafeInteger(entry.priorityX) || !Number.isSafeInteger(entry.priorityY))) {
        throw new Error("The saved formation has invalid jobs. Hold the key to replace it.");
      }
      ids.add(entry.id);
      destinations.add(tileKey(entry));
      const character = characters.get(entry.id);
      if (!character || character.identity !== entry.identity) { skipped++; continue; }
      if (saved.version === 2) {
        const targetExists = tiles.has(tileKey({ x: entry.priorityX, y: entry.priorityY }));
        changes.push({ id: entry.id, from: character, mode: entry.mode,
          priorityX: targetExists ? entry.priorityX : 0, priorityY: targetExists ? entry.priorityY : 0 });
      }
      if (tileKey(character) === tileKey(entry)) continue;
      const tile = tiles.get(tileKey(entry));
      if (!tile || !tile.allowed) throw new Error("A saved tile is no longer available. No characters moved.");
      moves.push({ ...entry, from: character });
    }
    const movingIds = new Set(moves.map(m => m.id));
    for (const move of moves) {
      const tile = tiles.get(tileKey(move));
      const occupant = occupants.get(tileKey(move));
      if ((occupant && occupant !== move.id && !movingIds.has(occupant)) ||
          (tile.occupied && !occupant && !tile.building)) {
        throw new Error("A saved tile is occupied. No characters moved.");
      }
      if (tile.buildingOccupant && tile.buildingOccupant !== move.id && !movingIds.has(tile.buildingOccupant)) {
        throw new Error("A saved building slot is occupied. No characters moved.");
      }
    }
    return { moves, changes, skipped };
  }

  const characterFormation = {
    prefix: "cjs-formations:v1", snapshot, planRestore,
    savedMessage: (slot, data) => `Formation ${slot} saved (${data.characters.length} characters, positions + jobs).`,
    emptyMessage: slot => `Slot ${slot} is empty. Hold ${slot} for 1 second to save.`,
    restoredMessage: (slot, data, plan) => `Formation ${slot} restored (${plan.moves.length} moved, ${plan.changes.length} jobs${plan.skipped ? `, ${plan.skipped} unavailable or renamed` : ""}).` +
      (data.version === 1 ? ` Hold ${slot} again to save jobs.` : ""),
  };

  class Hotkeys {
    constructor({ context, storage, apply, notify, formation = characterFormation, onSave = () => {}, now = () => performance.now(), holdMs = 1000 }) {
      Object.assign(this, { context, storage, apply, notify, formation, onSave, now, holdMs });
      this.pending = null;
      this.busy = false;
    }
    cancel() { this.pending = null; }
    key(phase, slot) {
      if (!Number.isInteger(slot) || slot < 1 || slot > 4) return;
      if (phase === "down") {
        if (this.pending) { if (this.pending.slot !== slot) this.cancel(); return; }
        if (this.busy) return;
        const context = this.context();
        if (!context) return;
        this.pending = { slot, token: context.token, start: this.now(), saved: false };
      } else if (phase === "up" && this.pending?.slot === slot) {
        const pending = this.pending;
        this.pending = null;
        if (!pending.saved) return this.perform(pending, this.now() - pending.start >= this.holdMs);
      }
    }
    tick() {
      const pending = this.pending;
      if (!pending) return;
      const context = this.context();
      if (!context || context.token !== pending.token) { this.cancel(); return; }
      if (!pending.saved && this.now() - pending.start >= this.holdMs) {
        pending.saved = true;
        return this.perform(pending, true);
      }
    }
    async perform(pending, save) {
      const context = this.context();
      if (!context || context.token !== pending.token || this.busy) return;
      this.busy = true;
      try {
        const key = `${this.formation.prefix}:${context.saveId}:${context.mapId}:${pending.slot}`;
        if (save) {
          const data = this.formation.snapshot(context);
          await this.storage.setItem(key, data);
          if (this.context()?.token === pending.token) {
            this.onSave(pending.slot, context);
            this.notify(this.formation.savedMessage(pending.slot, data));
          }
        } else {
          const data = await this.storage.getItem(key);
          const latest = this.context();
          if (!latest || latest.token !== pending.token) return;
          if (data == null) { this.notify(this.formation.emptyMessage(pending.slot)); return; }
          const plan = this.formation.planRestore(data, latest);
          this.apply(plan, latest);
          this.notify(this.formation.restoredMessage(pending.slot, data, plan));
        }
      } catch (error) {
        console.error("[Bandit TD Formations]", error);
        this.notify(error.message || "Formation operation failed.");
      } finally { this.busy = false; }
    }
  }
  globalThis.BanditFormations = { snapshot, planRestore, Hotkeys, tileKey };
})();
