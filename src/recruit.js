(() => {
  "use strict";
  const grades = ["E", "D", "C", "B", "A", "S", "SS"];

  // Each criterion evaluates one candidate. Future talent criteria can
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
    "stat": {
      validate: rule => ["str", "agi", "int"].includes(rule.stat) && Number.isFinite(rule.above) && rule.above >= 0,
      match(candidate, rule) {
        const value = candidate.stats?.[rule.stat];
        if (!Number.isFinite(value) || value < 0) throw new Error(`Could not read ${rule.stat.toUpperCase()}. Search stopped.`);
        return value > rule.above ? [`${rule.stat.toUpperCase()} ${value}`] : null;
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
      return reasons.some(Boolean) ? reasons.filter(Boolean).flat() : null;
    };
  }

  class RecruitSearch {
    constructor({ context, roll, lock, suspend, status, notify, now = () => performance.now() }) {
      Object.assign(this, { context, roll, lock, suspend, status, notify, now });
      this.running = false;
      this.rolls = 0;
      this.spent = 0;
      this.message = "Choose work-grade or stat targets, then start rolling.";
      this.lastTick = -Infinity;
      this.found = new Set();
      this.dismissed = new Set();
    }
    start({ method, criteria, minimumMoney = 0 } = {}) {
      if (this.running) return;
      try {
        if (!Number.isFinite(minimumMoney) || minimumMoney < 0) throw new Error("Invalid minimum copper. Enter zero or a positive amount.");
        const match = compileRecruitCriteria(criteria), current = this.context();
        if (!current || current.blocked) throw new Error("Open the recruitment screen and finish any pending action first.");
        if (!current.ready) throw new Error("Recruitment is refreshing. Try again in a moment.");
        if (!Number.isInteger(method) || !current.methods.some(m => m.id === method)) throw new Error("That recruitment method is not unlocked.");
        this.found = new Set(current.candidates.filter(c => this.found.has(c.identity)).map(c => c.identity));
        this.dismissed = new Set(this.found);
        this.match = match;
        this.method = method;
        this.minimumMoney = minimumMoney;
        this.token = current.token;
        this.rolls = this.spent = 0;
        this.release = this.suspend();
        this.running = true;
        // Let native click animations/actions already in flight finish first.
        this.nextRoll = this.now() + 500;
        this.message = "Searching…";
        if (!this.checkMatches(current)) this.checkBudget(current);
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
      const matches = current.candidates.filter(c => !c.locked && !this.dismissed.has(c.identity))
        .map(candidate => ({ candidate, reasons: this.match(candidate) })).filter(m => m.reasons);
      if (!matches.length) return false;
      this.lock(matches.map(m => m.candidate), current);
      for (const { candidate } of matches) this.found.add(candidate.identity);
      this.stop(`Found and locked: ${matches.map(m => `${m.candidate.name} (${m.reasons.join(", ")})`).join("; ")}. Recruit them, or press Start rolling to skip these matches.`);
      this.notify(this.message);
      return true;
    }
    checkBudget(current) {
      const method = current.methods.find(m => m.id === this.method);
      if (!method) throw new Error("That recruitment method is no longer available.");
      if (!Number.isFinite(method.cost) || method.cost <= 0 || !Number.isFinite(current.money)) throw new Error("Could not read the refresh cost or copper balance.");
      if (this.minimumMoney > 0 && current.money - method.cost < this.minimumMoney) {
        throw new Error(`Minimum copper limit: ${this.minimumMoney.toLocaleString()}. Another roll would go below it. Search stopped.`);
      }
      if (current.money < method.cost) throw new Error("Not enough copper for another roll. Search stopped.");
      return method;
    }
    tick() {
      if (this.now() - this.lastTick < 200) return;
      this.lastTick = this.now();
      try {
        const current = this.context();
        if (this.running) {
          if (!current || current.token !== this.token) this.stop("Recruitment screen changed. Search stopped.");
          else if (current.blocked) this.stop("Another game action interrupted the search. Press Start rolling to retry.");
          else if (!this.checkMatches(current)) {
            const method = this.checkBudget(current);
            if (this.now() >= this.nextRoll) {
              if (current.candidates.length === 3 && current.candidates.every(c => c.locked && !this.dismissed.has(c.identity))) throw new Error("All three recruits are locked. Unlock a slot before searching.");
              if (!current.ready) throw new Error("Recruitment is refreshing. Search stopped; try again in a moment.");
              const after = this.roll(current, this.method, current.candidates.filter(c => this.dismissed.has(c.identity)), this.minimumMoney);
              this.rolls++;
              this.spent += method.cost;
              this.nextRoll = this.now() + 500;
              if (!after || after.token !== this.token) throw new Error("Recruitment screen changed during the roll.");
              this.found.clear();
              this.dismissed.clear();
              // Inspect synchronously before another tick or native refresh can
              // replace a matching recruit, including on the last affordable roll.
              if (!this.checkMatches(after)) {
                this.checkBudget(after);
                this.message = "Searching…";
              }
            }
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
