(() => {
  "use strict";
  function sortInventoryRows(rows, save, wp, roleId, suffixValue) {
    const { craftRoles, craftRecipes, matchesCraftItem } = globalThis.BanditFormations;
    const role = craftRoles.find(role => role.id === roleId);
    if (!role) return [...rows];
    const targets = new Map();
    const ranked = rows.map((row, index) => {
      const recipe = save.getAt(row, 1, 7), tier = save.getAt(row, 3, 7);
      const item = { recipe, tier, slot: wp.getAt(recipe, 6), quality: save.getAt(row, 5, 7),
        level: save.getAt(row, 6, 7), mainRoll: save.getAt(row, 8, 7),
        bonuses: Array.from({ length: 6 }, (_, i) => save.getAt(row, 9 + i, 7)),
        rolls: Array.from({ length: 6 }, (_, i) => save.getAt(row, 15 + i, 7)) };
      if (!targets.has(tier)) targets.set(tier, { ...role, recipes: craftRecipes(wp, role, tier) });
      const target = targets.get(tier), matched = matchesCraftItem(item, target, { tier, minimum: 1 });
      // Damage-only work pieces are useful to inspect, but do not meet the
      // automation's keeper rule. Within a realm, keep them behind matches.
      const damageOnly = !role.combat && item.slot >= 1 && item.slot <= 4 &&
        recipe === target.recipes[item.slot - 1] && item.bonuses.includes(52);
      const group = matched ? 2 : damageOnly ? 1 : 0;
      const value = bonus => item.bonuses.reduce((sum, id, i) => {
        if (id !== bonus) return sum;
        const amount = suffixValue(item, id, item.rolls[i]);
        if (!Number.isFinite(amount)) throw new Error("An item's suffix value could not be compared.");
        return sum + amount;
      }, 0);
      const rank = group ? [tier, group, item.quality,
        ...(!role.combat ? [2 * Number(item.bonuses.includes(51)) + Number(item.bonuses.includes(role.bonus)),
          value(51), value(role.bonus), value(52)] : [value(role.bonus), item.mainRoll]),
        item.level] : [tier, 0];
      if (!rank.every(Number.isFinite)) throw new Error("An item's stats could not be compared.");
      return { row, index, rank };
    });
    ranked.sort((a, b) => {
      for (let i = 0; i < Math.min(a.rank.length, b.rank.length); i++) {
        if (a.rank[i] !== b.rank[i]) return b.rank[i] - a.rank[i];
      }
      return a.index - b.index;
    });
    return ranked.map(item => item.row);
  }
  Object.assign(globalThis.BanditFormations, { sortInventoryRows });
})();
