# CritCrafter viewer: layout prototype

Answer to the wayfinder ticket "Prototype: mobile layout and bottom navigation" (map: *CritCrafter character viewer: wayfinder map*).

**Run it** (dev only; the route is not registered in production builds): `npm run dev`, open `/projects/critcrafter-prototype`.

**Files** (all throwaway-grade, hand-fed Lithrei Woeborn data, illustrative rules text):

- `src/pages/projects/CritcrafterPrototypePage.vue`: the single chosen design and all state
- `src/pages/projects/CritcrafterCostIcons.vue`, `CritcrafterRankPips.vue`, `CritcrafterTraitChips.vue`: small presentational pieces
- `src/assets/critcrafter-prototype/action-*.png`: action glyphs copied from `strength-of-thousands/cards/templates`
- Route: dev-only entry in `src/router/routes.js`

Not production code. The real viewer renders a server-built CritCrafter sheet and does no lookup or derived-stat math; everything computed here (AC, skill bonuses, ranks) stands in for sheet fields.

## Decisions

The chosen design (originally variant D of four) is cards, a floating bottom bar and a bottom sheet, with the details below. The rejected variants (A fixed header with flat lists, B accordion density, C plain cards) were removed from the page; they remain in git history.

### Shell and navigation

- Phone-framed project inside the existing project shell (desktop phone frame unchanged).
- **Floating bottom bar** (rounded, inset 8px): Stats, Skills, Gear, Spells, Actions; icon over label, active tab white on a primary-slate pill.
- **Pinned topper** (hero block) is fixed at the top and never scrolls; only the area below it scrolls. Primary-slate flat background, no gradient.
- Palette is the site's Quasar theme (`--q-primary`, `--q-dark`, `--q-dark-page`, secondary grey, toolbar-menu slate); no ad hoc colours.
- All rows are "chunky": 52-56px min height, 16px text, 48px minimum touch targets. Tapping a row opens a **bottom sheet** with detail text, traits and cost.

### Topper

- Name, "Lv N", ancestry/class line; HP, AC, Perception, Speed as large numbers.
- **AC is live**: reflects equipped armor and a raised shield.
- A tiny centred **shield row** under the stats whenever a shield is equipped: name, "raised, +N AC" or "lowered" (dimmed when lowered), Hardness, HP (a plain value, no current/max), BT.

### Stats tab

Three sections separated by horizontal rules and padding, each with a small uppercase label: **Saves**, **Abilities**, **DC & attack**.

### Skills tab

One column. Each row: name, the full **U T E M L** ladder in fixed 26px slots with the current rank in a filled circle, then a fixed-width right-aligned bonus. The ladder and bonus columns align down the whole list.

### Gear tab

- Groups as expansion items (open by default), header shows a count; the Weapons header shows "Hands n/2".
- Groups: **Weapons**, **Armor & Shields**, **Consumables**, **Gear**. Group membership here is a guess; the corpus item types decide it for real.
- Row: name; stat text below the name ("+4 · 1d8 S"); **trait chips** at the bottom; controls on the right.
- **Weapons**: hand glyphs (one per hand). Versatile weapons show the hands in a bordered, tinted pill with a swap icon; tapping switches 1 or 2 hands. Sword icon toggles held/not held. **Two-hand limit enforced**: equipping or widening a grip drops other held weapons (earliest in the list first) until total hands is 2 or less.
- **Armor**: shirt icon toggles worn. One body armor at a time; layered pieces (armored skirt) coexist. Item bonus is the best of the worn pieces; untrained armor gets no proficiency bonus.
- **Shields**: shield icon equips or unequips (one shield at a time, unequipping lowers it). A "person raised hand" button to its left raises or lowers the equipped shield; it is disabled while not equipped. Only a raised shield adds its AC.
- **Consumables**: tap-to-cycle consumed boxes (0..n, then reset to 0). More than 5 units show one box and "k / n used".
- Equip icons are bright when on, dim when off.

### Spells tab

- Expansion item per level (Cantrips, 1st level, Focus). The header holds the usage control: **tap-to-cycle** boxes (0..n left to right, reset to 0 after n), one big tap target that does not toggle the expansion. Cantrips show "at will".
- Row: spell name, trait chips, action-cost glyph at the right.

