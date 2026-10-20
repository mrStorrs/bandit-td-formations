# Bandit TD Formations

A character/building formation, job outfit, combat, recruitment, crafting,
research and drilling mod for Bandit Simulator TD (Steam app 4267800).

- **Hold a top-row number key (`1`–`4`) for one second:** save all currently
  placed characters' positions, job modes, and priority work targets into that
  slot, including workers.
- **Tap and release the same key:** restore each character's saved tile and job,
  including their priority work target when its tile still exists.
- **Hold `Shift` + `1`–`4` for one second:** save a building layout in a separate
  slot shared across maps. **Tap `Shift` + the number:** restore that building layout.
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
- **Crafting controls per station:** select a forge, crafting station or brewery
  to open its automation popup. Each station saves its own mode and pause state.
  Equipment stations prioritize the lowest-stock checked work/combat gear or loop one role, with
  their own tier, minimum rarity, material multiplier and auto-sell setting.
  They keep and lock useful gear and craft in batches of **10**.
- **Auto research and drill:** enabled by default, with controls on each selected
  station. Research prioritizes main-tab unlocks, then Research, Logging, Barracks,
  Training, Mining, Great Hall and Recruit Tech. Each tree finishes to its current
  cap. Drilling trains the
  lowest unlocked class only far enough to unlock the next job. Manual choices
  take priority and train to the normal cap.
- **Job outfits:** select a character, choose their job priority, equip their
  gear, and click **Save outfit for [job]**. Choosing that job again restores
  that character's saved outfit. Jobs without an outfit keep current equipment.
- A message confirms saving or restoring. An empty slot leaves characters alone.
- Formations persist locally across restarts and are separate for each campaign.
  Character slots are specific to each map; building slots are shared across all
  maps in that campaign. They are not included in Steam Cloud saves.

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

Items referenced by a saved outfit show a **blue outfit lock** in inventory and
character equipment screens. Hover or focus the icon to see every character
and job using that exact piece. The lock blocks native selling and all crafting
sale modes, including a station replacing its own auto-locked surplus. Protected
pieces still participate in the usual stock and keep-limit calculations.

Outfit locks remain active when auto-equip is disabled and survive job changes,
equipment level upgrades, map changes and restarts. Replacing or forgetting an
outfit releases only its references; a shared piece stays protected until its
last saved reference is removed. These locks do not change the game's ordinary
manual/automatic lock flag. Normal locks remain independent. Changing an item's
rolled properties requires saving the outfit again, as with outfit restoration.

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
persist separately from character slots and are **shared across every map in the
same campaign**. Saving a building slot on any map replaces that shared slot.
Character formations retain their separate positions and jobs for each map.

Older map-specific building saves carry over on the first recall of each slot.
The current map's old layout takes priority. If it has none, the mod imports the
layout from another map when there is only one distinct saved layout. If several
maps have different layouts for that slot, visit the preferred map and tap its
shortcut to choose it, or hold the shortcut to save a new shared layout.
Old map-specific copies are retained; once a shared slot exists, it takes priority
on every map.

Snapshots include completed, unlocked buildings with the game's Move command.
Restores use native relocation and retain current building levels, upgrades,
and contents. Buildings are matched by their game slot and type; missing or
different types are skipped, and newly added buildings stay where they are.
Resave after demolishing/rebuilding, since the game can reuse a slot for the
same building type.

The move sequence is checked first, and every feasible group of buildings is
restored. Occupied, locked or unfinished buildings and blocked destinations are
skipped. Skipped buildings stay put, so other moves needing their space are
skipped too. The message reports a partial restore with the numbers moved and
not moved. Clear those obstacles and tap the shortcut again to finish.
Swaps use an empty building-sized area temporarily. A swap that cannot finish
is skipped without leaving buildings parked elsewhere, while independent moves
continue. The native 1×1, 2×2, and 3×3 building footprints are supported.
Malformed saved layouts and unavailable native relocation functions still stop
the restore.

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

## Station crafting controls

Select a forge, crafting station or brewery on the map. Its **Automation** popup
opens at the upper right, labeled with the station type and number. Switching
stations displays that station's saved settings; closing the native station
panel hides the popup. Unapplied edits are discarded when switching stations.

Each physical station has independent settings, even two forges beside each
other. Choose **Repeat current ×10** or, for equipment stations, **Auto-all sets**.
Click **Apply / Start** to save and enable that station. **Pause** stops its new
orders and mod sales while its paid queue finishes. You can change settings and
apply them while running; new recipes start after the current queue finishes.
Closing or collapsing the popup does not stop automation.
Benches that remain usable in the game also keep refilling while their parent
building upgrades. This applies to both Repeat and Auto-all at forges, crafting
stations and breweries.

On the first update, existing global crafting settings are copied to each built
equipment station, including paused/running status. Breweries keep repeating
normally. Newly built stations default to Repeat current ×10 and wait for a
remembered recipe. Settings survive moving stations, changing maps and restarting;
demolition clears them. They are saved locally per campaign, outside Steam Cloud.

## Repeat crafting

