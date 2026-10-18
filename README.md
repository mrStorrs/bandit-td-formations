# Bandit TD Formations

A character/building formation, job outfit, combat, recruitment, and crafting mod for Bandit Simulator TD (Steam app 4267800).

- **Hold a top-row number key (`1`–`4`) for one second:** save all currently
  placed characters' positions, job modes, and priority work targets into that
  slot, including workers.
- **Tap and release the same key:** restore each character's saved tile and job,
  including their priority work target when its tile still exists.
- **Hold `Shift` + `1`–`4` for one second:** save a building layout in a separate
  slot. **Tap `Shift` + the number:** restore that building layout.
- **Press `C`:** remember all placed characters' modes and switch them to combat.
  **Press `C` again:** restore each character's previous mode, including their
  work target when it still exists on the same map. Character positions stay put.
- **Beast realm loop is ON by default. Press `F6` to toggle it:** use formation 1
  while waiting, switch to formation 2 when Summon is ready, summon the spirit
  beast, then return to formation 1 after a win and repeat.
- **Auto recruit panel on the recruitment screen:** choose a minimum work grade,
  optional STR/AGI/INT thresholds, a minimum copper reserve, and a recruitment
  method, then start rolling. Stop and lock recruits when **any** selected target
  matches, or stop before another roll would spend below the reserve.
- **Automatic repeat crafting:** forging, crafting, and alchemy stations remember
  their last started recipe and material multiplier. Each empty station queues
  another batch of **10**, waiting for materials when necessary.
- **Auto-all gear sets:** open **Crafting** at the lower right to cycle checked
  work/combat roles or loop one role. Choose tier and minimum rarity, lock
  matching pieces, optionally sell new rejected crafts, and keep making more sets.
- **Job outfits:** select a character, choose their job priority, equip their
  gear, and click **Save outfit for [job]**. Choosing that job again restores
  that character's saved outfit. Jobs without an outfit keep current equipment.
- A message confirms saving or restoring. An empty slot leaves characters alone.
- Formations persist locally across restarts and are separate for each campaign
  save identifier and current map. They are not included in Steam Cloud saves.

Recall happens on release so holding a key to save never recalls the old
formation first. The number pad keeps its existing controls. Hotkeys are ignored
while typing, using Ctrl/Alt/Meta, dragging characters, in menus, or during the
Soul Tower movement lock. Losing focus cancels a pending key press.
Shift is reserved for the building formation shortcuts; it does not toggle `C`
or `F6`. Releasing Shift before the number still recalls the building slot.

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

## Job outfits

Each character can save a separate outfit for each job priority: combat,
logging, mining, planting, forging, crafting, alchemy, building, research,
training, and automatic. Select the character to show the **Job outfits** panel
at the lower left; it also appears on their equipment, details, and core screens.

1. Choose the character's job priority using the normal game controls.
2. Equip the pieces you want through the normal equipment screen.
3. Click **Save outfit for [job]**. Repeat for other jobs and characters.

Changing to a job with a saved outfit equips that outfit. Changing to a job
without one leaves every equipped slot alone. Saving again replaces only the
selected character's outfit for the selected job; ordinary equipment changes do
not overwrite saved outfits. **Forget** removes that job's outfit without
changing equipment. **Auto-equip saved job outfits** enables or disables swaps
for the campaign and remembers the setting across restarts; it starts enabled.
Saving and forgetting remain available while auto-equip is disabled.

Outfits include all six equipment slots, including the equipped core and
treasure. An empty slot in a saved outfit is restored as empty, subject to
inventory space. Absorbed cores are not equipment slots and are not changed.
The same outfit can reference a piece used by another job on that character.
Items must be in inventory or already equipped on the character: the mod never
takes gear from another character. Missing, ineligible, or indistinguishable
duplicate pieces leave that slot's current gear in place and show a notice.

The mod matches the original item marker, type, quality, and rolled properties
across the game's inventory transfers. Upgrades and item-lock changes preserve
the match. Resave after rerolling/replacing equipment or renaming the character.
Keep unused outfit pieces in your inventory; saving an outfit does not reserve
items against selling, crafting, or equipping them on someone else.

