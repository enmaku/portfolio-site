# 14. Remaster vs legacy names: matching Pathbuilder export names to rules text

Research for enmaku/portfolio-site#485 (map #476, CritCrafter character viewer). Facts and a recommended
approach only; the architecture decision is not made here.

Sources and how they were read (all queried 2026-11-21 with a generic User-Agent, nothing private sent):

- **SoT exports**: the six `heroes/*.json` files in the sibling `strength-of-thousands` repo (read only).
- **Foundry pf2e packs**: `foundryvtt/pf2e` at `d507983` (2026-11-18), `packs/pf2e/` JSON, parsed with
  `python3 -I` scripts kept outside the pack directory. Read only.
- **Archives of Nethys (AoN) index**: the public Elasticsearch endpoint `https://elasticsearch.aonprd.com/aon/_search`
  (index `aon-20261116-195046`). It is anonymous and works server-side (issue #478 found its CORS allowlist blocks
  browsers on our origin). Queried here with plain server-side POSTs.
- **Pathbuilder internals**: this repo's `pathbuilder-records/docs/` (our own earlier reverse-engineering notes).
- Paizo's own remaster pages (`paizo.com/pathfinder/remaster`) returned HTTP 403 to an automated client, so no Paizo
  page is cited directly. AoN rows carry Paizo book and release data (Player Core `release_date` 2023-11-15) and
  are the primary source used for rename pairs.

## 1. Which edition do Pathbuilder export names use?

**Both, mixed, and the export does not say which.**

- The `build` object of all six exports has no edition field. Keys are `name, class, dualClass, level, xp, ancestry,
  heritage, background, alignment, gender, age, deity, size, sizeName, keyability, languages, rituals, resistances,
  inventorMods, abilities, attributes, proficiencies, mods, feats, specials, lores, equipmentContainers, equipment,
  specificProficiencies, weapons, money, armor, spellCasters, focusPoints, focus, formula, acTotal, pets, familiars`.
  The app's own character record has `remastered`, `remasteredPC2` and `useUpdatedSpells` booleans
  (`03-character-model.md` lines 148-163), but they are not present in the exported build in any of the six files.
- Pathbuilder ships two datasets, `data137` (legacy) and `data_remastered80` (remaster) (`02-data-files.md`).
  Spell rows carry an `outdated` flag marking Remaster-renamed spells; they are hidden unless the character has
  `useUpdatedSpells = false` or the user enables "Allow Outdated Spells" (`04-spell-system.md`, `02-data-files.md`).
  So a legacy-named spell in an export is a deliberate or inherited per-character choice, not a bug.
- **Mixed names inside one export** (taraan-skyseeker.json): legacy `True Strike` and `Dancing Lights` (spells),
  `Repair Kit` and `Artisan's Tools` (gear) sit next to remaster-era content in the same export (`Scroll of Sure Strike`,
  `Vitality Lash` and `Admonishing Ray` spells, `Explorer's Clothing`-style gear). The other five exports contain
  no legacy-only renamed names. Of 275 distinct (export, kind, name) tuples, 4 are
  legacy-drift names (about 1.5%), all in one export.
- `alignment` is `"N"` in all six exports, including a Cleric with deity Soralyon, and `deity` is the literal string
  `"Not set"` for four of six. Treat both as unreliable placeholders (Pathbuilder docs: "Remaster hides" alignment,
  `03-character-model.md` line 56).

## 2. How the Foundry packs represent a remaster rename

- **No rename metadata at all.** A pack entry has top-level `_id, folder, img, name, system, type`. `system.publication`
  is `{license, remaster, title}` and nothing else; there is no legacy-name field, redirect, alias or `slug` field
  (`slug` is absent). The `rules` key exists on every entry but is for Foundry rule elements, not redirects.
- **Renamed in place, legacy entry usually deleted.** `True Strike` does not exist in the packs; `Sure Strike`
  (`spells/spells/rank-1/sure-strike.json`, ORC, remaster true, Player Core) does. `Magic Missile` is gone, `Force Barrage`
  exists. `Repair Kit` is gone, `Repair Toolkit` exists. `Dancing Lights` is gone (see merge below).