Start a recipe at a forging, crafting, or alchemy station normally. When that
station finishes its entire queue, the mod queues **10 more crafts** of the same
recipe with the same material multiplier. Each station repeats independently;
one busy station does not hold up the others. Existing active queues are learned
automatically when the mod loads. An empty station with no remembered recipe
stays idle until you start something there.

**Repeat current ×10** is the default mode in each station's popup.
It uses the game's material costs and requires enough
materials for all 10 crafts. If supplies are short, it
waits and checks again about once per second. It never adds to an unfinished
queue or grants completed items directly; workers still do the crafting normally.

Use the station's normal **Cancel** action to stop its repeat. Start another
recipe to replace the remembered choice. If you also pressed **Pause** in the
popup, use **Apply repeat ×10** to resume. Moving a station
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

## Realm 2 recipe costs

Every realm 2 (T2) recipe ingredient that normally costs **17,000 of a realm 1
resource** now costs **1,000 of its realm 2 equivalent**. Forge weapons,
bracers and gloves replace stone with iron ore. Crafting headgear, belts and
accessories, and STR/AGI/INT brewing pills, replace herbs with roots. The rule
checks the native ingredient and price, including matching special recipes;
it also handles realm 1 wood if a recipe requires it. Existing realm 2
ingredients and recipes from other realms keep their normal costs.

Recipe screens, manual purchases, Repeat and Auto-all all use the adjusted
cost. Material multipliers still apply: a ten-piece batch at ×1 uses 10,000
of each adjusted ingredient; at ×10 it uses 100,000.

Canceling a batch refunds the materials paid for its remaining pieces,
including after saving and reloading. Unmarked older queues retain their
original stone/herb refunds, and queues from the earlier roots update still
refund roots. The paid-cost marker travels with the queue in the game save.

## Gatherer focus

Loggers, miners and planters automatically choose the resource with the fewest
remaining harvests within their normal work range. They keep working on it
until it is depleted, then choose the next weakest available resource. Workers
with the same job and reachable resources choose the same target, including
when two resources have equal remaining harvests.

New or returning workers join an existing reachable target for their job.
They finish that shared target before switching to a newly available plot.
If previously separate groups gain overlapping ranges, they converge on the
earliest active target they can reach. Workers unable to reach that target
continue on a local resource; the mod does not extend work range.

This is always enabled and also applies while an Automatic worker is gathering.
Each worker keeps their assigned profession and position. Moving a worker,
changing their job or losing access to the resource triggers a new selection.
Regrowing plots become eligible when ready; infinite battlefield resources
continue using the game's targeting. Saved work-priority coordinates are kept,
but active gathering uses the automatic focus choice.

## Auto-all gear sets

