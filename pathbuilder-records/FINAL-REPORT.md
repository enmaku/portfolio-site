# Pathbuilder 2e — Final Report

Reverse-engineering of `https://pathbuilder2e.com/app.html?v=81e`, app version
**112.0 "Feylines"**, for the purpose of building a clone/rewrite.

Deliverables live in [`docs/`](./docs/) (12 documents, ~237 KB) plus 55 screenshots in
[`docs/img/`](./docs/img/). The tooling that produced them is in [`probe/`](./probe/).

---

## 1. What the application is

A **single-page Kotlin/JS application** (one ~4.2 MB webpack UMD bundle) that builds
Pathfinder 2e characters. It has no backend for character logic: the browser holds all
state in IndexedDB and derives every number from a compressed rules database that it
downloads from a CDN.

Architecturally it is unusual in three ways:

1. **Imperative DOM.** No framework, no templating, no diffing. Every element is
   created with `document.createElement` and inserted with `appendChild`; a render is a
   `innerHTML = ""` followed by a rebuild.
2. **Data-as-CSV.** The rules database is 245 SQLite tables exported to CSV, packed into
   one JSON object, and compressed with LZ-string into a single 4 MB text file that the
   app decodes at boot.
3. **Derive-everything.** The character document holds only *choices*; HP, AC, saves,
   skills, DCs, bulk and speed are recomputed on every render from the document plus
   the rules data.

---

## 2. Method

* One persistent Chrome DevTools Protocol WebSocket to the running browser, re-exposed
  as a local HTTP API (`probe/cdp-bridge.mjs`) so every later probe reused the same
  connection — never re-connected.
* The bundle was downloaded, beautified to 146 426 lines, and read directly for the
  authoritative behaviour.
* The two rules-data files were downloaded, decoded, and rebuilt into a queryable
  245-table SQLite database (`probe/assets/pb_remastered.db`).
* The UI was walked in full (8 main tabs, all 25+ sidebar entries, every dialog, the
  dice tray, the top bar) and a character was built and levelled to exercise the flow.
* 55 screenshots were captured through the CDP bridge and embedded in the UI document.

---

## 3. Findings

### 3.1 Data layer

| Fact | Detail |
| --- | --- |
| Encoding | `LZString.compressToBase64(JSON.stringify({table: csvText}))` |
| Payload | 412 JSON keys = 245 real tables + 167 `sqlite_autoindex_*` empties |
| Volume | 5 172 feats · 1 379 spells · 288 backgrounds · 38 ancestries · 28 classes |
| Boot | Download → cache raw text in IndexedDB `data` → decode → PapaParse each CSV |
| Quirk | `spellist_*` vs `spelllist_*` — the shipped data misspells the table name for arcane/divine/elemental/nonstandard |
| Quirk | Three different column signatures within the same feat table group; columns must be read by name |
| Quirk | Missing `src` means `"CRB"` |

A local rebuild recipe (Node + Python) is in
[02-data-files.md](./docs/02-data-files.md) §5 and reproduces the database exactly.

### 3.2 Character model

* ~125 serializable fields, all **optional** (the serializer registers each with a
  nullability flag).
* Stored as a **JSON string** (not an object) in IndexedDB `saves`, keyed by a UUID
  `webID`. This is the single most important compatibility detail.
* Almost all state is in string-keyed maps: `hashMapFeatSelections`,
  `hashMapSpecialSelections`, `hashMapPlayerSpells`, `hashMapTrainedOnlySkillChoices`,
  `hashMapSkillIncreases`, `hashMapAbilityBoosts`, `hashMapPetData`, …
* There is **no** `heritage` field — the heritage is a feat under
  `hashMapFeatSelections["Heritage Feat"]`. The export JSON synthesises one.
* Backgrounds are stored by id (`BACKGROUND_Acolyte`); ancestry and class by name.

### 3.3 Feats

* Keyed by `id` = `"<PREFIX>_<Display Name>"` (`WIZARD_Counterspell`,
  `DWARF_Rock Dwarf`, `ARCHETYPE_BARD_Bard Dedication`).
