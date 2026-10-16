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
    const saved = { version: 1, saveId: current.saveId, mapId: current.mapId, buildings };
    planBuildings(saved, current);
    return saved;
  }

  function planBuildings(saved, current) {
    if (!saved || saved.version !== 1 || saved.saveId !== current.saveId || saved.mapId !== current.mapId ||
        !Array.isArray(saved.buildings) || !saved.buildings.length || saved.buildings.length > 2500) {
      throw new Error("This building formation does not match the current save and map.");
    }
    const buildings = new Map(current.buildings.map(b => [b.id, b]));
    const tiles = new Map(current.tiles.map(t => [tileKey(t), t]));
    const occupied = new Map(current.tiles.filter(t => t.building).map(t => [tileKey(t), t.building]));
    const ids = new Set(), destinations = new Set(), moves = [];
    let skipped = 0;
    for (const entry of saved.buildings) {
      if (!entry || ![entry.id, entry.type, entry.x, entry.y].every(n => Number.isSafeInteger(n) && n > 0) || ids.has(entry.id)) {
        throw new Error("Invalid building formation. Hold Shift + the number to replace it.");
      }
      ids.add(entry.id);
      const from = buildings.get(entry.id);
      if (!from || from.type !== entry.type) { skipped++; continue; }
      const target = { ...entry, size: from.size };
      for (const cell of footprint(target)) {
        const key = tileKey(cell);
        if (destinations.has(key)) throw new Error("Saved buildings overlap. No buildings moved.");
        destinations.add(key);
      }
      if (tileKey(from) === tileKey(entry)) continue;
      if (!from.movable) throw new Error("A saved building is locked or under construction. No buildings moved.");
      if (from.occupant || footprint(from).some(c => tiles.get(tileKey(c))?.character)) {
        throw new Error("Move characters out of the buildings first. No buildings moved.");
      }
      if (footprint(from).some(c => occupied.get(tileKey(c)) !== from.id)) {
        throw new Error("Building tiles are still updating. Try again in a moment.");
      }
      moves.push({ ...target, from });
    }
    const moving = new Set(moves.map(m => m.id));
    const clearTerrain = cell => {
      const tile = tiles.get(tileKey(cell));
      return tile?.allowed && !tile.character && !tile.facility && !(tile.occupied && !tile.building);
    };
    for (const move of moves) {
      if (footprint(move).some(c => !clearTerrain(c))) {
        throw new Error("A saved building site is blocked by terrain, a character, or a facility. No buildings moved.");
      }
      if (footprint(move).some(c => {
        const id = occupied.get(tileKey(c));
        return id && id !== move.id && !moving.has(id);
      })) throw new Error("Another building blocks this formation. No buildings moved.");
    }

    // Plan the entire sequence before touching the game. Native relocation
    // destroys the old sprite by coordinates, so swaps need an empty buffer.
    const positions = new Map(moves.map(m => [m.id, { ...m.from }]));
    const pending = new Map(moves.map(m => [m.id, m])), parked = new Set(), steps = [];
    const canPlace = target => footprint(target).every(c => clearTerrain(c) &&
      (!occupied.has(tileKey(c)) || occupied.get(tileKey(c)) === target.id));
    const moveTo = target => {
      const from = positions.get(target.id);
      for (const cell of footprint(from)) occupied.delete(tileKey(cell));
      for (const cell of footprint(target)) occupied.set(tileKey(cell), target.id);
      steps.push({ id: target.id, type: target.type, x: target.x, y: target.y, from: { x: from.x, y: from.y } });
      positions.set(target.id, { ...target });
    };
    while (pending.size) {
      let progressed = false;
      for (const [id, target] of pending) {
        if (!canPlace(target)) continue;
        moveTo(target); pending.delete(id); progressed = true;
      }
      if (progressed) continue;
      let buffer;
      for (const target of pending.values()) {
        if (parked.has(target.id)) continue;
        for (const tile of current.tiles) {
          const candidate = { ...target, x: tile.x, y: tile.y };
          if (footprint(candidate).every(c => !destinations.has(tileKey(c)) && !occupied.has(tileKey(c))) && canPlace(candidate)) {
            buffer = candidate; break;
          }
        }
        if (buffer) break;
      }
      if (!buffer) throw new Error("Clear an empty building-sized space for this swap. No buildings moved.");
      moveTo(buffer); parked.add(buffer.id);
    }
    return { moves, steps, skipped };
  }

  const buildingFormation = {
    prefix: "cjs-formations:buildings:v1", snapshot: snapshotBuildings, planRestore: planBuildings,
    savedMessage: (slot, data) => `Building formation ${slot} saved (${data.buildings.length} buildings).`,
    emptyMessage: slot => `Building slot ${slot} is empty. Hold Shift + ${slot} for 1 second to save.`,
    restoredMessage: (slot, data, plan) => `Building formation ${slot} restored (${plan.moves.length} moved${plan.skipped ? `, ${plan.skipped} missing or replaced` : ""}).`,
  };
  Object.assign(globalThis.BanditFormations, { footprint, snapshotBuildings, planBuildings, buildingFormation });
})();
