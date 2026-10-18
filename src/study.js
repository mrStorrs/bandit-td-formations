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
        researchBonus: !regular && kj.getAt(id, 15) === "研究",
        category: regular ? "Regular" : researchCategories[order][1] });
    }
    return targets.sort((a, b) => Number(b.researchBonus) - Number(a.researchBonus) ||
      Number(b.regular) - Number(a.regular) ||
      (a.regular ? a.id - b.id : a.order - b.order || a.id - b.id));
  }

  function drillUnlockLevel(zy, id, requirement) {
    for (let child = 1; child < zy.width; child++) {
      if (zy.getAt(child, 0) !== child || ![10, 11, 12].some(field => zy.getAt(child, field) === id)) continue;
      const level = requirement(id);
      return levelOK(level) && level > 0 ? level : 0;
    }
    return 1;
  }

  function drillTargets(zy, save, maximum, requirement, familyOpen, unlockOnly = true) {
    const targets = [];
    if (!levelOK(maximum) || maximum === 0) return targets;
    for (let id = 1; id < zy.width; id++) {
      const rank = zy.getAt(id, 3), level = save.getAt(id, 5, 0), prerequisite = zy.getAt(id, 10);
      if (zy.getAt(id, 0) !== id || !Number.isSafeInteger(rank) || rank < 1 ||
          !levelOK(level) || level >= maximum) continue;
      if (prerequisite > 0 && save.getAt(prerequisite, 5, 0) < requirement(prerequisite)) continue;
      if (rank > 4 && !familyOpen(zy.getAt(id, 4))) continue;
      const limit = unlockOnly ? Math.min(maximum, drillUnlockLevel(zy, id, requirement)) : maximum;
      if (level < limit) targets.push({ id, level, maximum: limit, rank });
    }
    return targets.sort((a, b) => a.rank - b.rank || a.id - b.id);
  }

  function nextResearch(targets, occupied) {
    return targets.find(t => !occupied(t.id));
  }

  const api = { researchTargets, drillUnlockLevel, drillTargets, nextResearch };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalThis.BanditFormations = Object.assign(globalThis.BanditFormations || {}, api);
})();
