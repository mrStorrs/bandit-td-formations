# Bandit TD Formations

A formation and combat hotkey mod for Bandit Simulator TD (Steam app 4267800).

- **Hold a top-row number key (`1`–`4`) for one second:** save all currently
  placed characters' positions, job modes, and priority work targets into that
  slot, including workers.
- **Tap and release the same key:** restore each character's saved tile and job,
  including their priority work target when its tile still exists.
- **Press `C`:** remember all placed characters' modes and switch them to combat.
  **Press `C` again:** restore each character's previous mode, including their
  work target when it still exists on the same map. Character positions stay put.
- **Ink Forest loop is ON by default. Press `F6` to toggle it:** use formation 1
  while waiting, switch to formation 2 when Summon is ready, summon the spirit
  beast, then return to formation 1 after a win and repeat.
- A message confirms saving or restoring. An empty slot leaves characters alone.
- Formations persist locally across restarts and are separate for each campaign
  save identifier and current map. They are not included in Steam Cloud saves.

Recall happens on release so holding a key to save never recalls the old
formation first. The number pad keeps its existing controls. Hotkeys are ignored
while typing, using modifier keys, dragging characters, in menus, or during the
Soul Tower movement lock. Losing focus cancels a pending key press.

`C` replaces the game's character-menu shortcut; that menu is still available
by mouse. Holding `C` only toggles once. Characters already in combat return to
combat on undo; workers return to their individual jobs. The undo is stored
locally per campaign and survives map changes and restarts. When restoring on a
different map, modes return but old map work-target coordinates are cleared.
New recruits are left alone on undo; missing, replaced, or renamed characters
are skipped. Manual mode changes made between the two presses are replaced by
the remembered modes.

Characters recruited since saving stay where they are. Missing, replaced, or
renamed characters are skipped; hold the slot again to include the changed
roster. If a destination has become unavailable or is occupied by a character
who is not moving, the restore stops before moving anyone. Swapping occupied
character tiles is supported. Positions and jobs are restored using the game's
own movement and mode functions. Saved work targets are applied after movement
clears them. Jobs also restore for characters already on their saved tiles.

**Formations saved before version 1.3.0 still restore positions.** Arrange the
characters, set their desired jobs and work targets, then hold each slot again
to include jobs. Recalling a formation does not replace the separate `C` undo;
the next `C` undo still restores the modes remembered when combat was enabled.

## Ink Forest loop

Save formation **1** as your waiting arrangement and formation **2** as your
summon-fighting arrangement **on Ink Forest**. The loop starts automatically
when both are available. It moves characters before calling the game's normal
summon function and waits for the game's actual victory event before returning
to formation 1. It restores the jobs and work targets saved in each formation
too, so formation 1 can prioritize work and formation 2 can prioritize combat.
Resave both slots to include jobs if they were saved before version 1.3.0.

The loop only runs on Ink Forest. It pauses while the game is paused, battle is
off, a menu or map transition is open, or characters are being dragged. Returning
to Ink Forest resumes it if enabled. A status message in the bottom-left corner
shows what it is doing. `F6` switches it off or on without changing positions;
the choice lasts until the game closes, and each launch defaults to **ON**.
Turn it off while rearranging formations if needed.

The game's own auto-summon is temporarily suspended while the loop controls the
fight, so it cannot summon before formation 2 is applied. Its saved setting is
left intact, and its normal operation resumes when the loop stops or you leave
Ink Forest. An already-running summon uses formation 2 without summoning again.

Both formations must include all currently placed characters. Missing presets,
changed character identities, or blocked destinations pause the loop and show
the reason. Saving formation 1 or 2 retries automatically; `F6` off/on also
retries. A timed-out or cancelled summon returns to formation 1 and pauses the
loop until you retry.

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
The startup message includes the installed version number (currently 1.3.0).

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

