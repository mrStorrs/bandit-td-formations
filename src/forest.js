(() => {
  "use strict";
  const { planRestore } = globalThis.BanditFormations;

  class ForestLoop {
    constructor({ context, storage, apply, summon, suspendAuto, notify, status,
      available = () => true, now = () => performance.now() }) {
      Object.assign(this, { context, storage, apply, summon, suspendAuto, notify, status, available, now });
      this.enabled = true;
      this.busy = false;
      this.generation = 0;
      this.nextTick = 0;
      this.token = null;
      this.releaseAuto = null;
      this.lastStatus = null;
    }
    show(text) {
      if (text === this.lastStatus) return;
      this.lastStatus = text;
      this.status(text);
    }
    reset() {
      this.generation++;
      this.token = null;
      this.presets = null;
      this.phase = null;
      this.error = null;
      if (this.releaseAuto) { this.releaseAuto(); this.releaseAuto = null; }
    }
    toggle() {
      this.enabled = !this.enabled;
      this.reset();
      this.nextTick = 0;
      this.notify(`Beast realm loop ${this.enabled ? "ON" : "OFF"}. F6 toggles it.`);
      this.show(this.enabled ? null : "Beast realm loop OFF · F6 to start");
    }
    formationSaved() { this.reset(); this.nextTick = 0; }
    leave() { this.reset(); this.show(null); }
    plan(slot, current) {
      const saved = this.presets[slot - 1];
      const plan = planRestore(saved, current);
      if (plan.skipped || !saved.characters.length || saved.characters.length !== current.characters.length) {
        throw new Error(`Resave formation ${slot} with all current characters.`);
      }
      return plan;
    }
    restore(slot, current) { this.apply(this.plan(slot, current), current); }
    async tick() {
      if (this.now() < this.nextTick) return;
      this.nextTick = this.now() + 250;
      const current = this.context();
      if (!current) { if (this.token || this.lastStatus) this.leave(); return; }
      if (!this.enabled) { this.show("Beast realm loop OFF · F6 to start"); return; }
      if (current.token !== this.token) { this.reset(); this.token = current.token; }
      if (this.busy) return;
      if (this.error) { this.show(`Beast realm loop paused: ${this.error}`); return; }
      if (current.blocked || !this.available()) {
        this.show("Beast realm loop paused · Resume play to continue · F6 to stop"); return;
      }
      const generation = this.generation, token = current.token;
      this.busy = true;
      try {
        if (!this.presets) {
          this.releaseAuto = this.suspendAuto();
          const prefix = `cjs-formations:v1:${current.saveId}:${current.mapId}:`;
          const presets = await Promise.all([this.storage.getItem(prefix + 1), this.storage.getItem(prefix + 2)]);
          const latest = this.context();
          if (generation !== this.generation || latest?.token !== token || !this.enabled) return;
          if (presets.some(p => p == null)) throw new Error("Save formations 1 and 2 here to begin.");
          this.presets = presets;
          if (latest.blocked || !this.available()) return;
          // Re-read after storage: the map, fight, or roster may have changed.
          this.advance(latest);
        } else this.advance(current);
      } catch (error) {
        if (generation !== this.generation) return;
        console.error("[Bandit TD Formations] Beast realm loop", error);
        this.error = error.message || "Unable to continue. Toggle F6 off/on to retry.";
        if (this.releaseAuto) { this.releaseAuto(); this.releaseAuto = null; }
        this.show(`Beast realm loop paused: ${this.error}`);
        this.notify(this.error);
      } finally {
        this.busy = false;
        // A map exit during an async read must also restore native auto-summon.
        if (generation === this.generation && this.context()?.token !== this.token) this.leave();
      }
    }
    advance(current) {
      if (!this.phase) {
        this.plan(1, current); this.plan(2, current);
        this.restore(current.active ? 2 : 1, current);
        this.phase = current.active ? "fighting" : "waiting";
        this.victories = current.victories;
      } else if (this.phase === "waiting" && (current.ready || current.active)) {
        // Validate the return formation before committing to another fight.
        this.plan(1, current);
        this.restore(2, current);
        this.victories = current.victories;
        if (!current.active) this.summon(current);
        this.phase = "fighting";
      } else if (this.phase === "fighting" && !current.active) {
        this.restore(1, current);
        if (current.victories <= this.victories) {
          throw new Error("Summon ended without a win. Toggle F6 off/on to retry.");
        }
        this.phase = "waiting";
      }
      this.show(this.phase === "fighting" ? "Beast realm: formation 2 · Fighting summon · F6 to stop" :
        "Beast realm: formation 1 · Waiting for summon · F6 to stop");
    }
  }
  Object.assign(globalThis.BanditFormations, { ForestLoop });
})();
