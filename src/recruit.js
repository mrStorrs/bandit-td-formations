(() => {
  "use strict";
  const grades = ["E", "D", "C", "B", "A", "S", "SS"];

  // Each criterion evaluates one candidate. Future talent/stat criteria can
  // join this table without changing the rolling loop or game controls.
  const recruitCriteria = {
    "work-grade": {
      validate: rule => Number.isInteger(rule.minimum) && rule.minimum >= 1 && rule.minimum <= grades.length,
      match(candidate, rule) {
        if (candidate.work.length !== 9 || candidate.work.some(w => !Number.isInteger(w.grade) || w.grade < 1 || w.grade > grades.length)) {
          throw new Error("Could not read all nine work grades. Search stopped.");
        }
        const matches = candidate.work.filter(w => w.grade >= rule.minimum);
        return matches.length ? matches.map(w => `${w.name} ${grades[w.grade - 1]}`) : null;
      },
    },
  };
  function compileRecruitCriteria(rules) {
    if (!Array.isArray(rules) || !rules.length) throw new Error("Choose a recruitment target first.");
    const checks = rules.map(rule => {
      const handler = rule && Object.hasOwn(recruitCriteria, rule.type) && recruitCriteria[rule.type];
      if (!handler || !handler.validate(rule)) throw new Error("Invalid recruitment filter. Search stopped.");
      const saved = { ...rule };
      return candidate => handler.match(candidate, saved);
    });
    return candidate => {
      const reasons = checks.map(check => check(candidate));
      return reasons.every(Boolean) ? reasons.flat() : null;
    };
  }

  class RecruitSearch {
    constructor({ context, roll, lock, suspend, status, notify, now = () => performance.now() }) {
      Object.assign(this, { context, roll, lock, suspend, status, notify, now });
      this.running = false;
      this.rolls = 0;
      this.spent = 0;
      this.message = "Choose a minimum work grade, then start rolling.";
      this.lastTick = -Infinity;
    }
    start({ method, criteria } = {}) {
      if (this.running) return;
      try {
        const match = compileRecruitCriteria(criteria), current = this.context();
        if (!current || current.blocked) throw new Error("Open the recruitment screen and finish any pending action first.");
        if (!current.ready) throw new Error("Recruitment is refreshing. Try again in a moment.");
        if (!Number.isInteger(method) || !current.methods.some(m => m.id === method)) throw new Error("That recruitment method is not unlocked.");
        this.match = match;
        this.method = method;
        this.token = current.token;
        this.rolls = this.spent = 0;
        this.release = this.suspend();
        this.running = true;
        // Let native click animations/actions already in flight finish first.
        this.nextRoll = this.now() + 500;
        this.message = "Searching…";
        this.checkMatches(current);
      } catch (error) { this.stop(error.message); }
      this.publish();
    }
    stop(message = "Stopped. Press Start rolling to search again.") {
      this.running = false;
      const release = this.release;
      this.release = null;
      if (release) release();
      this.message = message;
    }
    checkMatches(current) {
      const matches = current.candidates.map(candidate => ({ candidate, reasons: this.match(candidate) })).filter(m => m.reasons);
      if (!matches.length) return false;
      this.lock(matches.map(m => m.candidate), current);
      this.stop(`Found and locked: ${matches.map(m => `${m.candidate.name} (${m.reasons.join(", ")})`).join("; ")}. Recruit them when ready.`);
      this.notify(this.message);
      return true;
    }
    tick() {
      if (this.now() - this.lastTick < 200) return;
      this.lastTick = this.now();
      try {
        const current = this.context();
        if (this.running) {
          if (!current || current.token !== this.token) this.stop("Recruitment screen changed. Search stopped.");
          else if (current.blocked) this.stop("Another game action interrupted the search. Press Start rolling to retry.");
          else if (!this.checkMatches(current) && this.now() >= this.nextRoll) {
            const method = current.methods.find(m => m.id === this.method);
            if (!method) throw new Error("That recruitment method is no longer available.");
            if (current.candidates.length === 3 && current.candidates.every(c => c.locked)) throw new Error("All three recruits are locked. Unlock a slot before searching.");
            if (!Number.isFinite(method.cost) || method.cost <= 0 || !Number.isFinite(current.money)) throw new Error("Could not read the refresh cost or copper balance.");
            if (current.money < method.cost) throw new Error("Not enough copper for another roll. Search stopped.");
            if (!current.ready) throw new Error("Recruitment is refreshing. Search stopped; try again in a moment.");
            const after = this.roll(current, this.method);
            this.rolls++;
            this.spent += method.cost;
            this.nextRoll = this.now() + 500;
            if (!after || after.token !== this.token) throw new Error("Recruitment screen changed during the roll.");
            // Inspect synchronously before another tick or native refresh can
            // replace a matching recruit, including on the last affordable roll.
            if (!this.checkMatches(after)) this.message = "Searching…";
          }
        }
      } catch (error) { this.stop(error.message); }
      this.publish();
    }
    publish() {
      let current;
      try { current = this.context(); } catch (error) { this.stop(error.message); }
      const state = { visible: !!current, running: this.running, rolls: this.rolls, spent: this.spent,
        message: this.message, methods: current?.methods || [], grades };
      const serialized = JSON.stringify(state);
      if (serialized !== this.lastStatus) { this.lastStatus = serialized; this.status(state); }
    }
    leave() { this.stop("Recruitment screen closed. Search stopped."); }
  }
  Object.assign(globalThis.BanditFormations, { RecruitSearch, compileRecruitCriteria, recruitCriteria });
})();
