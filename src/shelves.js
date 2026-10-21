(() => {
  "use strict";
  const shelfKinds = [4, 5, 8, 6, 9];
  const shelfRange = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 3;

  function planShelves(shelves, stations, items, selected) {
    const eligible = shelves.filter(s => !s.occupied && shelfRange(s, selected)).sort((a, b) => a.id - b.id);
    const role = shelfKinds.indexOf(selected.kind);
    const bag = items.filter(item => role >= 0 && item.elements.length === 5 &&
      item.elements.every(v => Number.isFinite(v) && v >= 0) && item.elements[role] > 0).sort((a, b) => a.row - b.row);
    if (!eligible.length || !bag.length) return [];
    const scores = eligible.map(shelf => {
      const counts = shelfKinds.map(kind => stations.filter(s => s.kind === kind && shelfRange(shelf, s)).length);
      return bag.map(item => item.elements.map((value, i) => {
        // Spirit elements are stored to one decimal. Integer arithmetic matches
        // native decimal rounding, including half-tenths on upgraded shelves.
        const scaled = Math.round(value * 10) * (20 + 3 * shelf.level);
        if (!Number.isSafeInteger(scaled + 10) || scaled < 0) throw new Error("A shelf bonus could not be calculated safely.");
        return Math.floor((scaled + 10) / 20) * counts[i];
      }));
    });
    if (scores.some(row => row.some(score => score.some(v => !Number.isSafeInteger(v) || v < 0)))) {
      throw new Error("A shelf bonus could not be calculated safely.");
    }
    // Encode the five priorities exactly. No number of lower-priority bonuses
    // can outweigh one unit of a higher priority, even with very large items.
    const bases = shelfKinds.map((_, i) => scores.reduce((sum, row) =>
      sum + BigInt(row.reduce((max, score) => Math.max(max, score[i]), 0)), 1n));
    const costs = scores.map(row => row.map(score => -score.reduce((value, part, i) => value * bases[i] + BigInt(part), 0n)));
    const n = eligible.length, m = bag.length + n;
    for (const row of costs) row.push(...Array(n).fill(0n));
    // Rectangular Hungarian assignment: reserve multi-element items for the
    // shared shelves that benefit most, rather than choosing greedily per shelf.
    const u = Array(n + 1).fill(0n), v = Array(m + 1).fill(0n), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const min = Array(m + 1).fill(null), used = Array(m + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = null, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const current = costs[i0 - 1][j - 1] - u[i0] - v[j];
          if (min[j] === null || current < min[j]) { min[j] = current; way[j] = j0; }
          if (delta === null || min[j] < delta) { delta = min[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else if (min[j] !== null) min[j] -= delta;
        }
        j0 = j1;
      } while (p[j0]);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const result = [];
    for (let j = 1; j <= bag.length; j++) if (p[j] && costs[p[j] - 1][j - 1] < 0n) {
      result.push({ shelf: eligible[p[j] - 1], item: bag[j - 1] });
    }
    return result.sort((a, b) => a.shelf.id - b.shelf.id);
  }
  const api = { shelfKinds, shelfRange, planShelves };
  if (typeof module === "object" && module.exports) module.exports = api;
  Object.assign(globalThis.BanditFormations ||= {}, api);
})();