- **But not always.** Legacy entries that were replaced under a different name still coexist in some cases: of 171
  AoN-paired renamed spells, 137 have the legacy name absent from Foundry and 34 still have it (e.g. `Acid Splash`,
  `Acid Arrow`, `Cone of Cold`, `Alter Reality`, `Black Tentacles`: `publication.remaster: false`, OGL, Core Rulebook,
  alongside `Caustic Blast`, `Acid Grip`, `Howling Blizzard`, `Wish`/`Manifestation`, `Slither`). For feats: of 209 renamed
  pairs, 179 have the legacy name absent and 30 present. Items are more mixed (1,077 renamed pair rows): legacy name
  absent in 510 and present in 567 (mostly variants like `Bagpipes of Turmoil (Greater)`). Nothing in the Foundry data links a surviving legacy entry to its replacement.
- **Same name, both editions** exists but is rare: 4 feat names have both a remaster and a legacy entry
  (all other types: 0).
- **Unchanged-name legacy stays legacy**: `Spiritual Weapon` is `OGL`, `remaster: false`, Core Rulebook, and is the
  only version. Remaster flag means "published in a remaster-era book", not "newer name".
- **Many-to-one merge**: `Dancing Lights` and the legacy `Light` both map to the single remaster `Light`
  (AoN `spell-1585` carries `legacy_id: [spell-171, spell-58]`; Foundry has only `Light`, ORC).
- **Non-rename label differences are not drift**: `Detective Dedication` in Lithrei's export is Pathbuilder's short
  label for `Edgewatch Detective Dedication` (Foundry: OGL, remaster false, Pathfinder #157; AoN `feat-2193`; the same
  character has `Experienced Tracker`, which that dedication grants). AoN also has `Palatine Detective Dedication`, so a bare
  `Detective Dedication` is ambiguous and needs a Pathbuilder-specific alias. `Smuggler's Sack II` is Foundry
  `Smuggler's Sack (Type II)`; `Clothing (Explorer's)` is Foundry armor `Explorer's Clothing`; `Scroll of X` is a Foundry
  generic `Scroll of 1st-rank Spell`. None of these are remaster renames.

## 3. A rename table source

**AoN is the best machine-readable source; Foundry has none.**

AoN index rows carry paired fields: `legacy_id` and `legacy_name` on the remaster entry, `remaster_id` and
`remaster_name` on the legacy entry. Verified example: `spell-345` True Strike (Core Rulebook, 2019-08-01)
has `remaster_id: [spell-1709]`, `remaster_name: [Sure Strike]`; `spell-1709` has `legacy_id: [spell-345]`,
`legacy_name: [True Strike]`. Same for `equipment-43` Repair Kit to `equipment-2747` Repair Toolkit.

Dump over all categories: 12,095 rows with `remaster_id`, 12,641 with `legacy_id`. `remaster_name` is present on only
about 1,584 of the 12,095 (names are only filled when they differ), so unchanged-name pairs must be read from the
`*_id` links. Pairs whose names actually changed (counting each link): equipment 1,055 (mostly item variants),
class-feature 592, feat 210, spell 175, plus rules/sidebar/creature/item-bonus rows that a character viewer does not
need. Unchanged-name pairs (e.g. feat 2,284, equipment 1,477, spell 756) need no alias, they only matter for edition
metadata. 77 `remaster_id` links dangle (target not in the dump).

Noise to filter: raw name matching across categories produces junk aliases (the class-page rows for `Summoner`,
`Magus` etc. appear to "rename" to `Ancestry Feats`, `Attribute Boosts`, parsed from section text). Restrict to the same
category (spell, feat, equipment/weapon/armor/shield, action, heritage), and to pairs with distinct names. Variant
suffixes (`Repair Kit (Superb)`) need base-name stripping.