Select an equipment station and choose **Auto-all sets** in its popup. Choose a
tier (T1–T9), minimum rarity (the game's six color grades), and native material
multiplier (×1, ×10 or ×100). Click **Apply / Start**. These settings apply only
to that station. The dropdown offers:

- **Checked roles · lowest stock:** before each batch, choose the item/bonus
  group with the fewest qualifying pieces among the checked jobs and combat
  roles. Equal stocks take turns, starting in the displayed role order.
- **A single job or combat role:** repeatedly make that role's sets. This
  overrides the crafting checkboxes without clearing their selections.

These selections control what gets crafted. With **Sell output: Normal**, matching
equipment for all twelve roles is kept and locked, including unchecked roles
and when looping one role.

Forges also offer a **Forge output** dropdown in Auto-all mode:

- **All:** weapons and hand gear, the default.
- **Weapon only:** skip gloves and bracers.
- **No weapon:** make only gloves or bracers for the selected work/combat roles.

Click **Apply / Start** to save the choice for that forge. Restricted loops advance
to the next role and round using only their chosen slot. Other stations keep their
own settings. Paid batches finish before the change takes effect, and useful gear
for any role is still kept and locked. Repeat current ×10 still repeats the
manually chosen recipe.

Each target contains four ordinary craftable pieces. Work sets use the job's
weapon, gloves, belt and necklace; combat sets use a weapon, bracers, headband
and ring. Cores, treasures and special set upgrades are outside this loop.

| Role | Gear stat | Job / combat bonus |
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

The combat roles craft the tier's ordinary spear, bow and fan respectively.
Every piece must be the correct recipe/stat variant, exactly the chosen tier,
and at least the minimum rarity. Work gear qualifies with a rolled **Work Crit**
(rate) suffix, the job-bonus suffix above, or both. Innate stats, including
built-in Work Crit on belts, do not qualify an item or contribute to work-gear
ranking. Combat gear still requires its matching combat bonus. General Work Bonus, Work Crit
DMG and combat crit do not substitute for Work Crit or a specific job bonus.
Quality and rolls still come from the game; selecting a minimum does not
guarantee that rarity.

Forging and crafting stations run **independent loops**, queuing **10 crafts of
the same recipe per batch** and paying the full native material cost up front.
The forge covers weapons and hand gear; crafting covers head/belt gear and
accessories. Each station compares only the pieces it can make, including its
Forge output restriction, and starts with the lowest stock. A group with zero
pieces comes before one with two, even if that earlier group is below its keep
limit. Stock is recounted after each paid batch finishes. Each loop starts its
next round without waiting for the other loop.
The selected station's popup shows its role, stock, round and progress. Each station
chooses its recipe using its own settings and queue. Stations can queue identical
recipes simultaneously, and refill without waiting for another station's batch.
For example, two forges can both make T1 Forger weapons, or one can make T3 combat
gear while the other makes work gear. Materials and completed inventory still
come from the shared campaign.

A paid batch finishes all ten attempts before that station changes recipe,
even if an early craft matches. Every result is checked individually. Each
new round in Normal mode needs another copy of that loop's pieces for every
selected role. Existing inventory and worn gear count, and any physical piece
counts only once even if it has several useful bonuses. Extra matches are
retained for later rounds. Progress is recomputed from gear you still own; selling a keeper
or changing its rolls makes that piece missing again.

In Normal mode, qualifying equipment is automatically locked, including
existing matches. Each result is checked against every job and combat role,
regardless of the checkboxes or single-role dropdown. With only Forger selected,
STR work gloves with Build Bonus are kept for Builder, but only Forger sets drive the loop.
Keepers still need that station's selected tier, minimum rarity, correct stat
and a matching role-bonus suffix or, for work gear, a Work Crit suffix. Work
weapons need the job's specific work power. Combat matches require
**STR spear + Phys Bonus**, **AGI bow + Pierce Bonus**, or **INT fan + Spell Bonus**.
These same weapon requirements apply to crafting, keeping, set progress and
sell-over groups. Axes, hammers, daggers, shovels, staves and sickles can still
qualify through their own job bonus or rolled Work Crit, but their combat
bonuses alone do not qualify them. Items already locked by an older version
keep their locks; unwanted old matches can be unlocked and sold manually.

**Auto-sell non-matching crafts** starts checked and can be disabled while
running. In Normal mode, it sells only newly completed Auto-all crafts that
qualify for no role, using the native equipment sale function. Unchecking it
keeps rejects unlocked. Existing items, locked items, equipped gear, unrelated loot and
brewing outputs are never swept for sale.

### Station output selling

Every forge and crafting station has its own **Sell output** dropdown. Changes
apply immediately to subsequent completions in either **Repeat current ×10**
or **Auto-all sets**, including the remaining crafts in an existing queue:

- **Normal** (default): retain the existing keep/lock and reject-selling rules.
- **Sell all:** sell every new piece that station completes, including matches.
  Existing gear is untouched.
- **Sell over limit:** set **Keep per item / bonus** to 1–999. Compare each new
  piece with the same item variant and tier already in your bag or equipped,
  keeping the strongest N per work/combat bonus and selling surplus duplicates.

For example, Keep 2 allows two T1 STR work gloves with Forge Bonus and two
with Build Bonus; AGI gloves, weapons, belts and other tiers have separate
counts. Unchecked jobs still get their own bonus groups. A multi-bonus piece
is retained if any of its groups needs it, so such overlaps can leave more
than N pieces showing a particular bonus. Nonmatching gear follows the
**Auto-sell non-matching crafts** checkbox; with it off, surplus comparisons
group nonmatches by their exact set of bonus types.

**Rarity ranks first** when comparing eligible duplicates: **Red (6) > Gold/orange
(5) > Purple (4) > Blue (3) > Green (2) > White (1)**. A higher-rarity piece wins
even if the lower-rarity piece has better rolled bonuses. This compares the
color grade; recipe/realm tiers still have separate limits.

Within the **same rarity**, work gear is ranked by its rolled suffixes:

1. **Work Crit + the relevant job bonus** — best.
2. **Work Crit alone**.
3. **The relevant job bonus alone**.

Within each category, compare actual **Work Crit % from suffixes**, then total
**matching job-bonus suffix rolls**. Innate stats, main stat
rolls and equipment level do not break work-gear ties. For example, a belt with
built-in Work Crit and only a Forge Bonus suffix counts as job-bonus-only gear;
it needs a rolled Work Crit suffix too to qualify for the best combination.
For a Forger, the combination needs Forge Bonus; for a Crafter, Craft Bonus;
for a Researcher, Tech Bonus, and so on. A red job-bonus-only piece beats an
orange Work Crit + job bonus piece for that job. Gear still needs a qualifying
suffix and the minimum rarity to count toward a set.
Generic Work Crit gear can serve each compatible job with the same stat and
equipment type; it survives if one of those groups still needs it. Normal
mode counts each physical piece once, preferring its specific job when stocks tie.

Combat gear keeps **rarity**, **total matching bonus roll values**, **main stat
roll**, then **equipment level** as its ranking. Exact ties keep the existing
piece in both cases. These comparisons do not change saved job outfits.

Saved-outfit items, equipped gear and pre-existing locks count toward the limit but are never
sold. That includes locks made by older mod versions. Unlock an old item if
you want it eligible for replacement. New matching crafts retained by this
mode are auto-locked and tracked by their full item identity, so this station
can replace its own weaker keepers later. Manually unlocking and relocking an
item, or upgrading it, removes that automatic replacement permission. Another
station's tracked locks remain protected. Ambiguous identities are kept.
An outfit lock always prevents replacement, even for the originating station's
tracked keeper. Its tooltip lists the outfits that must be changed or forgotten
before the piece can be sold.

Comparison is triggered by a new craft and only trims that item variant/tier
and the bonus groups it touches. It can sell weaker, unlocked duplicates
already in the bag. It does not sweep unrelated inventory when enabled.
Settings and tracked locks survive map changes and restarts. **Pause** stops
both crafting automation and automatic sales at the selected station.
Crafts completed while a setting is being saved are retained without selling.

**Sell excess now**, beside **Apply / Start**, trims existing matching equipment
on demand. Choose **Sell over limit** and set **Keep per item / bonus** first.
The button uses the station's saved tier, minimum rarity and Forge output filter:
forges cover weapons/hands and crafting stations cover belts/necklaces. Changed
filters must be applied before selling. It also works while automation is paused,
without starting automation or changing the current paid queue.

Each exact item variant has separate work/combat counts, including unchecked
roles. The sweep sells the weakest eligible extras only when **every** role
matched by that piece would still have the requested stock afterward. Eleven
Forge matches with Keep 5 normally sell six. With one STR/Forge spear and six
Forge-only spears, Keep 5 retains the shared spear plus the four best Forge-only
spears, selling the two weakest Forge-only spears. A role already below its
target never loses a match. Rolled Work Crit also counts for compatible work
roles, so it can protect an item needed by an unchecked job.

The same rarity-first ranking and lock protections apply. Equipped pieces count
toward stock; saved outfits, manual/older locks and another station's managed
locks cannot be sold. This station's tracked auto-locks can be replaced. Protected
pieces may leave stock above the limit. Unmatched items, lower-rarity items below
the saved minimum, other tiers and items outside this station's gear filter are
untouched. The popup reports how many items were sold; each sale pays the game's
normal copper price.

With Sell over limit, Auto-all fills the lowest-stock chosen recipe/bonus group
first until every group reaches the keep limit. Stock counts only gear matching
the chosen recipe, role, tier and minimum rarity, including worn gear and the
Work Crit alternatives above. Once stocked, it continues upgrade attempts with
the lowest-stock groups, rotating
ties in batches of ten, retaining improvements and selling weaker duplicates.
Sell all keeps cycling recipes by batch because its output does not build stock.
Both modes honor the forge's
All / Weapon only / No weapon choice and keep stations independent.

For owned Auto-all queues in Normal mode, the keep/reject decision takes
priority over the game's native quality-based automatic sale. The native
sale preferences are preserved. In Normal mode, queues already present when
loading or changing maps are not claimed for mod selling: their matching
results are protected while Auto-all is active, and their rejects follow the
game's existing native sale preferences.

**Pause** stops new orders and mod sales at this station while its paid queue
finishes. Manual equipment recipe changes or cancellations also pause only that
station's set loop. Changing targets preserves useful results from the old queue
and stops mod sales of its rejects. Switching back to **Repeat current ×10**
restores that station's remembered manual recipe. Breweries have their own
repeat/pause controls; the Alchemist target makes equipment for that worker.

The loop waits for materials, unlocked recipes, usable stations and inventory
space, and while gameplay is paused or menus/transitions are open. It also
waits for outfit swaps before counting or locking existing equipment. Settings
and the running/paused choice persist per station and campaign across maps and
restarts, locally rather than through Steam Cloud. The popup can be collapsed
while it runs.

## Research and drilling

Select a research or drill station to open its **Automation** popup at the upper
right, like a crafting station. It shows only that station's settings and status;
closing its native panel hides the popup. **Auto research** and **Auto drill**
start enabled, and each physical station saves its own toggle. Drill stations
also save their own end-job selections. Changes take effect immediately.
Workers still perform the work normally; automation selects the next target and pays
the game's normal copper cost. It waits when funds are insufficient.

When selecting a new tree, research follows this priority:

1. Anything unfinished and available in the main **Research** tab.
2. **Research Tech**.
3. **Logging Tech**.
4. **Barracks Tech**.
5. **Training Tech**.
6. **Mining Tech**.
7. **Great Hall Tech**.
8. **Recruit Tech**.
9. Everything else: **Team → Gather → Growth → Cultivate → Craft**, using
   the game's topic order within each category.

Locked, capped and already-assigned topics are skipped.

Each selected tree continues to its **current building cap** before the mod
chooses another tree. Native Repeat handles its levels, such as displayed
levels 1 through 60. A newly available higher-priority topic waits for the active tree
to finish, including manual choices. Native prerequisites, category unlocks and
building caps still apply. Other research stations can take different available
trees independently.

The current tree is remembered through copper shortages and restarts. If
native Repeat is off, the mod resumes the same tree until its cap. A building
upgrade extends the current tree's cap before another tree is selected.

Under **Drill toward these end jobs**, check the final jobs this station should unlock.
The 16 end jobs are grouped into **STR, AGI, INT, and Production**, using the
game's job names. All start checked on new stations. Selections are saved per
station and campaign. Uncheck every job to leave that station's automatic
drilling idle; manual training still works. Other drill stations retain their
own selections.

Drilling follows **only the checked jobs and their prerequisite paths**. Shared
prerequisites count toward every selected branch that needs them; unrelated
jobs are skipped. It chooses the **lowest unlocked class tier** that still needs
training, using the game's class order within a tier. It stops
at the native promotion requirement: **level 5 for the starting job, level 10
for later prerequisite jobs**. Jobs at the end of a branch stop at **level 1**
to unlock them. Native Repeat stops at that boundary without paying for another
level; the mod then selects the next unfinished job. Building/class caps still
apply, and a building upgrade lets an unmet unlock requirement resume.
Classes already assigned to another drill station are skipped.

Unchecking a branch cancels and refunds an active automatic order if no selected
job still needs it, once gameplay resumes. Progress is retained, and native
Repeat cannot buy another level on an unchecked path. Manual targets keep their
normal priority and training cap, even if they lead to an unchecked job.

Existing automatic orders already at or above their unlock level are canceled
with the native refund for the pending level, preserving progress. Manually
selected orders retain their full training cap.

**A manual target takes priority at that station.** Choose a research topic or
drill class with the normal controls. A valid, affordable choice replaces an
automatic order using the game's normal cancellation/refund; existing research
or drill progress is retained. The mod keeps that choice until its current cap,
including further levels when native
Repeat is off and retries after a copper shortage. Then automatic selection
resumes. Canceling an order releases the override and holds the idle station
for your next choice while its menu remains selected. Toggle automation off and
on to resume directly from the open popup. Queues already running
when first installing this feature are treated as manual choices.

Settings and current targets persist locally per station and campaign across
moving stations, map changes and restarts. Existing global toggles and end-job
choices migrate once to all existing research/drill stations, including those
on other maps. Newly built stations use the defaults. Turning **Auto research**
or **Auto drill** off stops new mod orders at that station; current research can
finish its tree and an active automatic drill stops at its unlock level.
The game's Repeat preference is preserved.
New selections wait during pause, menus, dragging and transitions, and for a
usable completed building. Other mod automation continues independently.

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
The startup message includes the installed version number (currently 1.15.1).

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
Research/drill selection, prerequisites, caps, cancellation and completion
branches were compared across both supported builds for version 1.12.0.

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

Version 1.10.0 added repeated gear sets for selected work/combat roles, the
single-role dropdown, native stat/bonus matching, keeper locks and optional
sales limited to newly completed Auto-all crafts. It passed 192 JavaScript
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

Version 1.11.0 queues ten crafts per Auto-all batch and gives forging and
crafting independent role/round progress. It passes 196 JavaScript tests and
four installer tests, including both directions of uneven station progress,
full-batch costs, per-item decisions through the tenth output, and duplicate
keepers counting toward later rounds. In isolated build 25975458, 80 native
crafts confirmed exact costs, advancing roles and rounds while the other
station stays busy, keeper protection for other selected jobs, rejected-item
sales, live sale disabling and pause without cancelling paid batches. The
Crafting panel shows separate progress for both loops. A manual Steam/NW.js
check remains useful for the live game.

Version 1.12.0 adds research and drilling automation and renames the Crafting
panel to **Automation**. It passes 225 JavaScript tests and four installer
tests. Coverage includes regular research priority, lowest-level category
ordering, drilling prerequisites and caps, manual replacement and refunds,
manual choices across restarts and copper shortages, concurrent stations,
menu/transition guards, independent toggles and storage failures. In isolated
build 25975458, 30 native research/drill level completions verified the full
category rotation, direct manual takeover, preserved native Repeat settings,
exact initial costs, manual targets continuing after reload, and automatic
resumption after their caps. Native pointer clicks also verified both
checkboxes. A manual Steam/NW.js check remains useful.

Version 1.12.1 keeps and locks matches for all twelve roles, independently of
the crafting selection. Compatible ordinary combat weapons are protected too;
the combat crafting targets are STR spears, AGI bows and INT fans. It passes
230 JavaScript tests and four installer tests, including unchecked keepers,
single-role scheduling, existing gear, inherited queues and rejection filters.
In isolated build 25975458, 52 native crafts verified lock protection against
native automatic selling, continued Forger-only progress, reloads and all three
combat weapon targets. The installed catalog also passed keeper checks for all
432 role/tier/slot targets and 81 compatible combat weapons.

Version 1.12.2 lets native Repeat finish each research tree to its current cap
before selecting the next tree in category order. Current targets survive
copper shortages, restarts and Repeat-off settings; manual choices still take
priority. It passes 233 JavaScript tests and four installer tests. In isolated
build 25975458, 143 native research completions verified displayed levels 1–60
without mod reselection, correct native repeat costs, all five categories,
manual takeover, reloads and resuming the same tree after copper shortages.

Version 1.12.3 prioritizes the Research bonus whenever selecting a new tree,
before regular unlocks and other advanced topics. Active trees and manual
choices still finish to their caps. It passes 236 JavaScript tests and four
installer tests. In isolated build 25975458, 69 native research completions
verified Research through levels 1–60, priority after a building upgrade,
manual overrides and unlocking the Research tree.

Version 1.14.0 moves crafting into a popup for each selected station. Settings,
pausing, manual overrides and selling are independent per physical station;
old global preferences migrate to existing stations once. Regression coverage
includes two forges with different targets, storage races, demolition and
relocation, stale selection messages, breweries and the separate research UI.
In isolated build 25975458, native station clicks, popup mouse/keyboard input,
different-tier queues, keeper locking, separate selling choices and reloads
passed. Controls were also exercised at 1000×700. Steam/NW.js remains the manual
check after restarting the installed game.

Version 1.14.1 adds the per-forge **All / Weapon only / No weapon** dropdown.
Tests cover old settings, slot-specific roles and rounds, per-station persistence,
paid batches and keeping useful off-target gear. In isolated build 25975458,
all three choices were exercised through the popup, including reloads and
switching back to full sets after restricted crafting.

Version 1.14.2 removes cross-station recipe reservations. Tests cover several
stations queuing identical recipes, independent refills, full material costs,
and separate pause settings. In isolated build 25975458, two native forges
queued identical batches and refilled independently for all three output
options, with one forge still busy while the other started its next batch.

Version 1.15.0 replaces the realm 2 crafting-gear herb cost with roots and adds
sticky lowest-remaining-resource targeting for gatherers. Tests cover recipe
scope and multipliers, old and new queue refunds, reloads, job/range filtering,
depletion, regrowth, ties and native AI refreshes. In isolated build 25975458,
all 12 affected recipes returned the new costs; the native recipe screen,
manual purchase/cancellation and automated batches used roots. A partially
completed batch refunded the correct remaining roots after save/load. Two
native miners finished a shared target and began harvesting the next weakest.

Version 1.15.1 limits automatic drilling to job unlock requirements, including
one level for terminal jobs. Tests cover native Repeat costs at the boundary,
manual training beyond unlock levels, building caps, copper shortages, reloads,
and refunds for older automatic orders already past the limit. In isolated
build 25975458, native drilling stopped at levels 5 and 10 without charging for
another level, manual training continued to level 20, loaded orders refunded
their pending level, and terminal jobs stopped at level 1.

Version 1.15.3 extends the root-cost adjustment to realm 2 STR, AGI and INT
brewing pills. Tests cover both ingredient positions, multipliers, old queues
and refunds after reload. In isolated build 25975458, all three pills charged
and refunded roots, Repeat paid for ten pills, and a saved partially completed
batch refunded only its remaining nine pills.

Version 1.16.0 adds end-job checkboxes for automatic drilling. Tests cover
branch ancestry, shared prerequisites, excluded-order refunds, manual overrides,
empty selections, multiple stations, legacy settings, and persistence. In
isolated build 25975458, real checkbox changes restricted drilling to the
forging branch's six jobs across 46 native level completions. An excluded order
refunded its pending level without losing progress, manual training reached
level 20 with no paths selected, and the crafting branch finished at levels
10 / 1 after save/load. The panel groups all 16 end jobs by native family.

Version 1.17.0 adds per-station Sell all and Sell over limit. Tests cover
independent bonus groups, strength ranking, protected gear, managed locks,
pending/failed settings writes, reloads, station isolation, and upgrade cycles.
In isolated build 25975458, the real dropdown enabled selling in Repeat,
Forger and Builder gloves kept separate limits, a crafting station kept its
best two belts, native sales credited copper, and reload preserved replacement
permission. Manual unlock/relock protected a keeper. Native Auto-all filled
four recipe/bonus groups and continued cycling upgrade batches of ten;
Sell all also cycled weapons-only batches without touching existing gear.

Version 1.17.1 fixes gatherers holding separate targets when a worker joins or
returns while another plot becomes available. Regression tests cover three
workers, overlapping ranges, merging groups and stale peer assignments. In
isolated build 25975458, the old code reproduced a two-plus-one miner split.
With the fix, groups of three miners, planters and loggers stayed together,
depleted their shared plot, switched targets, and handled native regrowth and
a returning worker without splitting or extending work range.

Version 1.17.2 extends the realm 2 cost adjustment to every native ingredient
costing 17,000 of a realm 1 resource, including forge stone → iron ore.
Regression tests cover resource families, both ingredient positions, material
multipliers, unaffected costs, queue reuse, and both earlier refund formats.
In isolated build 25975458, all 88 T2 item definitions returned the matching
T2 material prices. Native forge, crafting and brewing purchases and Repeat
batches used the new costs; forge and crafting Auto-all paid and refunded
ten-piece batches at ×10. The forge screen displayed 1,000 iron ore, and a
saved/reloaded partial batch refunded only its remaining nine crafts.

Version 1.17.3 prioritizes the lowest-stock selected item/bonus group before
each Auto-all batch. Equal counts rotate; each station uses its own settings
and only its available equipment slots. Tests cover quota shortages, recounting,
tie rotation, equipped gear, filters, multi-bonus allocation, independent
stations and reloads. In isolated build 25975458, a forge chose missing
Researcher gloves before Forger gear at 2/5 stock, while crafting independently
chose a missing Forger necklace. After all ten attempts, the forge selected the
next shortage without interrupting the crafting queue. Normal mode, No weapon,
unchecked roles, surplus sales and the updated station UI also passed.

Version 1.18.0 prioritizes work gear with Work Crit plus its job bonus, then
Work Crit alone, then the job bonus alone. Tests cover actual crit values,
built-in belt crit, rarity thresholds, multi-job stock allocation, protected
locks, native calculation failures, and unchanged combat ranking. In isolated
build 25975458, stronger work combinations replaced higher-rarity gear, sales
paid native copper, belts qualified on built-in crit, and Normal Auto-all kept
and locked crit-only gear. The updated station help also passed.

Version 1.18.1 limits work-gear qualification, stock counts and bonus ranking
to rolled suffixes. Innate belt crit no longer supplies a match or promotes a
job-only piece into the best combination. Main stat rolls and equipment level
no longer break work-gear ties; combat ranking is unchanged. Regression tests
cover innate-only rejects, suffix-only role groups and stock, belt upgrades,
and stronger suffixes winning despite weaker innate stats. In isolated build
25975458, native belt crafts followed the suffix ranking and credited copper
for rejects; Normal Auto-all kept and locked suffix matches while rejecting
innate-only belts.

Version 1.19.0 moves research and drilling controls onto their selected stations,
with independent toggles and drill end-job choices. Existing global preferences
migrate to all existing stations once. Research now chooses main-tab unlocks,
Research, Logging, Barracks, Training, Mining, Great Hall and Recruit Tech, then
the remaining categories. Each tree still finishes to its cap, and manual choices
retain priority. Regression coverage includes station isolation, reloads, migration
across maps, relocation, demolition, stale UI messages, malformed storage and
resuming from an open popup after cancellation. The release passes 362 JavaScript
and four installer tests. In isolated build 25975458, 134 native research/drill
completions verified the full priority order, native Repeat, manual overrides,
selected drill paths and unlock limits; station controls and reloads also passed.

Version 1.20.0 adds blue outfit locks with character/job hover tooltips. Saved
pieces are protected from native sales and every station output policy, including
replacement of that station's tracked auto-locks. Tests cover shared references,
replacement/forgetting, manual-lock preservation, upgrades, storage failures,
reloads, campaign isolation, marker visibility and tooltip input handling.
The release passes 370 JavaScript tests and four installer tests.
In isolated build 25975458, native inventory/equipment/pawnshop screens, real
pointer hover/click, multiple character/job references, native sale blocking,
release after the final Forget, reload onto another realm, and canvas alignment
at 1000×700 and 1600×1000 passed without runtime errors.

Version 1.20.1 makes rarity the first ranking criterion for surplus work gear.
Suffix combinations and rolls break ties within a color grade. Regression
coverage compares every pair of the six grades in both crafting orders at
forge and crafting stations, alongside existing lock protections and combat
ranking. The release passes 371 JavaScript tests and four installer tests.
In isolated build 25975458, both station types replaced strong-roll orange
gear with weak-roll red gear, locked the red, sold the orange for native
copper, rejected later orange gear, and upgraded to better same-grade bonuses.

Version 1.21.0 adds **Sell excess now** beside each equipment station's
automation controls. It trims existing matches to the saved stock limit while
checking every matching role before each planned removal. Tests cover shared
bonuses, unchecked roles, rarity ranking, filters, outfit/manual/managed locks,
paused queues, stale requests and native sale failures. The release passes
381 JavaScript tests and four installer tests. In isolated build 25975458,
real button clicks sold six of eleven matches, preserved a sole STR/Forge
spear while selling two Forge-only extras, respected a saved-and-unequipped
outfit piece, and selected the red belt over an orange belt. Native copper
payments, unchanged queues and UI result messages passed without runtime errors.

Version 1.22.0 shares building slots across all maps within a campaign while
keeping character formations specific to each map. Existing building saves
migrate on recall, preserving old copies and handling conflicting layouts.
The release passes 392 JavaScript tests and four installer tests. In isolated
build 25975458, native Shift shortcuts saved and recalled layouts across maps
28, 29 and 30 after reloads. Shared-slot replacement, character-slot isolation,
blocked destinations, old-save discovery and conflict resolution, building
levels, sprite positions and tile occupancy all passed.

Version 1.23.0 makes combat keeper and sell-over matching use the same spear,
bow and fan requirements as crafting and set progress. It also lets building
formations restore feasible moves while skipping blocked buildings and swaps,
with a partial-restore count. The release passes 400 JavaScript tests and four
installer tests. In isolated build 25975458, all nine tiers passed 243 native
weapon-catalog comparisons. Thirty-two native forge completions checked all
nine T2 weapon families, the three reported shovel suffix combinations, valid
work matches and surplus replacement. Native building checks verified occupied
dependencies, blocked destinations, missing swap space, retry after clearing
obstacles and shared layouts after a map change, with intact levels, sprites
and occupancy and no runtime errors.

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
   Switch maps and restart, then recall both shared layouts. Saving again on
   the new map should replace the shared building slot. Keep character slots
   1/2 separate per map. Block one destination and check that independent
   buildings still move and the message reports a partial restore. Clear the
   blockage and recall again to finish the remaining moves.
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
13. Select a crafting station, choose **Auto-all sets** in its popup, check the
    desired work/combat roles and choose tier/rarity, then **Apply / Start**. Confirm batches of ten,
    correct stat variants and rolled bonuses, and locked keepers for any role,
    including unchecked jobs. Let one station get ahead: it should advance roles
    and rounds for its own two slots while the other continues, with separate
    progress in each station's popup. Give two stations different roles, tiers,
    rarities and selling options. Pause or cancel one and verify the other continues.
    Disable auto-sell while running and verify rejects remain. Pause, select one
    role in **Loop**, then start and verify only that role repeats while matches
    for other roles are still locked. Verify STR crafts spears, AGI bows and INT
    fans. Restart to check settings and paused/running persistence.

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
`src/recipe-costs.js` adjusts realm 2 recipe ingredients and records each new
queue's paid cost in the unused queue field 12 for correct native refunds.
`src/gathering.js` focuses gatherers on the weakest remaining resources through
native production turrets, checking work range, remaining harvests and jobs.
`src/craft-sets.js` selects role recipes, matches gear, counts separate sets,
and ranks surplus items independently by their recipe, tier and bonus groups.
`src/craft-sets-runtime.js` schedules batches of ten, identifies their native
completion results, locks keepers and handles per-station settings, selection,
legacy settings migration and native sales.
`src/study.js` orders unlocked research by main-tab/named-tree priority and
remaining category order, orders drill targets by
class tier, traces prerequisite paths from selected end jobs, and calculates
the drill levels needed for further job unlocks.
`src/study-runtime.js` manages station preferences, legacy migration and selection,
selects targets through native functions, preserves manual training to its cap,
and bounds automatic drilling without changing the player's native Repeat preference.
`src/outfits.js` validates outfit snapshots and matches equipment records.
`src/outfit-runtime.js` observes native job changes, serializes equipment swaps,
checks inventory and equip eligibility, and manages the outfit panel and storage.
`src/runtime.js` adapts character/tile APIs, native movement/mode/summon functions,
the victory callback, and the native auto-summon event group.
`src/dom.js` handles keyboard focus, confirmation messages, and recruitment,
outfit and automation controls. The installer appends these scripts to the game's existing runtime
and DOM bundles. Presets
use Construct's `runtime.storage` under the `cjs-formations:v1:` namespace.
New snapshots use data format version 2 with positions, modes, and priority
coordinates; the namespace stays unchanged so version 1 position saves remain
available until replaced by holding the slot again.
Combat undo uses the separate `cjs-formations:combat:v1:` namespace.
Building presets use `cjs-formations:buildings:v2:<saveId>:<slot>` and store
building slots, types, and coordinates, without overwriting upgrades. Data
version 2 omits the map identifier. Old
`cjs-formations:buildings:v1:<saveId>:<mapId>:<slot>` records are copied into the
shared namespace on first recall, with the current map preferred and conflicting
layouts on other maps requiring a choice on their original map. Migration
preserves old records, and a map change during loading or migration cancels the
restore.
Recruitment preferences use DOM local storage at
`cjs-formations:recruit-options:v1`; the running state is never persisted.
The `minimumMoney` option is a nonnegative copper reserve (default `0`), separate
from the matching criteria. It applies to every paid roll regardless of targets.
Crafting memory uses `cjs-formations:crafting:v1:<saveId>` in runtime storage.
Each entry contains a facility slot, facility type, parent building slot, recipe,
and material multiplier. Queue progress and materials remain in the game save.
Station crafting uses `cjs-formations:craft-stations:v1:<saveId>` with validated
options, enabled flags and managed keeper identities per station. `keepLimit`
is null for Normal, zero for Sell all, or 1–999 for Sell over limit. Older
preferences default to Normal. `cjs-formations:craft-sets:v1:<saveId>` is the
legacy source used only for migration. Normal-mode queue ownership for selling
is session-only; qualifying inherited crafts are protected without claiming
their rejects for mod sales. Explicit output policies apply to newly created
results of the station's live queue, including after reload. Managed identities
ignore owner, lock and new-item markers but include level and rolled stats;
they are not written into native item records.
Research and drilling retain `cjs-formations:study:v1:<saveId>` with data format
version 2. `settings` holds enabled flags and selected end-job IDs per station,
identified by facility slot/type, parent building slot and station kind.
`stations` retains target ownership records. Version 1 global preferences
migrate once to existing stations. Null end-job selections mean all jobs;
an empty list selects no paths. The ownership records distinguish
automatic research from manual targets across reloads. Native queues, levels,
progress and copper remain in the game save; cancellation preserves progress.
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
