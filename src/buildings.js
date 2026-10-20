(() => {
  "use strict";
  const { tileKey } = globalThis.BanditFormations;

  function footprint({ x, y, size }) {
    if (![1, 2, 3].includes(size)) throw new Error("This building footprint is unsupported.");
    const cells = [], start = size === 3 ? -1 : 0;
    for (let dx = start; dx < start + size; dx++) {
      for (let dy = start; dy < start + size; dy++) cells.push({ x: x + dx, y: y + dy });
    }
    return cells;
  }

  function snapshotBuildings(current) {
    const buildings = current.buildings.filter(b => b.movable).map(({ id, type, x, y }) => ({ id, type, x, y }));
    if (!buildings.length) throw new Error("No completed, movable buildings to save here.");
    const saved = { version: 2, saveId: current.saveId, buildings };
    planBuildings(saved, current);
    return saved;
  }

  function validateBuildings(saved, saveId) {
    if (!saved || saved.version !== 2 || saved.saveId !== saveId ||
        !Array.isArray(saved.buildings) || !saved.buildings.length || saved.buildings.length > 2500) {
      throw new Error("This building formation does not match the current save.");
    }
    const ids = new Set();
    for (const entry of saved.buildings) {
      if (!entry || ![entry.id, entry.type, entry.x, entry.y].every(n => Number.isSafeInteger(n) && n > 0) || ids.has(entry.id)) {
        throw new Error("Invalid building formation. Hold Shift + the number to replace it.");
      }
      ids.add(entry.id);
    }
  }

  async function loadLegacyBuildings(storage, current, slot) {
    const prefix = `cjs-formations:buildings:v1:${current.saveId}:`;
    const upgrade = (saved, mapId) => {
      if (saved?.version !== 1 || saved.saveId !== current.saveId || saved.mapId !== mapId) {
        throw new Error("This old building formation does not match its save and map.");
      }
      const data = { version: 2, saveId: saved.saveId, buildings: saved.buildings };
      validateBuildings(data, current.saveId);
      return data;
    };
    const local = await storage.getItem(`${prefix}${current.mapId}:${slot}`);
    if (local != null) return upgrade(local, current.mapId);

    let chosen, signature;
    for (const key of await storage.keys()) {
      if (!key.startsWith(prefix)) continue;
      const parts = key.slice(prefix.length).split(":");
      const mapId = Number(parts[0]);
      if (parts.length !== 2 || !Number.isSafeInteger(mapId) || mapId < 1 || parts[1] !== String(slot)) continue;
      const saved = await storage.getItem(key);
      if (saved == null) continue;
      const data = upgrade(saved, mapId);
      const contents = JSON.stringify([...data.buildings].sort((a, b) => a.id - b.id).map(b => [b.id, b.type, b.x, b.y]));
      if (chosen && signature !== contents) {
        throw new Error(`Building slot ${slot} has different old layouts on other maps. Visit the preferred map and tap Shift + ${slot}, or hold Shift + ${slot} here to save a new shared layout.`);
      }
      chosen = data; signature = contents;
    }
    return chosen;
  }

  function planBuildings(saved, current) {
    validateBuildings(saved, current.saveId);
    const buildings = new Map(current.buildings.map(b => [b.id, b]));
    const tiles = new Map(current.tiles.map(t => [tileKey(t), t]));
    let occupied = new Map(current.tiles.filter(t => t.building).map(t => [tileKey(t), t.building]));
    const destinations = new Set(), pending = new Map(), moves = [], steps = [];
    const clearTerrain = cell => {
      const tile = tiles.get(tileKey(cell));
      return tile?.allowed && !tile.character && !tile.facility && !(tile.occupied && !tile.building);
    };
    let skipped = 0;
    for (const entry of saved.buildings) {
      const from = buildings.get(entry.id);
      if (!from || from.type !== entry.type) { skipped++; continue; }
      const target = { ...entry, size: from.size };
      for (const cell of footprint(target)) {
        const key = tileKey(cell);
        if (destinations.has(key)) throw new Error("Saved buildings overlap. No buildings moved.");
        destinations.add(key);
      }
      if (tileKey(from) === tileKey(entry)) continue;
      if (!from.movable || from.occupant ||
          footprint(from).some(c => tiles.get(tileKey(c))?.character || occupied.get(tileKey(c)) !== from.id) ||
          footprint(target).some(c => !clearTerrain(c))) {
        skipped++; continue;
      }
      pending.set(target.id, { ...target, from });
    }

    function dependencies(target) {
      const group = new Map([[target.id, target]]);
      for (const move of group.values()) for (const cell of footprint(move)) {
        const id = occupied.get(tileKey(cell));
        if (!id || group.has(id)) continue;
        // Skipped and stationary buildings remain obstacles to other moves.
        if (!pending.has(id)) return null;
        group.set(id, pending.get(id));
      }
      return group;
    }
    function tryGroup(group) {
      const trial = new Map(occupied), remaining = new Map(group), parked = new Set(), commands = [];
      const positions = new Map([...group].map(([id, move]) => [id, move.from]));
      const canPlace = target => footprint(target).every(c => clearTerrain(c) &&
        (!trial.has(tileKey(c)) || trial.get(tileKey(c)) === target.id));
      const moveTo = target => {
        const from = positions.get(target.id);
        for (const cell of footprint(from)) trial.delete(tileKey(cell));
        for (const cell of footprint(target)) trial.set(tileKey(cell), target.id);
        commands.push({ id: target.id, type: target.type, x: target.x, y: target.y, from: { x: from.x, y: from.y } });
        positions.set(target.id, target);
      };
      while (remaining.size) {
        let progressed = false;
        for (const [id, target] of remaining) {
          if (!canPlace(target)) continue;
          moveTo(target); remaining.delete(id); progressed = true;
        }
        if (progressed) continue;
        let buffer;
        for (const target of remaining.values()) {
          if (parked.has(target.id)) continue;
          for (const tile of current.tiles) {
            const candidate = { ...target, x: tile.x, y: tile.y };
            if (footprint(candidate).every(c => !destinations.has(tileKey(c)) && !trial.has(tileKey(c))) && canPlace(candidate)) {
              buffer = candidate; break;
            }
          }
          if (buffer) break;
        }
        // Discard the entire trial so an impossible swap never strands a
        // building at a temporary position.
        if (!buffer) return null;
        moveTo(buffer); parked.add(buffer.id);
      }
      return { occupied: trial, steps: commands };
    }
    while (pending.size) {
      let progressed = false;
      for (const target of pending.values()) {
        const group = dependencies(target);
        if (!group) { pending.delete(target.id); skipped++; progressed = true; continue; }
        const plan = tryGroup(group);
        if (!plan) continue;
        occupied = plan.occupied; steps.push(...plan.steps);
        for (const move of group.values()) { pending.delete(move.id); moves.push(move); }
        progressed = true;
      }
      // Another successful move may open a buffer for a previously stuck swap.
      if (!progressed) break;
    }
    return { moves, steps, skipped: skipped + pending.size };
  }

  const buildingFormation = {
    storageKey: (current, slot) => `cjs-formations:buildings:v2:${current.saveId}:${slot}`,
    loadLegacy: loadLegacyBuildings, snapshot: snapshotBuildings, planRestore: planBuildings,
    savedMessage: (slot, data) => `Building formation ${slot} saved (${data.buildings.length} buildings, shared across maps).`,
    emptyMessage: slot => `Building slot ${slot} is empty. Hold Shift + ${slot} for 1 second to save.`,
    restoredMessage: (slot, data, plan) => `Building formation ${slot} ${plan.skipped ? "partially restored" : "restored"} (${plan.moves.length} moved${plan.skipped ? `, ${plan.skipped} not moved` : ""}).`,
  };
  Object.assign(globalThis.BanditFormations, { footprint, snapshotBuildings, planBuildings, buildingFormation });
})();