Official lists exist (Paizo's remaster changes PDF and blog) but are prose/PDF and Paizo's pages were not reachable
by script. They were not used.

## 4. Quantification against the six exports

275 distinct (export, kind, name) tuples covering feats, specials, spells, equipment, weapons, armor, class,
ancestry, heritage, background and deity, matched case-insensitively against the Foundry `spells, feats, equipment,
actions, class-features, heritages, backgrounds, ancestries, ancestry-features, classes, deities` packs.

| Resolution | Count |
| --- | --- |
| Exact name in Foundry, no alias needed | 236 |
| Resolved only through AoN legacy-to-remaster alias | 4 |
| No resolution | 35 |

So 236/275 (85.8%) without an alias table, 240/275 (87.3%) with it. The alias table adds exactly four names, all in
`taraan-skyseeker.json`: `True Strike` to `Sure Strike`, `Dancing Lights` to `Light`, `Repair Kit` to `Repair Toolkit`,
`Artisan's Tools` to `Artisan's Toolkit`. (`Artisan's Tools` is a legacy name in the export beside `Artisan's Toolkit`
in `cy-an-copperbottom.json`, so mixed even across exports.)

The 35 misses by kind, none due to remaster drift:

| Kind | Misses | Examples |
| --- | --- | --- |
| special | 20 | class/ancestry framework labels (`Healing Font`, `Deity`, `Anathema`, `Life Mystery`, `Breath Weapon`, `Spellbook`, `Low-Light Vision`, `Acrobatics`), Pathbuilder artifacts (`acid`, `No special vision`, `Soul`), `Custom Mixed Heritage` |
| deity | 4 | the placeholder `Not set` |
| equipment | 6 | `Scroll of Sure Strike`, `Scroll of Augury`, `Scroll of Fleet Step` (generic scroll entry), `Smuggler's Sack II`, `Clothing (Explorer's)`, custom `Bloodsalt folio` |
| feat | 2 | `Custom Mixed Heritage`, `Detective Dedication` (label) |
| heritage | 1 | `Custom Mixed Heritage` |
| weapon | 2 | `Branch Implement (Lithrei)`, `Margent` (unresolved, likely homebrew or Pathbuilder-custom) |

Compared with the earlier addendum on #481: it listed `True Strike`, `Dancing Lights`, `Repair Kit`, `Detective Dedication`
as possible drift. Result: three are drift and resolved by AoN pairs (plus `Artisan's Tools`); `Detective Dedication`
is a short Pathbuilder label, not drift. `Scroll of Sure Strike` is an additional case worth noting: it is a scroll of a
remaster spell, and needs generic-scroll parsing, not an alias.

Exact-match false-positive risk: 10 export names hit exactly while also appearing as AoN "legacy names". All are benign
(they are class names or have same-name unchanged pairs), but an exact hit does not prove the edition. Exact match
should be taken as authoritative because the export's name is the author's choice.

Licence tag side by side (Foundry `system.publication`): legacy sides are OGL with `remaster: false`; remaster sides
are ORC with `remaster: true`. Counts across the loaded packs: feats ORC-remaster 5,630, OGL-legacy 1,587, OGL-remaster
201; spells ORC-remaster 1,505, OGL-legacy 408, OGL-remaster 123; equipment ORC-remaster 1,584, OGL-legacy 798, OGL-remaster
72. So `license` and `remaster` are independent: some remaster-era entries are still OGL (older content re-issued). Use
`license` for the notice and never infer it from `remaster`.

## 5. Rule differences that touch derived stats and display

Limited to what the viewer would show. Evidence level noted.

- **Export numbers are already computed by Pathbuilder for the chosen ruleset.** `acTotal`, weapon attack and damage
  and proficiency ranks come from the export (`03-character-model.md`, issue #479), so a remaster/legacy mismatch in the
  name layer does not change them. A viewer that derives skill/save/spell DC totals from ranks uses the same formulas
  in both editions; no remaster-specific formula change was found in the six exports.
- **Alignment**: unreliable in exports (all `N`), so do not show it (verified in exports; `03-character-model.md` line 56).
  AoN keeps the Core Rulebook "Alignment" rules entries only as legacy source; Player Core has no equivalent entry.
- **Condition rename**: `Flat-Footed` (Core Rulebook, `condition-16`) to `Off-Guard` (Player Core, `condition-58`), same
  -2 circumstance penalty to AC (AoN text for both). Display only; the viewer is read-only and tracks no conditions.
- **Trait renames in rules text**: `positive` to `vitality` and `negative` to `void` (AoN `trait-128`/`trait-509`,
  `trait-118`/`trait-510`); `holy`/`unholy` added (`trait-517`/`trait-521`) and `good`/`evil` remain legacy. Matters for
  spell cards and trait chips: a legacy spell name with remaster text (or vice versa) shows different traits.
- **Item changes**: AoN equipment pair rows differ in Bulk in 116 of 2,823 pairs, price in 1,084 and level in 843,
  dominated by variant/upgrade rows (`Repair Kit (Superb)` and similar collapsing into one `Repair Toolkit`) and by tools
  that became "toolkits" with `hands: -1`. For the export items checked in Foundry, Bulk is identical across a rename
  (`Repair Toolkit` 1, `Artisan's Toolkit` 2, `Explorer's Clothing` L, `Rope` L). Because Pathbuilder gives name-only gear,
  Bulk derived from a legacy-name hit vs a remaster-name hit differs only where the pair differs; worst case is a small
  number of items, not a systemic error. The AoN pair-row Bulk comparison is noisy (variants, missing fields) and should
  not be used as a rules statement.
- **Spell text**: `True Strike` AoN text carries a PFS note adding the immunity clause that `Sure Strike` has natively
  (Foundry `Sure Strike` description: "temporarily immune to sure strike for 10 minutes"). If we alias a legacy name to
  remaster text, the shown rules text is the remaster rules, which for these pairs is the stricter/current version.
- **Not verified from a primary source**: other remaster rule changes (ancestry/class overhauls, Unarmed/Untrained
  changes, Unarmored defense text, `Heal`/`Harm` font naming) were not confirmed because Paizo's pages were
  inaccessible; none of them produced a visible discrepancy in the six exports.

## 6. Licence consequences of each side of a rename

- **Legacy name, legacy entry**: Foundry/AoN tag it OGL, `remaster: false`; use the OGL 1.0a notice with source
  book (`publication.title`). Do not copy Reserved/Product Identity text; the earlier notes (#478) already set the rule.
- **Remaster name, remaster entry**: tagged ORC, `remaster: true`; use the ORC notice and attribute the source book
  (`Pathfinder Player Core` etc.).
- **Aliasing a legacy name to a remaster entry**: the displayed text and its notice come from the remaster entry
  (ORC), which is the target of the alias, not the legacy OGL text. No licence is lost; the notice must follow the
  text actually shown, not the name the export used.
- **Mixed pairs**: remaster-era entries can still be OGL (e.g. 201 feats, 123 spells, 72 equipment), so per-entry
  `license` is the only safe key. Same counsel caveat as the earlier licence notes (#478, `11-legal-and-licensing.md`).
- Foundry's own licensing statement (Paizo/Foundry agreement) does not extend to us (#481 addendum); the per-entry tag
  is the basis, unchanged.

## 7. Recommended approach to name resolution

1. **Key by (kind, normalized name)**, not bare name. Fold case, curly quotes and whitespace. Kinds: spell, feat,
   equipment (incl. weapon/armor/shield), action/special, heritage, background, ancestry, class, deity.
2. **Resolution order**:
   1. exact match in the Foundry-derived index for that kind (the export's own name is the author's edition choice);
   2. alias from the legacy-to-remaster table (below), then exact match on the target;
   3. Pathbuilder-label rules (a small hand-kept table, see below);
   4. no rules text; show the name with an AoN search link.
3. **Generate the alias table at build time from AoN** `legacy_id`/`remaster_id` links, restricted to same-category
   pairs with different names and to categories the viewer shows (spell, feat, equipment, action, heritage); about 175
   spell and 210 feat renames plus item bases. Expected size: a few hundred rows once variants are collapsed. Commit
   it so the build is reproducible and AoN is not a runtime dependency; regenerate when the pack index is refreshed.
4. **Keep a small hand table for Pathbuilder labels** that are not remaster drift: `Detective Dedication` (ambiguous
   between Edgewatch and Palatine), `Smuggler's Sack II` to `(Type II)`, `Clothing (Explorer's)` to `Explorer's Clothing`,
   `Scroll of <spell>` to the generic scroll plus spell lookup, `Custom ...` (never resolvable).
5. **Record which side matched** (`exact` / `alias` / `label`) and show the remaster entry's `license` notice; consider
   a small "shown as <new name>" hint when an alias fired so a legacy-named character is not confused.
6. **Expect ~14% of names unresolved** even with perfect aliasing, mostly framework specials and customs, so the
   fallback is part of the feature, not an edge case.

## Appendix: reproduction notes

- Scripts: `python3 -I`, kept in the session scratchpad, not in this repo.
- AoN query shape: `POST /aon/_search` with `_source` limited to `id,name,category,legacy_id,legacy_name,remaster_id,
  remaster_name,...` and `search_after` on `_doc`; 24,736 rows with any pair field.
- Foundry counts come from walking `packs/pf2e/{spells,feats,equipment,actions,class-features,heritages,backgrounds,
  ancestries,ancestry-features,classes,deities}` (17,526 entries parsed).