* Stored as `hashMapFeatSelections[slotName] = "PREFIX_Name"`.
* Slot names are constructed, not stored: `"Class Feat"`, `"Dwarf Feat 1"`,
  `"Dwarf Feat 1a"`, and — importantly — child slots concatenate the parent slot with
  the chosen value: `"Heritage Featversatile heritage"`.
* `selectable` is the **max times the feat may be taken** (`99` = unlimited), not a
  boolean.
* Prerequisites are structured in four columns (`req_abilities` uses `£` as the
  separator, `req_feats`/`req_specials` use `&`) plus two display-only text columns.
* Archetypes are not a separate subsystem: they are `feats_archetype` rows with an
  `archetype` column, gated by the `Dedication` trait and `req_feats` chains.

### 3.4 Spells — the most intricate part

* **Casters are hard-coded in the bundle**, one Kotlin class each, carrying a literal
  20×11 `Int32Array` slot table indexed by `[level-1][rank]`. There is no formula;
  a clone must copy the tables.
* 26 named casters (Cleric, Cleric Font, Wizard, Witch, Magus, Sorcerer, Bard, Oracle,
  Druid, Psychic, Summoner, Animist ×2, Necromancer, plus archetype/item casters
  `Innate`, `Other Spells (Staves etc)`, `Eldritch Archer`, `Deific Power`, …).
* **Prepared vs spontaneous is a property of the caster definition, not the character.**
  Only the consequences are stored.
* Per-character spells live in one flat map: `"<Caster>&<rank>&<index>"` →
  `{spellList, spellName, heighten}`. `spellList` is an int (0 Arcane, 1 Divine,
  2 Occult, 3 Primal, 4 Witch, 5 Elementalist, 6 Nonstandard).
* Cantrips are rank `0` in storage but rank `1` in the data file.
* Spell membership comes from `spellist_*` / `spelllist_*` tables, not from the
  `spells.traditions` column (which is human-readable text only).

### 3.5 UI

* **8 fixed main tabs** — Weapons, Defense, Gear, Spells, Pets, Details, Feats, Actions
  — plus up to two class-specific `.submenu` rows (Wizard contributes `Wizard | Rituals`).
* **Build column** with one accordion section per level; each level holds a row of
  **cog buttons** (the single most repeated control) carrying a *remaining count*.
* **Sidebar** with 25 links in 7 groups, plus mode buttons and the dark/light switch.
* **Two widget families cover almost everything**: the cog button (`VT`) and the
  listview dialog (`Au`).
* Dialogs are created on demand and appended to `<body>`; the primary footer button is
  labelled `Finished` (commit) while `Cancel` discards silently.
* Three different click-handling idioms coexist, including a reverse-map lookup
  (`map[element] = value`, resolved by walking `parentElement`). This is why synthetic
  clicking is unreliable and why the original is essentially unautomatable and
  un-clickable by keyboard.

### 3.6 Rules engine

* Proficiency ranks are the literal numbers `0/2/4/6/8`; the proficiency bonus is
  `rank + level` (`rank` alone under Proficiency Without Level).
* One modifier pipeline with six typed bonuses (`Item`, `Status`, `Circumstance`,
  `Untyped`, `Racial`, `Potency`) and standard typed non-stacking.
* Derived statistics: HP, AC (10 + prof + capped Dex + item + shield), saves,
  perception, skills (with armour check penalty), class DC, spell DC/attack, bulk
  (`5 + Str` encumbered, `10 + Str` max, adjusted by size), speed.
* Most feats are **descriptive only**. Only a curated subset change numbers, and those
  are implemented as id-keyed hooks — the single largest maintenance liability in the
  original codebase.
* There are **two offset action-cost enums** (data `4`=1–3, `5`=1–2, `7`=2–3 vs
  internal `4`=1–3, `5`=1–2, `6`=2–3). Reading the data column without normalising
  mislabels 2–3-action activities.

### 3.7 Scope boundaries (what Pathbuilder does *not* do)

No grid, no encounter sim, no action economy tracking, no automatic damage/condition
expiry, no rules validation beyond prerequisites. It is a character *sheet builder*, not
a VTT. A clone should respect that scope.

---

## 4. Documentation map