### Actions tab

- Row: name, trait chips, and right-aligned meta; the **action glyph** (1, 2, 3, reaction, free, or a range such as "1 to 3") is the right-most item. No "1 action" text anywhere a glyph shows.

### Glyphs

Real PF2e action glyph PNGs (single, two, three, reaction, free) from the SoT card templates, inverted for the dark theme, 18px tall.

## Open questions this prototype raised

1. **State tracking vs the read-only v1 decision.** Slot and focus usage, consumed counts, shield raise, equip toggles and the hands limit are all stateful here. The map's standing decision is read-only v1. Either these are in v1 (then decide persistence, probably local storage keyed by Pathbuilder id), or they are cut.
2. **Derived math belongs in the sheet.** AC with armor and shield swaps, per-skill bonuses and rank letters are computed in the page here; the real design puts them in the sheet function, which means the sheet must carry per-item AC contributions, hands, traits and cost so the client can recombine equip state without lookup.
3. **Sheet fields implied by this layout:** per item: type group, traits, hands/versatile, armor item bonus + proficiency category + layered flag, shield AC/Hardness/HP/BT; per spell and action: cost glyph key (including ranges), traits, rules text; per spell level: slot count; per skill: rank letter (U T E M L) and total; sheet-level Perception, Speed, saves, DCs.
4. Trait chips are not interactive here; whether a trait opens its rules text is undecided.
5. Shield does not occupy a hand in the hands limit here; whether it should is undecided.

## HP and rests (answer to "Prototype: HP tracking and rest tooling")

Built into the same page. The chosen HP design (option A) is the only one kept; the inline-stepper and Stats-card alternatives were removed.

- **HP**: the topper shows `current / max`; tapping it opens a keypad bottom sheet with Damage, Heal and Temp HP. Apply closes the sheet. Damage hits temp HP first; temp HP does not stack (highest wins); HP floors at 0. Healing is entered as plain healing (Treat Wounds is an ordinary action, not a rest).
- **Shield HP**: shown in the shield row (`HP n/max`, red and BROKEN at or below BT). While the shield is raised, the keypad adds Damage Shield and Repair Shield (exact HP change, repair capped at max); tapping a raised shield row opens the keypad on Damage Shield. Row height is constant across lowered/raised.
- **Conditions**: none in v1 (no dying, wounded, doomed or drained tracking; the viewer shows HP only).
- **Rests** (Stats tab, one row): Refocus (10 min, +1 focus point, toast), Rest 8 h (regain Con modifier + 1 HP), Rest 24 h (2 × (Con modifier + 1)), Extended rest (1 week downtime, full HP). Every 8 h or longer rest refills spell slots and the focus pool, clears temp HP. Rests never repair shields: repairing is an action with a skill check, so shield HP only changes through Damage Shield / Repair Shield on the keypad. Rest dialogs describe their effect; no per-rest prompts. Consumables are never reset by rests; daily-use abilities are not tracked in v1.
- **Hands**: shields get their own Gear group between Weapons and Armor. A shield takes one hand while equipped; a buckler is strapped on and takes a hand only while raised. Equipping or raising a shield puts weapons away (earliest first) until it fits; equipping a weapon or widening a grip drops other weapons, then the shield (a buckler is lowered). Toast uses the gear icon.
- **Sheet must carry**: max HP, per-shield max HP, Hardness, BT, buckler flag, shield AC bonus. **Store adds**: current HP, temp HP, per-shield current HP, keyed by Pathbuilder id.

## Tap-to-explain (answer to "Tap-to-explain: which numbers are tappable and what the sheet shows")

Specified only; not in the prototype page. Every derived number in the sheet format's tappable list opens one **breakdown sheet**.

