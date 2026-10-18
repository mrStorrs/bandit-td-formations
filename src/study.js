(() => {
  "use strict";
  const researchCategories = [
    ["团队", "Team", 11], ["采集", "Gather", 24], ["发展", "Growth", 23],
    ["修炼", "Cultivate", 25], ["制造", "Craft", 22],
  ];
  const levelOK = value => Number.isSafeInteger(value) && value >= 0;

  function researchTargets(kj, save, cap) {
    const targets = [];
    for (let id = 1; id < kj.width; id++) {
      if (kj.getAt(id, 0) !== id) continue;
      const category = kj.getAt(id, 2), regular = category === "基础";
      const order = researchCategories.findIndex(c => c[0] === category);
      if (!regular && order < 0) continue;
      const prerequisite = regular ? kj.getAt(id, 7) : researchCategories[order][2];
      if (prerequisite > 0 && save.getAt(prerequisite, 4, 0) !== 1) continue;
      const level = save.getAt(id, 4, 0), maximum = regular ? 1 : cap(id);
      if (!levelOK(level) || !levelOK(maximum) || level >= maximum) continue;
      targets.push({ id, level, maximum, regular, order,
        category: regular ? "Regular" : researchCategories[order][1] });
    }
    return targets.sort((a, b) => Number(b.regular) - Number(a.regular) ||
      (a.regular ? a.id - b.id : a.level - b.level || a.order - b.order || a.id - b.id));
  }

  function drillTargets(zy, save, maximum, requirement, familyOpen) {
    const targets = [];
    if (!levelOK(maximum) || maximum === 0) return targets;
    for (let id = 1; id < zy.width; id++) {
      const rank = zy.getAt(id, 3), level = save.getAt(id, 5, 0), prerequisite = zy.getAt(id, 10);
      if (zy.getAt(id, 0) !== id || !Number.isSafeInteger(rank) || rank < 1 ||
          !levelOK(level) || level >= maximum) continue;
      if (prerequisite > 0 && save.getAt(prerequisite, 5, 0) < requirement(prerequisite)) continue;
      if (rank > 4 && !familyOpen(zy.getAt(id, 4))) continue;
      targets.push({ id, level, maximum, rank });
    }
    return targets.sort((a, b) => a.rank - b.rank || a.id - b.id);
  }

  function nextResearch(targets, occupied) {
    const regular = targets.find(t => t.regular && !occupied(t.id));
    if (regular) return regular;
    const advanced = targets.filter(t => !t.regular);
    // Finish the lowest open level across all categories before starting the next.
    return advanced.find(t => t.level === advanced[0].level && !occupied(t.id));
  }

  const api = { researchTargets, drillTargets, nextResearch };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalThis.BanditFormations = Object.assign(globalThis.BanditFormations || {}, api);
})();