Manual job selection, priority work targets, formation recalls, and the combat
toggle all use the same outfit rules. The beast loop waits for the game's
equipment transfers to finish before summoning, then restores the waiting jobs
and their outfits after victory. Swaps follow the assigned priority; momentary
AI activity changes under **Automatic** do not switch between work outfits.

Outfits persist locally per campaign and character across maps and game
restarts. They are separate from formation slots and are not in Steam Cloud.

## Building formations

Arrange your buildings, then hold **Shift + 1** until “Building formation 1
saved” appears. Arrange another layout and hold **Shift + 2**. Tap those same
combinations to switch layouts. Slots 3 and 4 work the same way. Building slots
persist separately from character slots, for each campaign and current map.

Snapshots include completed, unlocked buildings with the game's Move command.
Restores use native relocation and retain current building levels, upgrades,
and contents. Buildings are matched by their game slot and type; missing or
different types are skipped, and newly added buildings stay where they are.
Resave after demolishing/rebuilding, since the game can reuse a slot for the
same building type.

The entire move sequence is checked first. A character, facility, newer
building, unavailable tile, or building under construction can block a restore.
Move characters out of buildings and clear the saved destinations before
retrying. Swaps use an empty building-sized area temporarily; if there is no
room, the restore stops before moving anything. The native 1×1, 2×2, and 3×3
building footprints are supported.

Facility plots such as crops and workstations stay in place, following normal
building relocation behavior. The game recalculates their range from the moved
building. Character positions and jobs use their own formation shortcuts.
The beast realm loop waits while a building shortcut is held or being restored.

## Beast realm loop

Save formation **1** as your waiting arrangement and formation **2** as your
summon-fighting arrangement **on each beast map**. The loop starts automatically
when both are available. It moves characters before calling the game's normal
summon function and waits for the game's actual victory event before returning
to formation 1. It restores the jobs and work targets saved in each formation
too, so formation 1 can prioritize work and formation 2 can prioritize combat.
Resave both slots to include jobs if they were saved before version 1.3.0.

The loop runs on every beast map, including Ink Forest and later realms. It uses
the game's native beast-map category, the current map's readiness and summon,
and formations saved specifically for that map. Save slots 1 and 2 separately
on each map; existing Ink Forest formations keep working.

It pauses while the game is paused, battle is off, a menu or map transition is
open, or characters are being dragged. Returning to a beast map resumes it if
enabled. A status message in the bottom-left corner shows what it is doing.
`F6` switches it off or on without changing positions;
the choice lasts until the game closes, and each launch defaults to **ON**.
Turn it off while rearranging formations if needed.

The game's own auto-summon is temporarily suspended while the loop controls the
fight, so it cannot summon before formation 2 is applied. Its saved setting is
left intact, and its normal operation resumes when the loop stops or you leave
the beast map. An already-running summon uses formation 2 without summoning again.

Both formations must include all currently placed characters. Missing presets,
changed character identities, or blocked destinations pause the loop and show
the reason. Saving formation 1 or 2 retries automatically; `F6` off/on also
retries. A timed-out or cancelled summon returns to formation 1 and pauses the
loop until you retry.

## Auto recruit

Open the game's recruitment screen. The **Auto recruit** panel appears in the
bottom-right corner. Select a **Minimum grade** (`E`, `D`, `C`, `B`, `A`, `S`, or
`SS`) and/or enter **STR over**, **AGI over**, and **INT over** thresholds.
Choose an unlocked recruitment **Method**, then click **Start rolling**.
The method selector shows the normal copper cost for each roll. Paid refreshes
must already be unlocked in the game; the mod keeps the game's costs, odds,
recruitment tiers, and pity system.

If the panel does not respond to clicks in windowed mode, use fullscreen. This
workaround has been confirmed in the Steam game; the windowed input issue is
still unresolved.

The target means **that grade or better in any of the nine work categories**:
logging, mining, planting, forging, crafting, alchemy, building, research, or
training. For example, a target of `A` accepts a recruit with `A`, `S`, or `SS`
in any one category. It checks work aptitude grades, rather than character
rarity or the current work skill level. Higher targets may need higher
recruitment tiers; selecting a target does not improve the game's roll odds.

All enabled targets use **OR**. For example, grade `B` with STR, AGI, and INT
each set to `20` accepts a recruit with **any B-or-better work grade OR STR > 20
OR AGI > 20 OR INT > 20**. Each stat can have its own threshold. Stats use the
values displayed on the recruitment card, including bonuses; decimal thresholds
are supported. A stat equal to the threshold does not match.

