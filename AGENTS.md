# Mod development

## Structure

- Construct game in NW.js: `src/dom.js` runs on the DOM side; `src/runtime.js`
  wires gameplay modules in the worker. Communicate through component messages.
- Keep selection/ranking logic separate from native adapters (`*-runtime.js`).
  Reuse existing matchers and fixtures; see [README.md](README.md#development).
- `manage.py` appends source to `scripts/main.js` and `scripts/c3runtime.js` in
  `package.nw`. Register new modules in its source list before their consumers.
  Keep build hashes/checksum protections; verify native hooks after game updates.

## Workflow

Run from `mod/`; Node 18+ and Python 3.10+, no dependency install needed:

```sh
node --test tests/<affected>.test.js
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
python3 manage.py status
```

- For code releases, synchronize versions in `package.json`, `manage.py` and
  `src/runtime.js`; install with `python3 manage.py install`. A restart loads it.
- Test game integration in `ai-test-01` using a copied save and native NW.js
  **with its worker enabled**. Existing probes are in `.local/` (untracked).
  Do not manipulate the live desktop/save. Linux tests do not prove Steam/Proton UI behavior.

## Proven pitfalls

- Inspect native event sheets before guessing field indices or formulas.
  `save.getAt(row, field, layer)` uses reusable row IDs; validate identity before mutations.
- Prefer native actions, preserve locks/records, and verify transfers. Native equip
  calls can yield: respect `装备穿戴中`. Flush pending instances after recreation.
- Event-local variables are **not** `runtime.globalVars`; duplicate names exist.
  Resolve the correct variable by SID, and restore temporary values after calls.
- Menus are rebuilt: bind actions to validated campaign/map/station identity,
  not a transient menu UID. Keep automation settings independent per station.
- Overlays must contain `pointerrawupdate` as well as pointer/mouse/key events.
  The role picker uses an in-page menu after repeated native-select display issues.
- Upgraded set gear can retain an older recipe ID: use the item's saved realm.
  Rarity, realm and rolled suffixes are separate; innate bonuses are not suffix matches.