| Document | Contents |
| --- | --- |
| [00-overview.md](./docs/00-overview.md) | Executive summary, key findings, file inventory |
| [01-architecture.md](./docs/01-architecture.md) | Hosting, boot sequence, bundle structure, storage, third-party services, Starfinder mode |
| [02-data-files.md](./docs/02-data-files.md) | Encoding, all 245 tables grouped with columns, source-book codes, rebuild recipe |
| [03-character-model.md](./docs/03-character-model.md) | All ~125 fields, every map's key format, export JSON shape, clone-critical subset |
| [04-spell-system.md](./docs/04-spell-system.md) | Casters, exact slot tables, storage keys, pickers, heightening, per-class behaviour |
| [05-feat-system.md](./docs/05-feat-system.md) | Tables, id conventions, column semantics, prerequisites, archetypes, custom feats |
| [06-ui-architecture.md](./docs/06-ui-architecture.md) | DOM contract, every screen and dialog, widget inventory, **55 screenshots** |
| [07-rules-engine.md](./docs/07-rules-engine.md) | Constants, modifier pipeline, derived stats, variant rules, scope boundaries |
| [08-export-and-integrations.md](./docs/08-export-and-integrations.md) | IndexedDB/localStorage, companion pages, export JSON, share, Drive, Firebase, payments |
| [09-clone-blueprint.md](./docs/09-clone-blueprint.md) | Recommended architecture, content pipeline, milestones, testing, risks |
| [10-pathfinder-2e-rules.md](./docs/10-pathfinder-2e-rules.md) | **Pathfinder 2e rules primer sourced from Archives of Nethys**, plus the Pathbuilder-vs-AoN divergence table |
| [11-legal-and-licensing.md](./docs/11-legal-and-licensing.md) | US law on building a functionally-similar product, JSON compatibility, naming, OGL/ORC |

---

## 4a. Rules primer and AoN audit

Document [10-pathfinder-2e-rules.md](./docs/10-pathfinder-2e-rules.md) was added after
the reverse-engineering work. It is a rules primer written from
[Archives of Nethys](https://2e.aonprd.com/) (the official licensed SRD for Pathfinder
2e) covering checks and degrees of success, attribute modifiers and the partial-boost
rule, proficiency ranks, character creation order, leveling up, derived statistics,
actions, equipment and Bulk, spellcasting, conditions, Hero Points, and variant rules.

**AoN is the source of truth.** Where the primer and docs 01–09 disagree about *rules*,
the primer wins. Where the app deliberately behaves differently from the rules, both
facts are preserved — the descriptions of app behaviour stay accurate, and the
divergence is recorded in the primer's §13 table.

### Errors found and corrected in this audit

| Doc | Error | Correction |
| --- | --- | --- |
| 02 | `items_weapons.weaponProficiency` mapped as `0`=unarmed, `1`=simple, `2`=martial, `3`=advanced | Verified by row contents: **`0`=simple (41 rows), `1`=martial (182), `2`=advanced (38), `3`=unarmed (20)** |
| 03 | "PF2e has no partial boosts" | **Wrong.** AoN: above +4 a boost is a *partial* boost; two boosts per +1. Pathbuilder models it (`▲` on odd scores) |
| 03 | Level table omitted 1st-level free boosts/class feat placement, dropped the 1st-level ancestry feat, and merged general feat + skill increase levels | Rebuilt from the **Fighter advancement table** on AoN |
| 03 | Bulk: "`L` items halved" | **Wrong.** Light = **one tenth** (ten light items = 1 Bulk), fractions rounded down |
| 04 | "cantrips are always rank 1 in the data" | **Not universally true.** 18 of 123 cantrips are printed at ranks 2/3/5/7 (*Allegro* is **Cantrip 7**) |
| 06 | Screenshot provenance claimed a Dwarf Cleric | Captures were made with a **Fighter** loaded; noted as a caveat |
| 07 | HP formula `× (level − 1)` for the per-level term | **Off by the Constitution modifier.** Con applies **at 1st level too**; correct form is `ancestryHP + (classHP + Con) × level` |
| 07 | AC formula added `(level if not PWL)` on top of `proficiencyBonus()` | **Double-counted level.** `proficiencyBonus()` already includes it |
| 07 | Skill armour check penalty written with `+` | It is a **penalty** — subtracted |
| 07 | Encumbered code excerpt claimed a `+5 ft` effect | **Wrong.** `dqi(level, -10, 3, 5)` = **−10 ft to all Speeds**, matching AoN; the `+5` in that routine is an armour-feat correction |
| 07 | Speed modelled as one number | Speed is **per movement type** (land/swim/climb/burrow/fly + an "all" bucket) |
| 05 | Level cadence table merged skill *feats* and skill *increases* into one "Skill" column, claimed `1 (+2 from ancestry)` at level 1, and omitted the 10th-level skill feat | Rebuilt with separate columns from the Fighter table |
| 07 | Size constants said `Medium = 4` | **Wrong.** Stored/exported ordinals are `0`=Tiny, `1`=Small, **`2`=Medium**, `3`=Large, `4`=Huge, `5`=Gargantuan. `r2z_1` (the 9-name display array) is **not** indexed by these values — a two-step shift |
| 07 | Proficiency Without Level described as level-free only | AoN also specifies **−2 for untrained**, which Pathbuilder does **not** implement — recorded as a divergence |
| 07 | Bulk size adjustment omitted Gargantuan | Added (`×8`) |
| 08 | Export `attributes`/`size` semantics undocumented | Added: `attributes` are **raw** (no Con, no ×level) and `bonushp`/`bonushpPerLevel` are both **per-level** values despite their names; export `size` is the **ordinal**, and `ancestries_new.size` is **text** — the two must not be mixed |
| — | XP described as cumulative | XP is a **running remainder** (1 000 XP, then subtracted) |

