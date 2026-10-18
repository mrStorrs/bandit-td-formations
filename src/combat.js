(() => {
  "use strict";

  function snapshotModes(current) {
    const saved = {
      version: 1, saveId: current.saveId, mapId: current.mapId,
      characters: current.characters.map(({ id, identity, mode, priorityX, priorityY }) =>
        ({ id, identity, mode, priorityX, priorityY })),
    };
    planModes(saved, current, false);
    return saved;
  }

  function planModes(saved, current, restore) {
    if (!saved || saved.version !== 1 || saved.saveId !== current.saveId ||
        !Number.isSafeInteger(saved.mapId) || !Array.isArray(saved.characters) ||
        !saved.characters.length || saved.characters.length > 1000) {
      throw new Error("The saved combat toggle does not match this campaign.");
    }
    const characters = new Map(current.characters.map(c => [c.id, c]));
    const ids = new Set(), changes = [];
    let skipped = 0;
    for (const entry of saved.characters) {
      if (!entry || !Number.isSafeInteger(entry.id) || entry.id <= 0 || ids.has(entry.id) ||
          typeof entry.identity !== "string" || typeof entry.mode !== "string" ||
          !entry.mode.length || entry.mode.length > 100 ||
          !Number.isSafeInteger(entry.priorityX) || !Number.isSafeInteger(entry.priorityY)) {
        throw new Error("The saved combat toggle is invalid. No modes changed.");
      }
      ids.add(entry.id);
      const from = characters.get(entry.id);
      if (!from || from.identity !== entry.identity) { skipped++; continue; }
      // Work targets are map coordinates; never carry them to a different map.
      const targetExists = restore && saved.mapId === current.mapId &&
        current.tiles.some(t => t.x === entry.priorityX && t.y === entry.priorityY);
      changes.push({ id: entry.id, from, mode: restore ? entry.mode : "战斗",
        priorityX: targetExists ? entry.priorityX : 0, priorityY: targetExists ? entry.priorityY : 0 });
    }
    return { changes, skipped };
  }

  class CombatToggle {
    constructor({ context, storage, apply, notify }) {
      Object.assign(this, { context, storage, apply, notify });
      this.busy = false;
    }
    async toggle() {
      const initial = this.context();
      if (!initial || this.busy) return;
      this.busy = true;
      try {
        const key = `cjs-formations:combat:v1:${initial.saveId}`;
        const saved = await this.storage.getItem(key);
        const current = this.context();
        if (!current || current.token !== initial.token) return;
        if (saved != null) {
          const plan = planModes(saved, current, true);
          await this.apply(plan, current);
          // Retain the snapshot on an apply/storage failure so C can retry undo.
          await this.storage.setItem(key, null);
          if (this.context()?.token === initial.token) {
            this.notify(`Previous modes restored (${plan.changes.length} characters${plan.skipped ? `, ${plan.skipped} unavailable or renamed` : ""}).`);
          }
        } else {
          const snapshot = snapshotModes(current);
          // Persist the undo before touching game state, including across restarts.
          await this.storage.setItem(key, snapshot);
          const latest = this.context();
          if (!latest || latest.token !== initial.token) {
            await this.storage.setItem(key, null);
            return;
          }
          const plan = planModes(snapshot, latest, false);
          await this.apply(plan, latest);
          this.notify(`Combat on (${plan.changes.length} characters). Press C to restore previous modes.`);
        }
      } catch (error) {
        console.error("[Bandit TD Formations]", error);
        this.notify(error.message || "Combat toggle failed. Press C to retry.");
      } finally { this.busy = false; }
    }
  }
  Object.assign(globalThis.BanditFormations, { CombatToggle });
})();