Leave a stat field blank to ignore it. Set **Minimum grade** to **Off** to search
only for stats. At least one target must be enabled before rolling can start.
Existing grade settings are preserved; the new stat fields start blank.

Set **Minimum copper** to the amount you want to keep. Before each paid refresh,
the search checks the current balance and that method's cost, and stops if the
roll would leave less than your minimum. A roll that leaves exactly the minimum
is allowed. For example, with a `10,000` minimum and `3,000` copper rolls, it
stops at `12,000` instead of spending down to `9,000`. If your balance is already
below the minimum, it does not pay for a roll.

Blank or `0` means no reserve, which is the default for existing settings.
The minimum is remembered across restarts. Click **Stop** to edit it while a
search is running, then **Start rolling** to use the new amount. A budget stop
leaves previous matching recruits locked; lowering the minimum or earning more
copper lets Start skip those results on the next paid roll. Existing matches
and matches on the last allowed roll are still checked and locked.

The search checks existing unlocked candidates before spending, then rolls at
most twice per second. On a match, it immediately stops, locks every matching
candidate with the game's normal padlock, and reports their matching grades/stats.
**Hire the recruits yourself when ready, or click Start rolling again to skip
the matches and keep searching.** The next search unlocks those same results
immediately before its first paid roll, then stops and locks the next matches.
Changing the targets or method before restarting uses the new settings.

Recruits locked manually before a search are kept and ignored by the filters.
The mod remembers its own matches for the current game session, checking their
full recruit data so a different recruit in the same slot is not unlocked.
After a game restart, existing locks are treated as manual locks; unlock any
you no longer want. Matching locks survive timed refreshes and are stored in the
normal game save. Stop, insufficient funds, or an interruption before the next
paid roll leaves the previous matches locked for a later retry.

Click **Stop** at any time. The search also stops when copper runs out, the next
roll would cross the minimum copper limit, all three slots are locked, the
recruitment screen closes, the campaign/map changes, another game action blocks
recruitment, or the game loses focus. It never starts automatically. Grade, stat,
method, and minimum copper preferences are remembered locally across game
restarts. The panel reports rolls and copper spent for the current search.

During a search, the game's timed recruitment refresh, built-in auto-recruit,
and native recruit/refresh/lock clicks are temporarily suspended. Their previous
states return when the search ends; saved auto-recruit settings stay unchanged.
This keeps native auto-recruit from purchasing a candidate before the filters
can inspect it. A match is locked before these systems resume.

Talent filters are not included yet. The matching code accepts typed criteria
combined with OR, so more targets can be added without rewriting the rolling controls.

## Repeat crafting

Start a recipe at a forging, crafting, or alchemy station normally. When that
station finishes its entire queue, the mod queues **10 more crafts** of the same
recipe with the same material multiplier. Each station repeats independently;
one busy station does not hold up the others. Existing active queues are learned
automatically when the mod loads. An empty station with no remembered recipe
stays idle until you start something there.

**Repeat current ×10** is the default mode in the lower-right **Crafting** panel.
It uses the game's material
costs and requires enough materials for all 10 crafts. If supplies are short, it
waits and checks again about once per second. It never adds to an unfinished
queue or grants completed items directly; workers still do the crafting normally.

Use the station's normal **Cancel** action to stop its repeat. Start another
recipe to enable it again and replace the remembered choice. Moving a station
keeps its remembered recipe; demolishing it clears that choice. Repeat waits
while the game is paused, menus or transitions are open, or the station is
unavailable. Full inventory keeps the native queue unfinished and prevents a
new batch.

Soul Tower's character-movement lock does not pause repeat crafting: forging,
crafting, and brewing stations continue refilling during an active challenge.

Recipes and multipliers persist locally per campaign and facility slot across
map changes and game restarts. They are not part of Steam Cloud. Recipes that
finished before this feature was installed cannot be recovered: start a batch
once at those empty stations to teach the mod what to repeat.

## Auto-all gear sets

