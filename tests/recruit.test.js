"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const sandbox = { BanditFormations: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(`${__dirname}/../src/recruit.js`, "utf8"), sandbox);
const { RecruitSearch, compileRecruitCriteria, recruitCriteria } = sandbox.BanditFormations;
const criteria = [{ type: "work-grade", minimum: 5 }];
const candidate = (id, grade = 1, generation = 0) => ({ id, identity: `${id}:${grade}:${generation}`, name: `Recruit ${id}`, locked: false,
  stats: { str: 10, agi: 10, int: 10 },
  work: Array.from({ length: 9 }, (_, i) => ({ name: `Work ${i}`, grade: i === 8 ? grade : 1 })) });

function fixture() {
  let clock = 0, current = { token: "campaign:map:page", ready: true, blocked: false, money: 9000,
    methods: [{ id: 1, cost: 3000 }], candidates: [candidate(1), candidate(2), candidate(3)] };
  let active = true;
  const rolls = [], locks = [], unlocks = [], statuses = [], notices = [], queue = [];
  const search = new RecruitSearch({ now: () => clock, context: () => current,
    roll(c, method, dismissed) {
      for (const old of c.candidates) if (dismissed.some(d => d.identity === old.identity)) { old.locked = false; unlocks.push(old.id); }
      rolls.push(method); c.money -= 3000;
      c.candidates = (queue.shift() || [candidate(1), candidate(2), candidate(3)])
        .map(next => c.candidates.find(old => old.id === next.id && old.locked) || next);
      return c;
    },
    lock(candidates) { for (const c of candidates) { locks.push(c.id); c.locked = true; } },
    suspend() { const original = active; active = false; return () => { active = original; }; },
    status: s => statuses.push(s), notify: s => notices.push(s),
  });
  return { search, current, rolls, locks, unlocks, statuses, notices, queue,
    get active() { return active; }, set active(value) { active = value; },
    setCurrent(value) { current = value; },
    start(options = {}) { search.start({ method: 1, criteria, ...options }); },
    tick(ms = 600) { clock += ms; search.tick(); } };
}
test("any of the nine work grades meets the target, including better grades", () => {
  const match = compileRecruitCriteria(criteria);
  for (let i = 0; i < 9; i++) {
    for (const grade of [5, 6, 7]) {
      const c = candidate(1); c.work[i].grade = grade;
      assert.match(match(c).join(), new RegExp(`Work ${i} (A|S|SS)`));
    }
  }
  assert.equal(match(candidate(1, 4)), null);
});
test("future criteria join the OR targets and compiled rules do not change with later edits", () => {
  recruitCriteria.talent = { validate: r => r.id === 10, match: (c, r) => c.talents?.includes(r.id) ? ["Talent 10"] : null };
  try {
    const rules = [...criteria, { type: "talent", id: 10 }], match = compileRecruitCriteria(rules);
    assert.equal(match(candidate(1, 7)).length, 1);
    assert.equal(match({ ...candidate(2, 4), talents: [10] }).length, 1);
    assert.equal(match(candidate(1, 4)), null);
    assert.equal(match({ ...candidate(3, 5), talents: [10] }).length, 2);
    rules[0].minimum = 7;
    assert.ok(match({ ...candidate(3, 5), talents: [10] }), "compiled rules are independent of later edits");
  } finally { delete recruitCriteria.talent; criteria[0].minimum = 5; }
});
test("B-or-better work OR any selected stat strictly above its own threshold matches", () => {
  const match = compileRecruitCriteria([{ type: "work-grade", minimum: 4 },
    ...["str", "agi", "int"].map((stat, i) => ({ type: "stat", stat, above: 20 + i }))]);
  const c = candidate(1, 3); c.stats = { str: 20, agi: 21, int: 22 };
  assert.equal(match(c), null, "equality is not over the stat threshold");
  for (const stat of ["str", "agi", "int"]) {
    c.stats[stat] += 0.1;
    assert.match(match(c).join(), new RegExp(`${stat.toUpperCase()} ${c.stats[stat]}`));
    c.stats[stat] -= 0.1;
  }
  for (const grade of [4, 5, 6, 7]) {
    c.work[0].grade = grade;
    assert.equal(match(c).length, 1, "a work match does not require a stat match");
  }
  c.stats = { str: 20.1, agi: 21.1, int: 22.1 };
  assert.equal(match(c).length, 4, "reports every matching reason");
});
test("stats can be used alone, zero is a valid threshold, and unselected stats do not match", () => {
  const match = compileRecruitCriteria([{ type: "stat", stat: "agi", above: 0 }]);
  const c = candidate(1, 7); c.stats = { str: 999, agi: 0, int: 999 };
  assert.equal(match(c), null);
  c.stats.agi = 0.1; assert.equal(match(c).join(), "AGI 0.1");
});
test("invalid stat filters and unreadable enabled stats fail closed even with a matching work grade", () => {
  for (const rule of [{ stat: "luck", above: 10 }, { stat: "toString", above: 10 },
    ...[-1, NaN, Infinity, "10", null, undefined].map(above => ({ stat: "str", above }))]) {
    assert.throws(() => compileRecruitCriteria([{ type: "stat", ...rule }]), /Invalid recruitment filter/);
  }
  const match = compileRecruitCriteria([...criteria, { type: "stat", stat: "str", above: 20 }]);
  for (const stats of [undefined, {}, { str: NaN }, { str: Infinity }, { str: -1 }, { str: "30" }]) {
    assert.throws(() => match({ ...candidate(1, 7), stats }), /Could not read STR/);
  }
});
test("a roll locks separate grade-only and stat-only matches and stops before paying again", () => {
  const f = fixture(), statMatch = candidate(2, 1);
  statMatch.stats.int = 25.1;
  f.queue.push([candidate(1, 4), statMatch, candidate(3)]);
  f.start({ criteria: [{ type: "work-grade", minimum: 4 }, { type: "stat", stat: "int", above: 25 }] });
  f.tick(); f.tick();
  assert.deepEqual(f.locks, [1, 2]); assert.deepEqual(f.rolls, [1]);
  assert.equal(f.search.spent, 3000); assert.equal(f.active, true);
  assert.match(f.search.message, /Work 8 B/); assert.match(f.search.message, /INT 25.1/);
});
test("an existing stat-only match locks without spending, and malformed stats never start rolling", () => {
  for (const value of [30, NaN]) {
    const f = fixture(); f.current.candidates[1].stats.str = value;
    f.start({ criteria: [...criteria, { type: "stat", stat: "str", above: 20 }] }); f.tick();
    assert.equal(f.search.running, false); assert.equal(f.current.money, 9000);
    assert.deepEqual(f.rolls, []); assert.deepEqual(f.locks, Number.isNaN(value) ? [] : [2]);
    assert.equal(f.active, true);
  }
});
test("invalid or unknown filters and unreadable grades fail closed", () => {
  for (const rules of [null, [], [{ type: "unknown" }], [{ type: "toString" }], [{ type: "work-grade", minimum: 0 }], [{ type: "work-grade", minimum: 8 }], [{ type: "work-grade", minimum: "5" }]]) {
    assert.throws(() => compileRecruitCriteria(rules));
  }
  const match = compileRecruitCriteria(criteria), c = candidate(1, 7);
  c.work[0].grade = NaN;
  assert.throws(() => match(c), /nine work grades/);
  c.work.pop(); assert.throws(() => match(c), /nine work grades/);
});
test("an existing unlocked match is locked without spending", () => {
  const f = fixture(); f.current.candidates[1] = candidate(2, 6);
  f.start(); f.tick();
  assert.equal(f.search.running, false); assert.deepEqual(f.rolls, []);
  assert.deepEqual(f.locks, [2]); assert.equal(f.current.money, 9000); assert.equal(f.active, true);
});
test("Start after a match skips it until a paid roll, then stops for the next match even if identical", () => {
  const f = fixture(); f.current.candidates[1] = candidate(2, 6);
  f.start(); assert.equal(f.search.running, false); assert.deepEqual(f.locks, [2]);
  f.start(); assert.equal(f.search.running, true);
  f.tick(200); f.tick(200);
  assert.deepEqual(f.rolls, []); assert.deepEqual(f.unlocks, []);
  assert.equal(f.current.candidates[1].locked, true, "keep the previous match protected before paying");
  f.queue.push([candidate(1), candidate(2, 6), candidate(3)]);
  f.tick(200); f.tick();
  assert.deepEqual(f.rolls, [1]); assert.deepEqual(f.unlocks, [2]); assert.deepEqual(f.locks, [2, 2]);
  assert.equal(f.search.running, false); assert.equal(f.search.spent, 3000);
  f.start(); f.tick(); assert.equal(f.search.running, true); assert.deepEqual(f.rolls, [1, 1]);
});
test("Start releases all three previous auto-matches instead of reporting all slots locked", () => {
  const f = fixture(); f.current.candidates = [candidate(1, 5), candidate(2, 6), candidate(3, 7)];
  f.start(); f.start(); f.queue.push([candidate(1), candidate(2), candidate(3, 7)]); f.tick();
  assert.deepEqual(f.unlocks, [1, 2, 3]); assert.deepEqual(f.rolls, [1]);
  assert.deepEqual(f.current.candidates.map(c => c.locked), [false, false, true]);
});
test("manually locked recruits are kept and do not repeatedly stop the search", () => {
  const f = fixture(), keeper = candidate(1, 7); keeper.locked = true; f.current.candidates[0] = keeper;
  f.queue.push([candidate(1), candidate(2, 5), candidate(3)]);
  f.start(); assert.equal(f.search.running, true); f.tick();
  assert.deepEqual(f.locks, [2]); assert.equal(f.current.candidates[0], keeper);
  f.start(); f.tick();
  assert.deepEqual(f.unlocks, [2]); assert.equal(f.current.candidates[0], keeper); assert.equal(keeper.locked, true);
});
test("Stop, no funds, interruptions, and invalid options keep declined locks available for a later retry", () => {
  for (const interrupt of [f => f.search.stop(), f => { f.current.money = 2999; f.tick(); },
    f => { f.current.blocked = true; f.tick(); }, f => f.search.leave()]) {
    const f = fixture(); f.current.candidates[1] = candidate(2, 6); f.start();
    f.start({ criteria: [] }); assert.equal(f.search.running, false);
    f.start(); interrupt(f);
    assert.deepEqual(f.unlocks, []); assert.deepEqual(f.rolls, []); assert.equal(f.current.candidates[1].locked, true);
    f.current.money = 9000; f.current.blocked = false; f.start(); f.tick();
    assert.deepEqual(f.unlocks, [2]); assert.deepEqual(f.rolls, [1]);
  }
});
test("a new match before the next roll does not lose previously declined matches", () => {
  const f = fixture(); f.current.candidates[1] = candidate(2, 6); f.start(); f.start();
  f.current.candidates[2] = candidate(3, 7); f.tick(200);
  assert.equal(f.search.running, false); assert.deepEqual(f.locks, [2, 3]);
  f.start(); f.tick(); assert.deepEqual(f.unlocks, [2, 3]); assert.deepEqual(f.rolls, [1]);
});
test("replacement recruits are not mistaken for the previously found candidate", () => {
  const f = fixture(); f.current.candidates[1] = candidate(2, 6); f.start();
  const replacement = candidate(2, 6, 1); replacement.locked = true; f.current.candidates[1] = replacement;
  f.start(); f.tick(); assert.deepEqual(f.unlocks, []); assert.equal(replacement.locked, true);
});
test("rolls once at a time, locks every match immediately, and never rolls past it", () => {
  const f = fixture();
  f.queue.push([candidate(1), candidate(2), candidate(3)], [candidate(1, 5), candidate(2), candidate(3, 7)]);
  f.start(); assert.equal(f.active, false);
  f.tick(200); f.tick(200); assert.equal(f.rolls.length, 0);
  f.tick(200); assert.equal(f.rolls.length, 1);
  f.tick(200); f.tick(200); assert.equal(f.rolls.length, 1);
  f.tick(200); assert.equal(f.rolls.length, 2);
  assert.deepEqual(f.locks, [1, 3]); assert.equal(f.search.running, false); assert.equal(f.active, true);
  assert.equal(f.search.spent, 6000); assert.equal(f.search.rolls, 2);
  for (let i = 0; i < 5; i++) f.tick();
  assert.equal(f.rolls.length, 2); assert.equal(f.notices.length, 1);
});
test("the last affordable roll still checks and locks its match before stopping", () => {
  const f = fixture(); f.current.money = 3000; f.queue.push([candidate(1, 5)]);
  f.start(); f.tick(); assert.deepEqual(f.locks, [1]); assert.equal(f.current.money, 0);
  assert.match(f.search.message, /Found and locked/);
});
test("insufficient money, all locked slots, and lost methods never spend", () => {
  for (const change of [f => { f.current.money = 2999; }, f => f.current.candidates.forEach(c => { c.locked = true; }),
    f => { f.current.methods = []; }, f => { f.current.money = NaN; }]) {
    const f = fixture(); f.start(); change(f); f.tick();
    assert.equal(f.search.running, false); assert.equal(f.rolls.length, 0); assert.equal(f.active, true);
  }
});
test("screen close, save/map change, blockers, and Stop cancel without an extra roll", () => {
  for (const change of [f => f.setCurrent(null), f => { f.current.token = "other"; },
    f => { f.current.blocked = true; }, f => f.search.stop(), f => f.search.leave()]) {
    const f = fixture(); f.start(); change(f); f.tick(); f.tick();
    assert.equal(f.search.running, false); assert.equal(f.rolls.length, 0); assert.equal(f.active, true);
  }
});
test("cooldown and disabled native automation are restored correctly", () => {
  const f = fixture(); f.current.ready = false; f.start();
  assert.equal(f.search.running, false); assert.equal(f.active, true);
  f.current.ready = true; f.active = false; f.start(); f.search.stop(); assert.equal(f.active, false);
  f.active = true; f.start(); f.current.ready = false; f.tick();
  assert.equal(f.search.running, false); assert.equal(f.active, true);
});
test("roll and lock failures release native automation and stop retrying", () => {
  for (const operation of ["roll", "lock"]) {
    const f = fixture(); f.search[operation] = () => { throw new Error("native failure"); };
    if (operation === "lock") f.current.candidates[0] = candidate(1, 5);
    f.start(); f.tick(); f.tick();
    assert.equal(f.search.running, false); assert.equal(f.active, true); assert.equal(f.rolls.length, 0);
    assert.match(f.search.message, /native failure/);
  }
});
