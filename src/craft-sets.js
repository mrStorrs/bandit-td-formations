(() => {
  "use strict";
  const craftRoles = [
    ["forge", "Forger", 1, 43, 59], ["research", "Researcher", 3, 47, 63],
    ["logging", "Logger", 1, 40, 56], ["mining", "Miner", 2, 41, 57],
    ["planting", "Planter", 3, 42, 58], ["crafting", "Crafter", 2, 44, 60],
    ["alchemy", "Alchemist", 3, 45, 61], ["building", "Builder", 1, 46, 62],
    ["training", "Trainer", 2, 48, 64],
    ["combat-str", "Combat — STR", 1, 40, 19], ["combat-agi", "Combat — AGI", 2, 48, 20],
    ["combat-int", "Combat — INT", 3, 47, 21],
  ].map(([id, name, stat, power, bonus]) => ({ id, name, stat, power, bonus, combat: id.startsWith("combat-") }));
  const craftDefaults = { mode: "repeat", loop: "all", roles: craftRoles.map(r => r.id), tier: 1, minimum: 3, multiplier: 1, autoSell: true };
  function validateCraftOptions(value) {
    if (!value || !["repeat", "sets"].includes(value.mode) ||
        !["all", ...craftRoles.map(r => r.id)].includes(value.loop) ||
        !Array.isArray(value.roles) || value.roles.length > craftRoles.length ||
        new Set(value.roles).size !== value.roles.length || value.roles.some(id => !craftRoles.some(r => r.id === id)) ||
        !Number.isInteger(value.tier) || value.tier < 1 || value.tier > 9 ||
        !Number.isInteger(value.minimum) || value.minimum < 1 || value.minimum > 6 ||
        ![1, 10, 100].includes(value.multiplier) || typeof value.autoSell !== "boolean") {
      throw new Error("Invalid crafting settings.");
    }
    return { mode: value.mode, loop: value.loop, roles: [...value.roles], tier: value.tier,
      minimum: value.minimum, multiplier: value.multiplier, autoSell: value.autoSell };
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
  function matchesCraftItem(item, target, options) {
    return item.slot >= 1 && item.slot <= 4 && item.recipe === target.recipes[item.slot - 1] &&
      item.tier === options.tier && item.quality >= options.minimum && item.quality <= 6 &&
      item.bonuses.includes(target.bonus);
  }
  function planCraftSets(items, targets, options) {
    const counts = targets.map(() => [0, 0, 0, 0]);
    const eligible = items.map(item => ({ item, roles: targets.map((t, i) => matchesCraftItem(item, t, options) ? i : -1).filter(i => i >= 0) }))
      .filter(entry => entry.roles.length).sort((a, b) => a.roles.length - b.roles.length);
    // Assign each physical item once. Reserve specialized rolls before flexible
    // ones, then fill the least-stocked role with priority order breaking ties.
    for (const { item, roles } of eligible) {
      const slot = item.slot - 1;
      const role = roles.reduce((best, i) => counts[i][slot] < counts[best][slot] ? i : best);
      counts[role][slot]++;
    }
    const cycles = [[4, "Forge", [0, 1]], [5, "Crafting", [2, 3]]].map(([kind, name, slots]) => {
      const round = targets.length ? Math.min(...counts.flatMap(row => slots.map(slot => row[slot]))) + 1 : 1;
      const index = counts.findIndex(row => slots.some(slot => row[slot] < round));
      return { kind, name, slots, round, index, target: targets[index] || null,
        complete: index < 0 ? 0 : slots.filter(slot => counts[index][slot] >= round).length };
    });
    return { counts, cycles, keep: eligible.map(entry => entry.item) };
  }
  Object.assign(globalThis.BanditFormations, { craftRoles, craftDefaults, validateCraftOptions, selectedCraftRoles,
    craftRecipes, craftTargets, matchesCraftItem, planCraftSets });
})();
