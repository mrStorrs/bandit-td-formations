"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shelfKinds, shelfRange, planShelves } = require("../src/shelves.js");
const shelf = (id, x = 0, y = 1, level = 0) => ({ id, x, y, level, occupied: false });
const station = (kind = 4, x = 0, y = 0) => ({ kind, x, y });
const item = (row, ...elements) => ({ row, elements: Array.from({ length: 5 }, (_, i) => elements[i] || 0) });
const pairs = plan => plan.map(p => [p.shelf.id, p.item.row]);

test("fills only empty shelves in Manhattan range, once per spirit", () => {
  const selected = station(), shelves = [shelf(1, 3, 0), shelf(2, 2, 2), { ...shelf(3), occupied: true }, shelf(4, -1, -2)];
  assert.deepEqual(pairs(planShelves(shelves, [selected], [item(1, 20), item(2, 30)], selected)), [[1, 2], [4, 1]]);
  assert.equal(shelfRange(shelf(1, 2, 2), selected), false);
});

test("reserves a dual-element spirit for the shared shelf instead of wasting it on an isolated one", () => {
  const selected = station(), benches = [selected, station(5, 4, 0)];
  const plan = planShelves([shelf(1, -1, 0), shelf(2, 2, 0)], benches, [item(1, 100, 50), item(2, 100)], selected);
  assert.deepEqual(pairs(plan), [[1, 2], [2, 1]]);
});

test("shared shelves follow every priority, regardless of which bench was clicked", () => {
  for (let priority = 0; priority < 4; priority++) {
    const high = station(shelfKinds[priority]), low = station(shelfKinds[priority + 1]);
    const a = Array(5).fill(1), b = Array(5).fill(1);
    a[priority] = 2; b[priority + 1] = 1000000000;
    assert.deepEqual(pairs(planShelves([shelf(1)], [low, high], [item(1, ...b), item(2, ...a)], low)), [[1, 2]]);
  }
});

test("every station role uses its own element and ignores zero-benefit spirits", () => {
  for (let i = 0; i < 5; i++) {
    const selected = station(shelfKinds[i]), values = Array(5).fill(0); values[i] = 10;
    const plan = planShelves([shelf(1), shelf(2)], [selected], [item(1), item(2, ...values)], selected);
    assert.equal(plan.length, 1); assert.equal(plan[0].item.row, 2);
  }
});

test("higher shelf levels get the stronger spirit and values use native rounding", () => {
  const selected = station();
  assert.deepEqual(pairs(planShelves([shelf(1), shelf(2, 0, 2, 10)], [selected], [item(1, 90), item(2, 100)], selected)), [[1, 1], [2, 2]]);
});

test("decimal half-rounding cannot turn a forge advantage into a lower-priority tie", () => {
  const selected = station(), benches = [selected, station(5, -4, 0)];
  // Native decimal arithmetic rounds 9 * 10 * 1.15 to 104, not 103.
  assert.deepEqual(pairs(planShelves([shelf(1, -1, 0), shelf(2, 1, 0, 1)], benches,
    [item(1, 9, 100), item(2, 8.9)], selected)), [[1, 2], [2, 1]]);
});

test("counts multiple benches of the same kind and excludes out-of-range benches", () => {
  const selected = station(), benches = [selected, station(4, 5, 0), station(5, -10, 0)];
  assert.deepEqual(pairs(planShelves([shelf(1, -1, 0), shelf(2, 2, 0)], benches, [item(1, 100), item(2, 1, 9999)], selected)), [[1, 2], [2, 1]]);
});

test("shortages, empty inputs, invalid values and deterministic ties", () => {
  const selected = station(), shelves = [shelf(2), shelf(1)];
  assert.deepEqual(planShelves(shelves, [selected], [], selected), []);
  assert.deepEqual(planShelves([], [selected], [item(1, 20)], selected), []);
  assert.equal(planShelves(shelves, [selected], [item(1, 20)], selected).length, 1);
  assert.equal(planShelves(shelves, [selected], [item(1, NaN), item(2, Infinity), item(3, -1)], selected).length, 0);
  const input = [item(2, 20), item(1, 20)], before = JSON.stringify([shelves, input]);
  assert.deepEqual(pairs(planShelves(shelves, [selected], input, selected)), [[1, 1], [2, 2]]);
  assert.equal(JSON.stringify([shelves, input]), before);
});

test("assignment agrees with exhaustive search across mixed levels, overlaps and shortages", () => {
  let seed = 91;
  const random = n => (seed = (seed * 16807) % 2147483647) % n;
  const compare = (a, b) => { for (let i = 0; i < 5; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  for (let trial = 0; trial < 50; trial++) {
    const selected = station(), benches = [selected, ...shelfKinds.map(kind => station(kind, random(7) - 3, random(7) - 3))];
    const shelves = [shelf(1, 1, 0, random(10)), shelf(2, -1, 0, random(10)), shelf(3, 0, 2, random(10))];
    const items = Array.from({ length: 1 + random(5) }, (_, i) => item(i + 1, ...Array.from({ length: 5 }, () => 1 + random(20))));
    const score = (s, p) => p.elements.map((v, i) => Math.floor((Math.round(v * 10) * (20 + 3 * s.level) + 10) / 20) * benches.filter(b => b.kind === shelfKinds[i] && shelfRange(s, b)).length);
    let best = Array(5).fill(0);
    function search(index, left, total) {
      if (index === shelves.length) { if (compare(total, best) > 0) best = total; return; }
      search(index + 1, left, total);
      for (const p of left) search(index + 1, left.filter(i => i !== p), score(shelves[index], p).map((v, i) => v + total[i]));
    }
    search(0, items, Array(5).fill(0));
    const actual = planShelves(shelves, benches, items, selected).reduce((total, p) => score(p.shelf, p.item).map((v, i) => v + total[i]), Array(5).fill(0));
    assert.deepEqual(actual, best, `trial ${trial}`);
  }
});
