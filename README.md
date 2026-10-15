# Bandit TD Formations

A formation hotkey mod for Bandit Simulator TD (Steam app 4267800).

- **Hold a top-row number key (`1`–`4`) for one second:** save all currently
  placed characters, including workers, into that slot.
- **Tap and release the same key:** restore each character to their saved tile.
- A message confirms saving or restoring. An empty slot leaves characters alone.
- Formations persist locally across restarts and are separate for each campaign
  save identifier and current map. They are not included in Steam Cloud saves.

Recall happens on release so holding a key to save never recalls the old
formation first. The number pad keeps its existing controls. Hotkeys are ignored
while typing, using modifier keys, dragging characters, in menus, or during the
Soul Tower movement lock. Losing focus cancels a pending key press.

Characters recruited since saving stay where they are. Missing, replaced, or
renamed characters are skipped; hold the slot again to include the changed
roster. If a destination has become unavailable or is occupied by a character
who is not moving, the restore stops before moving anyone. Swapping occupied
character tiles is supported. Positions are restored using the game's own
movement function, including its normal work-target updates.

## Install

Requires Python 3.10 or later. No Python packages, mod loader, or Node installation
are needed to install the mod.

Download or clone this repository, then run from its directory:

```sh
python3 manage.py install
```

The installer detects the usual Steam location on Linux or Windows. For another
library location, specify the directory containing `game.exe` and `package.nw`:

```sh
python3 manage.py install --game-dir "/path/to/Steam/steamapps/common/塔防山贼模拟器"
```

On Windows, use `py -3` in place of `python3` if appropriate. Restart the game
after installing. Look for the “Formations ready” message on startup.

The installer backs up the input archive in `cjs-formations-backups/` beside the
game, verifies the result, then replaces `package.nw` atomically. It does not
edit player save files. Installing while the game is open takes effect on the
next launch; the installer does not close or restart the game.

```sh
python3 manage.py status
python3 manage.py uninstall
```

Uninstall removes only the mod's verified script blocks and manifest. It leaves
saved formations in the game's local storage so reinstalling can use them.

## Compatibility and verification

The currently supported package is Steam build **25948794**, inspected on
2026-10-14. The installer checks hashes of the relevant game files and refuses
unknown builds or conflicting modifications. Game updates may remove the mod;
check compatibility before reinstalling. Support for a new build requires
checking its movement and save APIs, not merely updating the hashes.

Automated verification covers hold timing, four slots, repeat and focus handling,
save/map changes, invalid presets, missing characters, occupancy cycles, building
slots, the runtime adapter, and install/reinstall/uninstall. The mod's startup
handshake was also verified against the copied game runtime in a headless browser
inside an isolated VM. That smoke test used browser export mode and does not
replace testing gameplay in Steam/NW.js. Manual gameplay verification is pending.

To check the controls in-game:

1. Arrange your characters and hold `1` until “Formation 1 saved” appears.
2. Rearrange them and hold `2` until “Formation 2 saved” appears.
3. Tap `1`, then `2`, checking each character returns to their own saved tile.
4. Try slots `3` and `4`, then restart and check the saved formations still work.

## Development

The repository contains only original mod code and tooling, not the game,
extracted game scripts, assets, or player saves. Local inspection material belongs
in the ignored `.local/` directory.

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Node 18+ runs the JavaScript tests; no npm dependencies are required. To build a
patched archive separately without modifying the installation:

```sh
python3 manage.py build --package /path/to/package.nw --output /path/to/new-package.nw
```

`src/formations.js` handles snapshots, validation, and tap/hold timing.
`src/runtime.js` adapts the game's character/tile APIs and native movement function.
`src/dom.js` handles keyboard focus and confirmation messages. The installer
appends these scripts to the game's existing runtime and DOM bundles. Presets
use Construct's `runtime.storage` under the `cjs-formations:v1:` namespace.

References: [Construct runtime scripting](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/iruntime),
[Array scripting](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/plugin-interfaces/array).
