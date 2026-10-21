(() => {
  "use strict";
  const pillTypes = ["力量丹", "敏捷丹", "智力丹"];
  function brewingTargets(save, wp, cl) {
    if (!cl || !Number.isSafeInteger(cl.width) || cl.width <= 0) throw new Error("Pill stock is unavailable.");
    const groups = new Map();
    for (let recipe = 1; recipe < wp.width; recipe++) {
      const realm = wp.getAt(recipe, 3), type = wp.getAt(recipe, 7), stat = pillTypes.indexOf(type);
      if (wp.getAt(recipe, 5) !== "丹药" || wp.getAt(recipe, 4) !== "普通丹药" || stat < 0 ||
          !Number.isInteger(realm) || realm < 1 || realm > 9 || save.getAt(recipe, 19, 0) !== 1) continue;
      const key = `${realm}:${type}`;
      if (!groups.has(key)) groups.set(key, { recipe, realm, stat, name: ["STR", "AGI", "INT"][stat], stock: 0 });
    }
    // Pills live in material stacks, not equipment rows. Every rarity contributes
    // one pill to its type/realm total; paid queues are not finished inventory.
    for (let material = 1; material < cl.width; material++) {
      if (cl.getAt(material, 5) !== "丹药") continue;
      const group = groups.get(`${cl.getAt(material, 2)}:${cl.getAt(material, 3)}`);
      if (!group) continue;
      const count = save.getAt(material, 6, 0);
      if (!Number.isFinite(count) || count < 0) throw new Error("Pill stock could not be counted.");
      group.stock += count;
      if (!Number.isFinite(group.stock)) throw new Error("Pill stock could not be counted.");
    }
    return [...groups.values()].sort((a, b) => a.stock - b.stock || a.realm - b.realm || a.stat - b.stat);
  }
  Object.assign(globalThis.BanditFormations, { brewingTargets });
})();