Open **Crafting** at the lower right and select **Auto-all sets**. Choose a tier
(T1–T9), minimum rarity (the game's six color grades), and the native material
multiplier (×1, ×10 or ×100). Click **Apply / Start**. The dropdown offers:

- **Cycle checked roles:** use the checked jobs, prioritizing Forger, Researcher,
  then Logger, Miner, Planter, Crafter, Alchemist, Builder, Trainer and the three
  combat roles, skipping unchecked entries.
- **A single job or combat role:** repeatedly make that role's sets. This
  overrides the checkboxes without clearing their selections.

Each target contains four ordinary craftable pieces. Work sets use the job's
weapon, gloves, belt and necklace; combat sets use a weapon, bracers, headband
and ring. Cores, treasures and special set upgrades are outside this loop.

| Role | Gear stat | Required rolled bonus |
| --- | --- | --- |
| Forger | STR | Forge Bonus |
| Researcher | INT | Tech Bonus |
| Logger | STR | Chop Bonus |
| Miner | AGI | Mine Bonus |
| Planter | INT | Farm Bonus |
| Crafter | AGI | Craft Bonus |
| Alchemist | INT | Brew Bonus |
| Builder | STR | Build Bonus |
| Trainer | AGI | Drill Bonus |
| Combat—STR | STR | Phys Bonus |
| Combat—AGI | AGI | Pierce Bonus |
| Combat—INT | INT | Spell Bonus |

The combat roles use the tier's ordinary axe, sword and fan respectively.
Every piece must be the correct recipe/stat variant, exactly the chosen tier,
at least the minimum rarity, and have at least one roll of that role's bonus.
General Work Bonus does not satisfy a specific job bonus. Quality and rolls
still come from the game; selecting a minimum does not guarantee that rarity.

Forging and crafting stations cooperate on the current role's missing pieces,
queuing **one craft at a time per station** and paying native material costs.
Once all selected roles have a complete set, the next round requires another
copy of every piece. Existing inventory and worn gear count, and any physical
piece counts only once even if it has several useful bonuses. Extra matches
are retained for later rounds. Progress is recomputed from gear you still own;
selling a keeper or changing its rolls makes that piece missing again.

Qualifying equipment is automatically locked, including existing matches.
Each result is checked against all currently selected roles, so a useful roll
for a later job is kept. **Auto-sell non-matching crafts** starts checked and
can be disabled while running. It sells only newly completed Auto-all crafts
that fail every selected target, using the native equipment sale function.
Unchecking it keeps rejects unlocked. Existing items, locked items, equipped
gear, unrelated loot and brewing outputs are never swept for sale.

For owned Auto-all queues, this decision takes priority over the game's native
quality-based automatic sale. The native sale preferences are preserved.
Queues already present when loading or changing maps are not claimed for mod
selling: their matching results are protected while Auto-all is active, and
their rejects follow the game's existing native sale preferences.

**Pause sets** stops new orders and mod sales while paid queues finish. Pause
before changing roles, tier, rarity or multiplier, then click **Apply / Start**.
Manual equipment recipe changes or cancellations also pause the set loop.
Switching back to **Repeat current ×10** restores normal repeat behavior.
Brewing stations continue their existing repeat-10 behavior in either mode;
the Alchemist target crafts equipment for that worker.

The loop waits for materials, unlocked recipes, usable stations and inventory
space, and while gameplay is paused or menus/transitions are open. It also
waits for outfit swaps before counting or locking existing equipment. Settings
and the running/paused choice persist per campaign across maps and restarts,
locally rather than through Steam Cloud. The panel can be collapsed while it runs.

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
The startup message includes the installed version number (currently 1.8.2).

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
Recruitment generation, work grading, paid refreshes, costs, locks, readiness,
and auto-recruit event groups were inspected on both builds for version 1.4.0.
Building relocation, object creation, and facility-range event groups were
compared on both builds for version 1.5.0 and are unchanged.
Crafting queue allocation, recipe costs, facility linkage, cancellation and
completion were inspected on both builds for version 1.8.0. Native item quality,
completion rewards, and auto-sale behavior remain under the game's control.

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
install/reinstall/uninstall. Beast realm tests cover default-on behavior, F6,
repeated summon/victory cycles,
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

Version 1.4.0 passes 75 JavaScript tests and four installer tests. Recruitment
tests cover grade thresholds, all nine categories, future filter composition,
existing matches, immediate stopping, locks, costs, interruptions, invalid data,
native event-group restoration, panel controls, and preference storage.
In the copied build 25975458, a real paid roll found and locked a work-grade
match before another roll. It verified normal costs, suppression of native
auto-recruit, survival of locks through a subsequent native refresh, insufficient
funds, manual Stop, and screen closure. A separate three-roll run spent exactly
9,000 copper, stopped at zero, and preserved an existing locked candidate.
Recruitment controls have since been manually confirmed working in fullscreen;
windowed clicks remain an open issue.

Version 1.5.0 passes 94 JavaScript tests and four installer tests. Building tests
cover footprint bounds, swaps and cycles, empty buffer space, blocked sites,
missing buildings, separate slots, Shift release order, menu guards, pending
native object updates, and map changes during storage reads. In the copied game,
eleven buildings with all three footprint sizes were saved into two layouts and
restored through the keyboard shortcuts. The check verified positions, levels,
tile occupancy, no duplicate building objects, and refusal before any moves
when a character blocked a destination. After reloading the game copy, the saved
layout still restored and skipped two missing buildings. Building formations
still need a manual Steam/NW.js check.

Version 1.6.0 passes 103 JavaScript tests and four installer tests. Recruitment
tests cover OR matching, independent stat thresholds, exact boundaries, bonuses,
decimal values, disabled targets, invalid inputs, preference storage, and locks
before another roll. The recruitment card's STR/AGI/INT calculations were checked
against both supported game builds. In copied build 25975458, mouse/keyboard
checks confirmed separate stat-only and grade-only matches, bonus-inclusive
displayed values, invalid-input handling, and thresholds persisting after reload.
A native paid roll spent exactly 3,000 copper, locked all its STR matches, and
stopped before another roll. This update still needs a manual Steam/NW.js check.

Version 1.6.1 passes 113 JavaScript tests and four installer tests. Restart tests
cover skipping previous matches, all three slots matching, manual locks,
cancelled/unaffordable retries, replacement identities, and failed refreshes.
In copied build 25975458, four successive native paid rolls each replaced the
declined matches and stopped on the next matches. The check preserved a manually
locked recruit, verified 12,000 total copper spent, retried after insufficient
funds, and resumed after closing/reopening recruitment. This update still needs
a manual Steam/NW.js check.

Version 1.7.0 passes 123 JavaScript tests and four installer tests. Minimum-copper
tests cover exact boundaries, changing balances and costs, invalid settings,
saved preferences, matches on the last allowed roll, and preserving declined
locks when a retry exceeds the budget. The native adapter rechecks the balance
and cost immediately before unlocking previous results or paying.
In copied build 25975458, mouse/keyboard checks verified stopping above the
reserve, allowing an exact-boundary roll, rejecting negative input, clearing the
reserve, and preserving the setting after reload. Five native paid rolls also
verified matches at the limit, manual locks, and retrying declined matches after
lowering the minimum. This update still needs a manual Steam/NW.js check.

Version 1.8.0 passes 138 JavaScript tests and four installer tests. Crafting tests
cover independent stations, full batches, material shortages and shared supplies,
recipe changes, multipliers, cancellation, relocation, demolition, campaign
isolation, pending storage reads, native menu updates, and failed queue/payment
rollback. In copied build 25975458, forging, crafting, and alchemy each completed
native work and queued 10 more with exact material charges. A repeated batch
completed all 10 crafts, waited for supplies, and resumed after restocking.
Cancellation, changed recipes, multiplier preservation, selection preservation,
and persistence after reloading the copied save also passed. This update still
needs a manual Steam/NW.js check.

Version 1.8.1 fixes repeat crafting being incorrectly blocked during Soul Tower
challenges. It passes 139 JavaScript tests and four installer tests. In the
isolated game copy, the reported save reproduced all three stations staying
empty in version 1.8.0 after a native Soul Tower challenge started. With the fix,
forging, crafting, and brewing each refilled twice with 10 crafts, paid normal
material costs, and left the challenge active. Character movement restrictions
remain unchanged. This fix still needs a manual Steam/NW.js check.

Version 1.8.2 extends the summon loop from Ink Forest to every native beast map.
It passes 148 JavaScript tests and four installer tests, including each map's
readiness, summon argument, victory tracking, saved jobs, and formation storage.
Map changes and saving during a pending formation read are also covered. The
native map category and summon/victory hooks were checked on both supported
builds. In copied build 25975458, all nine beast maps completed two native
summon/victory cycles each with ten characters. Each summoned its own boss only
after formation 2 was applied and returned to formation 1 with its saved jobs.
F6 stop/resume, unchanged native auto-summon preferences, and pausing after a
failed challenge passed on every map. This needs a manual Steam/NW.js check.

Version 1.9.0 adds outfits per character and job, with explicit Save/Forget
controls and a persistent auto-equip toggle. It passes 163 JavaScript tests and
four installer tests. Coverage includes multiple work jobs, unknown-job no-ops,
all six slots and saved empty slots, item conservation, upgrades and locks,
missing/ambiguous items, character/campaign isolation, persistence, inventory
capacity, equip restrictions, storage failures, asynchronous transfers, and
cancellation during map changes. Combat undo and summoning wait for gear changes.
The native equipment and job hooks match across both supported builds.

In isolated build 25975458, repeated six-slot swaps across three work jobs kept
every item, and outfits survived a browser reload onto a different beast map.
Save/Forget accepted real pointer clicks, and the panel remained available on
equipment, character details, and core screens. Two native summon/victory cycles
equipped the complete combat outfit before spawning the boss and restored work
gear after victory. All nine beast maps also passed two summon/victory cycles
each, F6 stop/resume, and the failed-challenge guard. This update still needs a
manual Steam/NW.js check.

Version 1.10.0 adds repeated gear sets for selected work/combat roles, the
single-role dropdown, native stat/bonus matching, keeper locks and optional
sales limited to newly completed Auto-all crafts. It passes 192 JavaScript
tests and four installer tests. Automated checks cover role
ordering, additional rounds, per-piece counting, pending station reservations,
native sale interception, existing inventory protection, persisted settings,
manual overrides, shortages, stale UI and failures. All 432 role/tier/slot
recipes were checked against the installed game's legal bonus pools. Native
completion and sale paths were inspected on both supported builds.

In isolated build 25975458, controlled native rolls completed two rounds of
Forger, Researcher and Combat—AGI, a T2 Combat—INT set using ×10 materials, and
one round of all twelve roles followed by the start of round two. Native sales,
lock protection against the game's automatic filter, live sale disabling,
unchanged existing inventory, pause and persisted choices passed. Reloaded
queues protected keepers, and real pointer/keyboard interaction exercised the
panel and single-role dropdown. Another 16 native crafts used unmodified
quality/affix RNG and correctly kept/locked matches or sold rejects. This
update still needs a manual Steam/NW.js check.

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
6. On each beast map, save the waiting arrangement in slot 1 and the fighting
   arrangement with combat jobs in slot 2. With battle running, check that the
   loop waits and works in 1, moves to 2 with combat jobs before summoning, and
   returns to 1 with its saved jobs after victory. Let it repeat.
7. Press `F6` to stop the loop, then again to resume. Switch to another beast
   map and check that it uses that map's saved slots. Leave for a non-beast map
   and check that the loop stops moving characters and summoning.
8. Open recruitment, choose a target grade and affordable method in **Auto
   recruit**, then start. Check that a matching work grade stops rolling and
   locks the candidate. Click **Start rolling** again to skip that result and
   find the next match. Check that manual locks are kept and Stop still works.
9. Hold `Shift + 1` to save the building layout. Move buildings normally and
   hold `Shift + 2`, then tap each combination to restore it. Check levels and
   occupied tiles, including a swap with an empty buffer area available.
   Restart and recall again to check persistence. Keep character slots 1/2
   separate and verify blocked destinations stop the whole building restore.
10. In recruitment, select grade `B` and set the stat thresholds you want.
    Check that either a B-or-better work grade or any stat above its threshold
    stops rolling and locks the recruit. Try grade **Off** with only one stat
    enabled, then restart and check that the settings are remembered.
11. Set **Minimum copper** and start rolling. Check that the search stops before
    another roll would leave less than that amount. Lower the minimum and click
    Start again to continue; clear it or use `0` to remove the reserve. Restart
    and check that the minimum is remembered without starting a search.
12. Start recipes at several crafting stations with different material multipliers.
    Let each queue finish and check it adds exactly 10 of its own recipe, paying
    normal costs. Try insufficient materials, then replenish them. Cancel one
    station and confirm it stays stopped; start a new recipe to resume. Restart
    the game and check that remembered recipes still repeat.
13. Open **Crafting**, choose **Auto-all sets**, check the desired work/combat
    roles and choose tier/rarity, then **Apply / Start**. Confirm correct stat
    variants and rolled bonuses, locked keepers and another round after all
    selected sets finish. Disable auto-sell while running and verify rejects
    remain. Pause, select one role in **Loop**, then start and verify only that
    role repeats. Restart to check settings and paused/running persistence.

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
`src/buildings.js` validates building layouts and plans relocation order and
temporary swap positions. `src/building-runtime.js` adapts native building
relocation and flushes pending object creation/destruction between moves.
`src/combat.js` handles persistent combat undo and character matching.
`src/forest.js` handles the beast realm cycle and formation validation.
`src/recruit.js` handles candidate matching and the recruitment search loop.
`src/recruit-runtime.js` reads recruitment data and adapts native paid refreshes,
locks, and event groups.
`src/crafting.js` observes native queue creation and cancellation, remembers
station recipes, and refills empty queues through the native crafting functions.
`src/craft-sets.js` selects role recipes, matches gear and counts separate sets.
`src/craft-sets-runtime.js` schedules one-piece queues, identifies their native
completion results, locks keepers and handles settings and native sales.
`src/outfits.js` validates outfit snapshots and matches equipment records.
`src/outfit-runtime.js` observes native job changes, serializes equipment swaps,
checks inventory and equip eligibility, and manages the outfit panel and storage.
`src/runtime.js` adapts character/tile APIs, native movement/mode/summon functions,
the victory callback, and the native auto-summon event group.
`src/dom.js` handles keyboard focus, confirmation messages, and recruitment,
outfit and crafting controls. The installer appends these scripts to the game's existing runtime
and DOM bundles. Presets
use Construct's `runtime.storage` under the `cjs-formations:v1:` namespace.
New snapshots use data format version 2 with positions, modes, and priority
coordinates; the namespace stays unchanged so version 1 position saves remain
available until replaced by holding the slot again.
Combat undo uses the separate `cjs-formations:combat:v1:` namespace.
Building presets use `cjs-formations:buildings:v1:<saveId>:<mapId>:<slot>` and
store building slots, types, and coordinates, without overwriting upgrades.
Recruitment preferences use DOM local storage at
`cjs-formations:recruit-options:v1`; the running state is never persisted.
The `minimumMoney` option is a nonnegative copper reserve (default `0`), separate
from the matching criteria. It applies to every paid roll regardless of targets.
Crafting memory uses `cjs-formations:crafting:v1:<saveId>` in runtime storage.
Each entry contains a facility slot, facility type, parent building slot, recipe,
and material multiplier. Queue progress and materials remain in the game save.
Set crafting uses `cjs-formations:craft-sets:v1:<saveId>` with validated options
and an enabled flag. Queue ownership for selling is session-only; it is never
inferred from inventory changes or persisted queue numbers. Completion hooks
protect qualifying inherited crafts without claiming them for mod sales.
Job outfits use `cjs-formations:outfits:v1:<saveId>` in runtime storage, with an
enabled flag and per-character/per-job snapshots of six equipment identities.
Native equip/unequip calls are asynchronous across game frames; formation
recalls, combat undo, and the beast loop await their completion and recheck the
current map and jobs before continuing. Outfits do not write item records
directly or add identifiers to the player's items.

Recruitment rules have the shape `[{ type: "work-grade", minimum: 5 }]` (`A` and
better). `compileRecruitCriteria` validates and snapshots the rules. Each entry
in `recruitCriteria` supplies `validate(rule)` and `match(candidate, rule)`;
matching returns an array of reasons or `null`. A candidate qualifies when
**any** enabled criterion matches; the work-grade criterion accepts **any**
category. Stat rules use `{ type: "stat", stat: "str", above: 20 }` (also `agi`
and `int`). To add talent filters, extend the candidate data in the runtime
adapter, add a criterion handler, and expose its settings in the panel. Unknown
criteria or unreadable enabled targets stop the search before another roll.

References: [Construct runtime scripting](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/iruntime),
[Array scripting](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/plugin-interfaces/array).
