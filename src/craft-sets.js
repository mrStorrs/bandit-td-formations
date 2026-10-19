(() => {
  "use strict";
  const craftRoles = [
    ["forge", "Forger", 1, 43, 59], ["research", "Researcher", 3, 47, 63],
    ["logging", "Logger", 1, 40, 56], ["mining", "Miner", 2, 41, 57],
    ["planting", "Planter", 3, 42, 58], ["crafting", "Crafter", 2, 44, 60],
    ["alchemy", "Alchemist", 3, 45, 61], ["building", "Builder", 1, 46, 62],
    ["training", "Trainer", 2, 48, 64],
    ["combat-str", "Combat — STR", 1, 43, 19], ["combat-agi", "Combat — AGI", 2, 44, 20],
    ["combat-int", "Combat — INT", 3, 47, 21],
  ].map(([id, name, stat, power, bonus]) => ({ id, name, stat, power, bonus, combat: id.startsWith("combat-") }));
  const craftDefaults = { mode: "repeat", loop: "all", roles: craftRoles.map(r => r.id), tier: 1, minimum: 3, multiplier: 1, autoSell: true, keepLimit: null, forgeOutput: "all" };
  function validateCraftOptions(value) {
    if (!value || !["repeat", "sets"].includes(value.mode) ||
        !["all", ...craftRoles.map(r => r.id)].includes(value.loop) ||
        !Array.isArray(value.roles) || value.roles.length > craftRoles.length ||
        new Set(value.roles).size !== value.roles.length || value.roles.some(id => !craftRoles.some(r => r.id === id)) ||
        !Number.isInteger(value.tier) || value.tier < 1 || value.tier > 9 ||
        !Number.isInteger(value.minimum) || value.minimum < 1 || value.minimum > 6 ||
        ![1, 10, 100].includes(value.multiplier) || typeof value.autoSell !== "boolean" ||
        (value.keepLimit != null && (!Number.isSafeInteger(value.keepLimit) || value.keepLimit < 0 || value.keepLimit > 999)) ||
        (value.forgeOutput !== undefined && !["all", "weapons", "hands"].includes(value.forgeOutput))) {
      throw new Error("Invalid crafting settings.");
    }
    return { mode: value.mode, loop: value.loop, roles: [...value.roles], tier: value.tier,
      minimum: value.minimum, multiplier: value.multiplier, autoSell: value.autoSell, keepLimit: value.keepLimit ?? null, forgeOutput: value.forgeOutput ?? "all" };
  }
  const selectedCraftRoles = options => craftRoles.filter(role => options.loop === "all" ? options.roles.includes(role.id) : options.loop === role.id);
  function craftRecipes(wp, role, tier) {
    return [1, 2, 3, 4].map(slot => {
      for (let id = 1; id < wp.width; id++) {
        if (wp.getAt(id, 5) !== "装备" || wp.getAt(id, 4) !== "普通" || wp.getAt(id, 3) !== tier ||
            wp.getAt(id, 6) !== slot || wp.getAt(id, 10) !== role.stat) continue;
        if (slot === 1 ? wp.getAt(id, 9) === role.power : wp.getAt(id, 23) === (role.combat ? "战斗" : "生产")) return id;
      }
      return 0;
    });
  }
  function craftTargets(wp, options) {
    return selectedCraftRoles(options).map(role => ({ ...role, recipes: craftRecipes(wp, role, options.tier) }));
  }
  const eligibleCraftItem = (item, options) => item.slot >= 1 && item.slot <= 4 &&
    item.tier === options.tier && item.quality >= options.minimum && item.quality <= 6;
  function matchesCraftItem(item, target, options) {
    return eligibleCraftItem(item, options) && item.recipe === target.recipes[item.slot - 1] && item.bonuses.includes(target.bonus);
  }
  function matchingCraftRoles(item, wp) {
    if (item.slot < 1 || item.slot > 4 || wp.getAt(item.recipe, 5) !== "装备" || wp.getAt(item.recipe, 4) !== "普通" ||
        wp.getAt(item.recipe, 3) !== item.tier || wp.getAt(item.recipe, 6) !== item.slot) return [];
    return craftRoles.filter(role => {
      if (wp.getAt(item.recipe, 10) !== role.stat || !item.bonuses.includes(role.bonus)) return false;
      if (item.slot !== 1) return wp.getAt(item.recipe, 23) === (role.combat ? "战斗" : "生产");
      return role.combat ? wp.getAt(item.recipe, 8) === role.stat + 3 : wp.getAt(item.recipe, 9) === role.power;
    });
  }
  const isCraftKeeper = (item, wp, options) => eligibleCraftItem(item, options) && matchingCraftRoles(item, wp).length > 0;
  function craftSaleGroups(item, wp) {
    const bonuses = matchingCraftRoles(item, wp).map(role => role.bonus);
    return bonuses.length ? [...new Set(bonuses)] : ["other:" + [...new Set(item.bonuses.filter(n => n > 0))].sort((a, b) => a - b).join(",")];
  }
  function planCraftSurplus(inventory, incoming, limit, wp) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid equipment keep limit.");
    const pool = inventory.filter(item => item.recipe === incoming.recipe && item.tier === incoming.tier);
    if (pool.some(item => ![item.quality, item.level, item.mainRoll, ...item.bonuses, ...item.rolls].every(Number.isFinite))) {
      throw new Error("Equipment stats could not be compared. No items were sold.");
    }
    const groups = new Map(), keep = new Set(), touched = craftSaleGroups(incoming, wp);
    for (const item of pool) for (const group of craftSaleGroups(item, wp)) {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
    const bonus = (item, group) => item.bonuses.reduce((sum, id, i) => sum +
      ((typeof group === "string" || id === group) ? item.rolls[i] : 0), 0);
    for (const [group, items] of groups) {
      const protectedItems = items.filter(item => item.protected);
      for (const item of protectedItems) keep.add(item);
      const ranked = items.filter(item => !item.protected).sort((a, b) => b.quality - a.quality ||
        bonus(b, group) - bonus(a, group) || b.mainRoll - a.mainRoll || b.level - a.level ||
        Number(a === incoming) - Number(b === incoming) || a.location - b.location || a.row - b.row);
      for (const item of ranked.slice(0, Math.max(0, limit - protectedItems.length))) keep.add(item);
    }
    // A multi-bonus piece survives if any one of its groups still needs it.
    return pool.filter(item => !keep.has(item) && !item.protected && craftSaleGroups(item, wp).some(group => touched.includes(group)));
  }
  function planCraftSets(items, targets, options, cursor = 0) {
    const counts = targets.map(() => [0, 0, 0, 0]);
    const eligible = items.map(item => ({ item, roles: targets.map((t, i) => matchesCraftItem(item, t, options) ? i : -1).filter(i => i >= 0) }))
      .filter(entry => entry.roles.length).sort((a, b) => a.roles.length - b.roles.length);
    // Normal sets assign each physical item once. Reserve specialized rolls
    // before flexible ones, then fill the least-stocked role, breaking ties by role order.
    for (const { item, roles } of eligible) {
      const slot = item.slot - 1;
      if (options.keepLimit == null) {
        const role = roles.reduce((best, i) => counts[i][slot] < counts[best][slot] ? i : best);
        counts[role][slot]++;
      } else {
        // Sell limits track each bonus group, so a multi-bonus piece serves both.
        for (const role of roles) counts[role][slot]++;
      }
    }
    const cycles = [[4, "Forge", options.forgeOutput === "weapons" ? [0] : options.forgeOutput === "hands" ? [1] : [0, 1]], [5, "Crafting", [2, 3]]].map(([kind, name, slots]) => {
      const round = targets.length ? Math.min(...counts.flatMap(row => slots.map(slot => row[slot]))) + 1 : 1;
      const choices = counts.flatMap((row, index) => slots.map(slot => ({ index, slot, stock: row[slot] })));
      let choice, position;
      // Stock wins first; start ties after the previous completed batch.
      // Sell-all cannot build stock, so it keeps cycling every selected recipe.
      for (let offset = 0; offset < choices.length; offset++) {
        const i = (cursor + offset) % choices.length, candidate = choices[i];
        if (!choice || options.keepLimit !== 0 && candidate.stock < choice.stock) { choice = candidate; position = i; }
      }
      const index = choice?.index ?? -1;
      return { kind, name, slots, round, index, target: targets[index] || null,
        slot: choice?.slot, stock: choice?.stock, nextCursor: choice ? (position + 1) % choices.length : undefined,
        complete: index < 0 ? 0 : slots.filter(slot => counts[index][slot] >= round).length };
    });
    return { counts, cycles };
  }
  Object.assign(globalThis.BanditFormations, { craftRoles, craftDefaults, validateCraftOptions, selectedCraftRoles,
    craftRecipes, craftTargets, matchesCraftItem, isCraftKeeper, craftSaleGroups, planCraftSurplus, planCraftSets });
})();
