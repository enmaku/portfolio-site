# CritCrafter viewer: layout prototype (variant D chosen)

Answer to the wayfinder ticket "Prototype: mobile layout and bottom navigation" (map: *CritCrafter character viewer: wayfinder map*).

**Run it** (dev only; the route is not registered in production builds): `npm run dev`, open `/projects/critcrafter-prototype` (variant D is the default; `?variant=A|B|C|D`, or the floating pill / ←→ keys).

**Files** (all throwaway-grade, hand-fed Lithrei Woeborn data, illustrative rules text):

- `src/pages/projects/CritcrafterPrototypePage.vue`: the four variants and all state
- `src/pages/projects/CritcrafterCostIcons.vue`, `CritcrafterRankPips.vue`, `CritcrafterTraitChips.vue`: small presentational pieces
- `src/assets/critcrafter-prototype/action-*.png`: action glyphs copied from `strength-of-thousands/cards/templates`
- Route: dev-only entry in `src/router/routes.js`

Not production code. The real viewer renders a server-built CritCrafter sheet and does no lookup or derived-stat math; everything computed here (AC, skill bonuses, ranks) stands in for sheet fields.

## Decisions (variant D)

Variant D is variant C (cards, floating bottom bar, bottom sheet) with the changes below. A (fixed header, flat lists), B (accordion density) and C are kept only for comparison.

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

Built into variant D of the same page (`?variant=D`, HP option A; options B and C remain reachable via `?hp=B|C` and are not chosen).

- **HP**: the topper shows `current / max`; tapping it opens a keypad bottom sheet with Damage, Heal and Temp HP. Apply closes the sheet. Damage hits temp HP first; temp HP does not stack (highest wins); HP floors at 0. Healing is entered as plain healing (Treat Wounds is an ordinary action, not a rest).
- **Shield HP**: shown in the shield row (`HP n/max`, red and BROKEN at or below BT). While the shield is raised, the keypad adds Damage Shield and Repair Shield (exact HP change, repair capped at max); tapping a raised shield row opens the keypad on Damage Shield. Row height is constant across lowered/raised.
- **Conditions**: none in v1 (no dying, wounded, doomed or drained tracking; the viewer shows HP only).
- **Rests** (Stats tab, one row): Refocus (10 min, +1 focus point, toast), Rest 8 h (regain Con modifier + 1 HP), Rest 24 h (2 × (Con modifier + 1)), Extended rest (1 week downtime, full HP). Every 8 h or longer rest refills spell slots and the focus pool, clears temp HP. Rests never repair shields: repairing is an action with a skill check, so shield HP only changes through Damage Shield / Repair Shield on the keypad. Rest dialogs describe their effect; no per-rest prompts. Consumables are never reset by rests; daily-use abilities are not tracked in v1.
- **Hands**: shields get their own Gear group between Weapons and Armor. A shield takes one hand while equipped; a buckler is strapped on and takes a hand only while raised. Equipping or raising a shield puts weapons away (earliest first) until it fits; equipping a weapon or widening a grip drops other weapons, then the shield (a buckler is lowered). Toast uses the gear icon.
- **Sheet must carry**: max HP, per-shield max HP, Hardness, BT, buckler flag, shield AC bonus. **Store adds**: current HP, temp HP, per-shield current HP, keyed by Pathbuilder id.
