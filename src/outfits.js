(() => {
  "use strict";
  const outfitJobs = ["自动", "战斗", "伐木", "采矿", "种植", "锻造", "工艺", "炼丹", "建造", "研究", "操练"];
  function outfitFingerprint(record) {
    if (!Array.isArray(record) || record.length !== 50 || !Number.isSafeInteger(record[1]) || record[1] <= 0 ||
        record.some(value => !Number.isFinite(value))) throw new Error("Invalid equipment record.");
    // Transfers copy the original item number and rolls. Level, owner, lock and
    // new-item markers may change without changing which piece this is.
    return JSON.stringify(record.map((value, field) => [6, 7, 22, 24].includes(field) ? 0 : value));
  }
  function validateOutfit(outfit) {
    if (!outfit || !Number.isSafeInteger(outfit.id) || outfit.id <= 0 ||
        typeof outfit.identity !== "string" || outfit.identity.length > 1000 ||
        !outfitJobs.includes(outfit.job) || !Array.isArray(outfit.slots) || outfit.slots.length !== 6) {
      throw new Error("Invalid saved job outfit.");
    }
    for (const key of outfit.slots) {
      if (key === null) continue;
      if (typeof key !== "string" || key.length > 5000 || outfitFingerprint(JSON.parse(key)) !== key) {
        throw new Error("Invalid saved equipment identity.");
      }
    }
    return outfit;
  }
  function planOutfit(outfit, equipped, inventory) {
    validateOutfit(outfit);
    const changes = [], missing = [];
    for (let index = 0; index < 6; index++) {
      const key = outfit.slots[index], from = equipped[index], slot = index + 1;
      if ((from?.key ?? null) === key) continue;
      if (key === null) { changes.push({ slot, from, to: null }); continue; }
      const matches = inventory.filter(item => item.slot === slot && item.key === key);
      if (matches.length !== 1) { missing.push(slot); continue; }
      changes.push({ slot, from, to: matches[0] });
    }
    // Fill empty slots first to make room for saved empty slots restored later.
    changes.sort((a, b) => (Number(!!a.from) - Number(!!a.to)) - (Number(!!b.from) - Number(!!b.to)));
    return { changes, missing };
  }
  Object.assign(globalThis.BanditFormations, { outfitJobs, outfitFingerprint, validateOutfit, planOutfit });
})();