Supported Steam builds are **25948794** and **25975458**, inspected on
2026-10-14 and 2026-10-15 respectively. The installer matches the complete set
of relevant file hashes to a supported build and refuses unknown builds,
mixed versions, or conflicting modifications. Support for a new build requires
checking its movement and save APIs, not merely updating the hashes.
The summon, victory, threat threshold, and native auto-summon event groups were
also checked on both supported builds for the Ink Forest loop.

Steam updates and “Verify integrity of game files” can replace `package.nw`
and remove the mod. If `C` opens the character menu again, or the startup
message is missing, run `python3 manage.py status`. For a supported build,
run `python3 manage.py install` again, then fully exit and relaunch the game.
An unsupported build needs a compatibility update first. Saved formations and
combat undo live outside `package.nw` and survive its replacement.

Automated verification covers hold timing, four slots, repeat and focus handling,
save/map changes, invalid presets, missing characters, occupancy cycles, building
slots, combat/undo with mixed jobs, work targets, native shortcut interception,
formation job restoration with and without movement, older position-only
presets, invalid job data, storage failures, the runtime adapter, and
install/reinstall/uninstall. Ink
Forest tests cover default-on behavior, F6, repeated summon/victory cycles,
native auto-summon coordination, invalid presets, map changes during storage
reads, pause/menu guards, roster changes, and failed challenges.

In an isolated VM, a headless browser running a copied game/save also verified
startup and `C` switching ten characters with mixed modes to combat and back,
without moving them or opening the native character menu. This used browser
export mode and does not replace testing gameplay in Steam/NW.js. The formation
hotkeys have been manually confirmed working in Steam. The new combat toggle
still needs that manual check.

The copied build 25975458 also completed three Ink Forest summon cycles with ten
characters, using the game's summon, damage, and victory functions. It verified
formation 2 was applied before every summon, formation 1 returned after each
win, native auto-summon preferences were preserved, F6 stopped/resumed the loop,
and a failed challenge paused it. Ink Forest still needs a manual Steam check.

Version 1.3.0 was also checked in the copied game with ten characters and two
priority work targets assigned through the game's own work-target function.
Recalling formations restored jobs with and without movement, including after
the game's delayed AI refresh. Three summon/victory cycles restored both the
waiting work targets and fighting combat modes, with jobs applied before summon.
This job-saving update still needs a manual Steam/NW.js check.

To check the controls in-game:

1. Arrange your characters, choose their jobs and priority work targets, then
   hold `1` until “Formation 1 saved” appears.
2. Change their positions and jobs, then hold `2` until “Formation 2 saved” appears.
3. Tap `1`, then `2`, checking each character returns to their saved tile, job,
   and work target. Also try changing only jobs while keeping positions the same.
4. Try slots `3` and `4`, then restart and check the saved formations still work.
5. Give characters different modes (such as mining, automatic, and combat).
   Press `C` once: all should show combat without moving. Press it again: each
   should return to their previous mode and eligible work target.
6. On Ink Forest, save the waiting arrangement in slot 1 and the fighting
   arrangement with combat jobs in slot 2. With battle running, check that the
   loop waits and works in 1, moves to 2 with combat jobs before summoning, and
   returns to 1 with its saved jobs after victory. Let it repeat.
7. Press `F6` to stop the loop, then again to resume. Leave Ink Forest and check
   that it does not move characters or summon on the other map.

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
`src/combat.js` handles persistent combat undo and character matching.
`src/forest.js` handles the Ink Forest cycle and formation validation.
`src/runtime.js` adapts character/tile APIs, native movement/mode/summon functions,
the victory callback, and the native auto-summon event group.
`src/dom.js` handles keyboard focus and confirmation messages. The installer
appends these scripts to the game's existing runtime and DOM bundles. Presets
use Construct's `runtime.storage` under the `cjs-formations:v1:` namespace.
New snapshots use data format version 2 with positions, modes, and priority
coordinates; the namespace stays unchanged so version 1 position saves remain
available until replaced by holding the slot again.
Combat undo uses the separate `cjs-formations:combat:v1:` namespace.

References: [Construct runtime scripting](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/iruntime),
[Array scripting](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/plugin-interfaces/array).