- **Tap targets**: the number itself, minimum 48px hit area, with a dotted underline as the only affordance cue. Skills, saves, Perception, Speed, class DC, spell DC and attack, Bulk and the topper AC badge open the breakdown. On weapons, only the attack and damage chips do; the rest of the row still opens item detail. On HP, only the max half of `current / max` does; the rest keeps opening the keypad.
- **Layout** (same bottom-sheet component as item detail): header with stat name and large total; breakdown rows (label, signed amount, muted bonus-type chip) in the function's order; a Total row; then, only if the stat has linked corpus actions (for example Athletics: Grapple, Trip, Shove), compact action rows. Tapping an action stacks its detail sheet on the breakdown, Back returns. No explainer prose.
- **AC and Bulk**: the AC breakdown shows current state only (worn armor lines plus "Shield raised +N" when raised), no comparison with other armor. Bulk's breakdown is the sheet's own gear lines and ignores equip state.
- **Rows shown as sent**: "Other (from Pathbuilder) ±N" and "Untrained +0" render as ordinary rows, no warning styling and nothing hidden, so the sum stays visibly honest.
- **One-way link**: stat to its actions only; the Actions screen does not link back to a stat's breakdown in v1.

## Loading, empty and desktop states (answer to "Loading, empty and desktop states for the viewer")

Specified only; not in the prototype page.

- **Desktop**: v1 is mobile-only. The viewer uses the shared desktop phone frame and the project shell's fullscreen toggle unchanged, with no desktop-specific layout, and is listed under Mobile. A real desktop layout is a possible future effort, not part of this spec.
- **Loading**: one full-screen state with the bottom bar hidden: skeleton of the pinned topper and a few ruled section blocks, plus one status line that follows the step ("Fetching from Pathbuilder…", then "Building your sheet…"). No spinner-only screen and no timeout UI beyond the decided failure states.
- **Landing (no `id`)**: the id-or-URL input with a one-line hint ("Paste your Pathbuilder id or share link") and a "Recent" chip row: the last 3 successfully loaded ids in localStorage, each labelled with the character name.
- **Reload**: refetch and re-post every load, no cached sheet. Table state comes from localStorage by Pathbuilder id; stored values are clamped to the new sheet's maxima (slots, focus, HP, consumables) with no migration UI or notice.
- **Empty sections**: the Spells bar item is hidden when the sheet has no spells, rituals or focus (four-item bar). Empty groups inside a screen are omitted. A visible screen with nothing shows one muted line (for example "No gear in this build"). Stats is always populated.

## Viewer test strategy and missing exports (answer to "Viewer test strategy and missing real exports")

Specified only; the viewer is not built yet.

- **Layers** (all `node:test`, matching the repo): the per-id table-state store (slots, focus, consumables, equip, shield raise, hands limit, HP, temp HP, shield HP, rests, clamping to new maxima); pure view-model helpers (live AC composition, hands-limit enforcement, grouping, section hiding); route registration and the share-catalog row. No `.vue` component tests, no jsdom, no Playwright e2e in v1, so `.vue` files stay thin.
- **Fixtures**: sheet JSON generated by running real exports through the function, committed beside the viewer tests, validated against the schema in `docs/critcrafter/` by a test. A regenerate script rebuilds them on schema change; they are never hand-edited. First source: the sibling repo's `heroes/*.json` (the six committed exports, ids read from them). A one-off Playwright dev script may refresh exports from `json.php` later.
- **Privacy**: committed exports are stripped of names and free-text fields, the rest byte-for-byte.
- **Missing exports**: still needed are a nonzero-HP-bonus character (Toughness plus a per-level source, Con not 10, with Pathbuilder's shown max HP recorded), a pet or companion, an eidolon, runes on gear, and a high-rank caster. A checklist in `docs/critcrafter/` lists what each proves; cases that never arrive get synthetic builds in the function tests. Max-HP formula is verified against two real Pathbuilder exports: a Toughness-only Dwarf Fighter (L5, Con +3, `bonushp: 0`, `bonushpPerLevel: 1`) shows 80 HP, and the same character with Barbarian Dedication and Barbarian Resiliency (`bonushp: 6`) shows 86 HP. Both fit `ancestryhp + (classhp + conMod) × level + bonushp + bonushpPerLevel × level`; the old doc 08 form that multiplied `bonushp` by level gives 110 for the second and is wrong. Both exports are kept as the max-HP goldens, with names stripped, and no export is a ship-blocker any longer.
- **Wiring**: add one glob, `src/features/critcrafter/**/*.test.js`, to the `npm test` script; the spec handoff must list this.
