(() => {
  "use strict";
  function sortInventoryRows(rows, save, wp, roleId, suffixValue) {
    const { craftRoles } = globalThis.BanditFormations;
    const role = craftRoles.find(role => role.id === roleId);
    if (!role) return [...rows];
    const ranked = rows.map((row, index) => {
      const recipe = save.getAt(row, 1, 7), tier = save.getAt(row, 3, 7);
      const item = { recipe, tier, slot: wp.getAt(recipe, 6), quality: save.getAt(row, 5, 7),
        level: save.getAt(row, 6, 7), mainRoll: save.getAt(row, 8, 7),
        bonuses: Array.from({ length: 6 }, (_, i) => save.getAt(row, 9 + i, 7)),
        rolls: Array.from({ length: 6 }, (_, i) => save.getAt(row, 15 + i, 7)) };
      // Set pieces can retain a lower-realm recipe ID after upgrading. Sort by
      // their equipment family/stat and actual realm, not a craftable recipe ID.
      const compatible = item.slot >= 1 && item.slot <= 4 && item.quality >= 1 && item.quality <= 6 &&
        wp.getAt(recipe, 5) === "装备" && ["普通", "套装"].includes(wp.getAt(recipe, 4)) &&
        wp.getAt(recipe, 10) === role.stat && (item.slot === 1 ? wp.getAt(recipe, 9) === role.power :
          wp.getAt(recipe, 23) === (role.combat ? "战斗" : "生产"));
      // Every preferred combat weapon belongs ahead of other weapon families,
      // even without a combat suffix. Work sorting still requires useful rolls.
      const matched = compatible && (role.combat || item.bonuses.includes(role.bonus) || item.bonuses.includes(51));
      // Damage-only work pieces are useful to inspect, but do not meet the
      // automation's keeper rule. Within a realm, keep them behind matches.
      const damageOnly = compatible && !role.combat && item.bonuses.includes(52);
      const group = matched ? 2 : damageOnly ? 1 : 0;
      const value = bonus => item.bonuses.reduce((sum, id, i) => {
        if (id !== bonus) return sum;
        const amount = suffixValue(item, id, item.rolls[i]);
        if (!Number.isFinite(amount)) throw new Error("An item's suffix value could not be compared.");
        return sum + amount;
      }, 0);
      // Realm orders useful gear for this role, not unrelated combat/work gear.
      const rank = group ? [1, tier, group, item.quality,
        ...(!role.combat ? [2 * Number(item.bonuses.includes(51)) + Number(item.bonuses.includes(role.bonus)),
          value(51), value(role.bonus), value(52)] : [value(role.bonus), item.mainRoll]),
        item.level] : [0, tier];
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