### Deliberate Pathbuilder deviations from the rules

Only **two** affect arithmetic; the rest are scope choices and are documented as such:

1. **Proficiency Without Level has no −2 untrained penalty** (AoN specifies one).
2. **Two non-canonical bonus types** (`Racial Bonus`, `Potency Bonus`) exist alongside
   the canonical four. Harmless as long as they don't collide with Item/Status/
   Circumstance/Untyped.

Everything else — encumbrance, cantrip heightening, focus pool cap, partial boosts,
Bulk conversions, armour penalties — conforms to AoN.

---

## 5. Recommendations for the rewrite

1. **Keep the character JSON shape.** It is the migration path; preserving field names
   and the JSON-string-in-IndexedDB convention means existing users lose nothing.
2. **Compile the content, don't parse it at boot.** Ship a pre-built typed index rather
   than repeating the 4 MB LZ-string + CSV decode on every load.
3. **Make the rules engine pure.** `derive(character, content) → Derived` with no DOM
   access is the thing the original cannot do and the single biggest quality lever.
4. **Copy the caster slot tables literally.** They are data, not derivable.
5. **Keep the UX skeleton**: build column + tabbed sheet, level accordion, cog buttons
   with remaining counts, listview dialogs with `Finished`. It is genuinely good.
6. **Replace the DOM layer** with real components and real `<button>`/`<dialog>`
   elements. The original is inaccessible and untestable; do not inherit that.
7. **Cross-check with export JSON.** Build the same character in both apps and diff the
   export — that is the highest-value test available, and it is possible precisely
   because the export format is stable and complete.
8. **Ship the builder first.** Pets, variant rules, custom content, sharing, GM mode and
   Starfinder are all separable.

---

## 6. Caveats

* Some `SpellCaster` fields (`o22_1`, `u22_1`, `v22_1`, `y22_1`, `z22_1`) could only be
  characterised by their observed effects, not by name; they are documented as flags
  with their observed behaviour.
* `items_all.type` is documented with all 13 observed values mapped to the category
  labels used by the UI; a few sub-categories are inferred from name patterns rather
  than an explicit enum table in the code.
* Rules text (`text_descrip`, spell `description`) was deliberately **not** transcribed.
  Archives of Nethys is the source for that, both for licensing and for accuracy.
* Screenshots were taken against a **Fighter** build, not the Dwarf Cleric used for the
  narrative walkthroughs (see the provenance note in
  [docs/06-ui-architecture.md](./docs/06-ui-architecture.md)). Classes with very
  different sheet layouts (Summoner with an eidolon, Alchemist with a formula book,
  Kineticist with impulses) will render additional sections not pictured.
