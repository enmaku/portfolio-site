# 04 — Spell System

The spell system is the most intricate part of the app. It has four layers:

1. **Spell data** — `spells`, `spells_*`, `spellist_*` / `spelllist_*` tables (see
   [02-data-files.md](./02-data-files.md)).
2. **Caster definitions** — hard-coded in the bundle, one Kotlin class per caster,
   each carrying a **per-level slot table**.
3. **Per-character spell storage** — `hashMapPlayerSpells`, `hashMapKnownSpellsByCaster`,
   `hashMapSpontaneousSpellsCast`, bonus-slot maps.
4. **Rendering** — a "Spells" tab with one column per caster, split into
   Cantrips / 1st / 2nd … 10th.

## 1. Data model

### 1.1 `spells` table

```
name, type, level, traits, traditions, actions, cast, description, description2,
var1, var2, var3, var4, shortDes, src, url, target, duration, range, save, area
```

| Column | Notes |
| --- | --- |
| `name` | Primary key (spells are referenced by name everywhere) |
| `type` | `""` (9 rows), `"Cantrip"` (123), `"Focus"` (417), `"Spell"` (830) |
| `level` | 1–10 for spells. **Cantrips are *mostly* `1` but not always** — see note below |
| `traditions` | Human-readable list, e.g. `"Traditions arcane, divine, occult"` — **informational only**; membership is determined by the `spellist_*` tables |
| `actions` | `-1` free, `0` reaction, `1`/`2`/`3` = 1/2/3 actions, `4` = 1–3 actions, `5` = 1–2 actions, `7` = 2–3 actions. Verified against `ki2()` in the bundle (bundle line 28480). |
| `cast` | Casting components when non-default (`"somatic, verbal"`, `"verbal"`, or a cast time like `"1 minute"`) |
| `var1..var4` | Free-form variants (heightening text, etc.) |
| `target`,`duration`,`range`,`save`,`area` | Structured stat-line fields (mostly empty; most data lives in `description`) |

Spells are **not** keyed by an id — the name is the key. Two different lists can
contain the same spell name, which is why the per-character storage records a

**Cantrip levels are not always 1.** 105 of 123 cantrip-typed rows have `level=1`,
but 18 do not, because some cantrips are printed at a higher rank and therefore
auto-heighten from that floor:

| `level` | Count | Examples |
| --- | --- | --- |
| `1` | 105 | *Detect Magic*, *Shield*, *Telekinetic Projectile* |
| `2` | 2 | *Rallying Anthem*, *Triple Time* |
| `3` | 8 | *Dirge of Doom*, *Ghostly Shift*, *Song of Marching*, *Shatter Mind* |
| `5` | 7 | *House of Imaginary Walls*, *Dancing Blade*, *Tesseract Tunnel* |
| `7` | 1 | *Allegro* |

AoN prints these as e.g. "Allegro \[one-action] **Cantrip 7**", confirming the
data is faithful to the source. **The practical rule:** a cantrip's effective rank is
`max(spell.level, ceil(characterLevel/2))`, so a rank-5 cantrip is unusable until
9th level. Do not assume `level==1` when computing heightening.
`spellList` alongside the name.

### 1.2 Spell-list tables

Membership in a tradition is a separate table:

| Table | Rows | Tradition index |
| --- | --- | --- |
| `spellist_arcane` | 981 | 0 |
| `spellist_divine` | 559 | 1 |
| `spelllist_occult` | 828 | 2 |
| `spelllist_primal` | 734 | 3 |
| `spellist_elemental` | 160 | 5 (Elementalist) |
| `spelllist_elemental_universal` | 50 | 5 |
| `spellist_nonstandard` | 1 | 6 |

Each row is `(name, level, outdated)`. `outdated` marks Remaster-renamed spells; they
are hidden unless the character has `useUpdatedSpells = false` or the user enables
"Allow Outdated Spells".

> ⚠ **Inconsistent spelling in the shipped data**: `spellist_` for arcane/divine/
> elemental/nonstandard, `spelllist_` for occult/primal/elemental_universal. A clone
> should read both spellings or normalise on load.

### 1.3 Tradition and list index enum

```
0 = Arcane
1 = Divine
2 = Occult
3 = Primal
4 = Witch (patron-granted; uses the patron's tradition but is a distinct list)
5 = Elementalist
6 = Nonstandard
```

`o1x_1 = ["Arcane","Divine","Occult","Primal"]` is the *display* array; there is no
display name for 4–6 because those lists are always shown under a caster column.

### 1.4 Other spell tables

| Table | Purpose |
| --- | --- |
| `spells_bloodlines` | Sorcerer bloodline auto-known spells, one row per bloodline, with `sCantrip`,`s1st`…`s9th`, `initialSpell`,`advancedSpell`,`greaterSpell` |
| `spells_bloodlines_draconic` | Draconic bloodline per-dragon-type spells |
| `spells_apparitions` | Animist apparition spell lists |
| `spells_domain` | Domain → initial + advanced domain spell |
| `spells_runes` | Rune-spell definitions |
| `spells_mythic` | Mythic spells |
| `rituals` / `rituals_mythic` | Rituals (stored in `listRituals`, not the caster maps) |

## 2. Caster definitions

### 2.1 The `SpellCaster` class (`GKi`)

```
r22_1 = name                  (e.g. "Cleric")
s22_1 = type                  0 = spontaneous, 1 = prepared
p22_1 = tradition index       0..6
w22_1 = ?                     (true for casters without a spellbook — suppresses
                               the "known spells" click target)
t22_1 = ability index         0=Str…5=Cha (casting ability)
v22_1 = level offset          (used by trickster-style casters)
l22_1 = per-level slot table  Int32Array[ 20 levels × 11 ranks ]
m22_1 / n22_1 = alternate slot tables (e.g. Cleric font, Psychic)
o22_1 = ?                     suppress repertoire UI
u22_1 = ?                     allow item/scroll entry
x22_1 = ?                     archetype caster
y22_1 / z22_1 = ?             caster-specific flags
q22_1 = ?                     "uses spellbook" flag
```

`l22_1[level-1]` is an `Int32Array(11)` indexed by **spell rank 0…10**
(0 = cantrips, 1..9 = ranks, 10 = 10th-rank). Each entry is the base number of slots;
`-1` means "cannot cast this rank".

Constructor helpers:

```js
FKi(name, type, tradition, w22_1, ability, target)          // 6 args
HKi(name, type, tradition, w22_1, ability, v22_1, target)   // 7 args (adds v22_1)
```

### 2.2 Named casters (verbatim from the bundle)

| Caster | type | tradition | ability | Notes |
| --- | --- | --- | --- | --- |
| `Animist Prepared` | 1 prepared | 1 Divine | 4 Wis | |
| `Animist Apparition` | 0 spontaneous | 1 Divine | 4 Wis | |
| `Bard` | 0 spontaneous | 2 Occult | 5 Cha | |
| `Cleric` | 1 prepared | 1 Divine | 4 Wis | |
| `Cleric Font` | 1 prepared | 1 Divine | 4 Wis | extra heal/harm slots |
| `Cleric Battle Harbinger` | 1 prepared | 1 Divine | 4 Wis | |
| `Cleric Battle Harbinger Font` | 1 prepared | 1 Divine | 4 Wis | |
| `Druid` | 1 prepared | 3 Primal | 4 Wis | |
| `Magus` | 1 prepared | 0 Arcane | 3 Int | `q22_1 = true` (spellbook) |
| `Necromancer` | 1 prepared | 2 Occult | 3 Int | custom slot table |
| `Oracle` | 0 spontaneous | 1 Divine | 5 Cha | |
| `Psychic` | 0 spontaneous | 2 Occult | 3 Int | |
| `Sorcerer` | 0 spontaneous | 0 Arcane* | 5 Cha | tradition is overridden by bloodline |
| `Summoner` | 0 spontaneous | 0 Arcane* | 5 Cha | tradition from eidolon |
| `Witch` | 1 prepared | 0 Arcane* | 3 Int | tradition from patron; `q22_1 = true` |
| `Wizard` | 1 prepared | 0 Arcane | 3 Int | `q22_1 = true` (spellbook) |
| `Mystic` / `Technomancer` / `Witchwarper` | — | — | — | Starbuilder casters |
| `Innate` | 1 prepared | * | 5 Cha | item/ancestry innate spells |
| `Other Spells (Staves etc)` | 1 prepared | 0 | 5 | `o22_1 = true` — free-form rank entry |
| `Thaumaturge Scrolls` | 1 prepared | 0 | 5 | |
| `Eldritch Archer` | 0 spontaneous | 0 | 5 | archetype caster |
| `Cathartic Mage` | 0 spontaneous | * | 5 | archetype caster |
| `Deific Power` | 1 prepared | 1 Divine | 5 | |
| `Creed Magic` | 1 prepared | 1 Divine | 4 | |
| `Eidolon` | 1 prepared | * | 5 | |

\* `Sorcerer`/`Summoner`/`Witch` take their real tradition from the subclass
(bloodline / eidolon / patron); the constructor value is only a default.

### 2.3 Slot tables

The default table (`GKi`) is built from 20 `Int32Array`s. Base pattern for a
full 9-rank prepared caster:

```
level  1: [5, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1]   // 5 cantrips, 2 first-rank
level  2: [5, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1]
level  3: [5, 3,  2, -1, -1, -1, -1, -1, -1, -1, -1]
level  4: [5, 3,  3, -1, …]
level  5: [5, 3,  3,  2, -1, …]
…
level 19: [5, 3, 3, 3, 3, 3, 3, 3, 3, 3, -1]
level 20: [5, 3, 3, 3, 3, 3, 3, 3, 3, 3,  1]   // 10th-rank slot
```

Spontaneous casters get a different table where the lowest ranks collapse as they
heighten (a Bard's table, for example, ends at `[4,2,2,2,2,2,2,2,2,1,1]` at 20).
Subclasses override the table entirely:

* `Cleric Battle Harbinger` replaces it with a wave-1 slot table (`[5,1,…]`,
  `[5,2,…]`, …).
* `Necromancer` uses `DKi().j6n_1`.
* A generic partial caster (`gKi(name, type, tradition, ability, levelOffset)`) builds a
  table where ranks only open once the character is high enough
  (`a >= (offset-1)` → `[-1,-1,2,-1,…]`).

Because the tables are literal `Int32Array`s you can reproduce them exactly; they are
**not** derived from a formula.

### 2.4 Adding a caster to a character

Casters are not stored as a list. The character's caster list is **derived** from the
class + feats + specials, then each caster's per-character data is looked up by name
in the `hashMap*ByCaster` maps. An "other caster" is enabled by the `otherCaster`
field (used for staves/scrolls).

## 3. Per-character spell storage

### 3.1 `hashMapPlayerSpells`

The single source of truth for a character's spells.

```
key   = "<CasterName>&<rank>&<index>"
value = { spellList: <int>, spellName: "<name>", heighten: <int> }
```

Example from a real Summoner save:

```json
{
  "Summoner&0&0": {"spellList": 3, "spellName": "Needle Darts",   "heighten": 0},
  "Summoner&0&1": {"spellList": 3, "spellName": "Glass Shield",  "heighten": 0},
  "Summoner&1&0": {"spellList": 3, "spellName": "Animal Allies", "heighten": 0},
  "Summoner&1&1": {"spellList": 3, "spellName": "Interposing Earth","heighten": 0}
}
```

* `rank` is `0` for cantrips, `1`–`10` for spell ranks.
* `index` is the slot ordinal within that rank (0-based).
* `spellList` records which list the spell was picked from — needed because the same
  name can belong to several traditions.
* `heighten` is the number of steps the spell is heightened by (0 = base rank). For
  spontaneous casters this is set by casting at a higher rank; for prepared casters
  the rank is implied by the slot key.

**Prepared vs spontaneous** is expressed purely by how many entries exist: a prepared
caster has exactly one entry per slot the table grants, a spontaneous caster has an
entry per *known spell* (their slots are then consumed via
`hashMapSpontaneousSpellsCast`).

### 3.2 `hashMapKnownSpellsByCaster`

```
{ "<CasterName>": ["Shield", "Detect Magic", …] }
```

The spellbook / repertoire — i.e. what the character *knows*, before preparing. For
Wizard/Witch/Magus this is the spellbook contents; for Sorcerer/Bard/Oracle it is the
repertoire.

### 3.3 `hashMapSpontaneousSpellsCast`

```
{ "Summoner": { "1": 0 } }
```

Per-caster, per-rank count of slots expended today. Reset by the "Rest" button
(top bar).

### 3.4 Bonus slot maps

| Field | Shape | Purpose |
| --- | --- | --- |
| `hashMapBonusSpellSlots` | unknown | extra slots granted by feats |
| `hashMapBonusSpellPerDay` | unknown | extra castings per day (innate-style) |
| `hashMapBonusSpellPrepared` | unknown | extra prepared spells |
| `hashMapRepertoireOverride` | unknown | manual repertoire override |
| `hashMapSpellBlending` | unknown | Summoner spell blending (swap repertoire slots) |
| `hashMapSignatureSpellsMultiple` | unknown | multiple signature spells for spontaneous casters |

### 3.5 `hashMapFormulaBookByCaster` / `listPlayerFormula`

Alchemist-only: known formulas (`listPlayerFormula`) and the per-caster formula book
(`hashMapFormulaBookByCaster`).

### 3.6 Focus spells and points

* `focusPoints` — current pool (0–3).
* `focus` — map of granted focus spells by source (domain, bloodline, order, …).
* `spentSpellPoints` — focus points spent.
* Domain spells come from `spells_domain`; bloodline focus spells from
  `spells_bloodlines` (`initialSpell`, `advancedSpell`, `greaterSpell`).

`FocusSpellDetails` in the export has `abilityBonus`, `proficiency`, `itemBonus`,
`focusCantrips`, `focusSpells`.

## 4. The spell picker UI

### 4.1 Structure

Two different pickers exist:

**A. "Known spells" picker (`Spell Browser` / repertoire edit).** A listview dialog
whose rows are `name` + rank, filtered by the caster's tradition lists. Selecting a row
writes into `hashMapKnownSpellsByCaster`.

**B. "Add spell" picker (prepared casters / slot filling).** Opened from a specific
slot; the resulting entry goes into `hashMapPlayerSpells` at
`"<caster>&<rank>&<index>"`.

Both use the same listview widget (`Au`) with:

* `.div-listview-scroller` — the scrollable row container
* `.listview-item` → `.listview-topdiv` → `.listview-title` (+ `.listview-item-level`)
* `.listview-detail` — description, revealed on click
* `.div-listview-info` — the right-hand detail pane
* Footer buttons: `Accept`, `Cancel`, `PRD`, `Clear`

> **Interaction detail (learned the hard way):** selection is driven by the
> `listview-topdiv` click handler `ju(i, target)` which walks `parentElement` until it
> finds an element in the `qj8_1` map, then adds `.listview-topdiv-selected`. Synthetic
> clicks that land on a child of `.listview-topdiv` *do* work; clicks that land on
> `.listview-detail` do not, and clicks on a `*.prof-layout` row in the skill dialogs
> were unreliable because the handler map is keyed by the row element and hit-testing
> could resolve to a sibling. When automating, aim at the centre of
> `.listview-topdiv`.

### 4.2 Filtering

The listview header supports:

* Search box (`placeholder "search"`) matching by `Names`, `Traits`, or `Other`
  (`Jv` class → `ijf(["Names","Traits","Other"])`).
* A filter icon (`icon_filter.png`) that toggles the facet panel
  (`.content-listview-filtered`).
* Trait chips (`.trait`, `.trait-common`, `.trait-uncommon`, `.trait-rare`,
  `.trait-unique`, `.trait-third`) that are themselves clickable filters.

### 4.3 Spells tab layout

The Spells tab renders one **column per caster** (`SpellCaster`), each containing:

* Caster header: name, tradition, DC/attack, proficiency, ability
* One section per rank present, headed `["Cantrips","1st","2nd",…,"9th","10th"]`
* Per-rank rows of slots; empty slots render as clickable placeholders
* For prepared casters, the prepared list and the spellbook are separate sections
* For spontaneous casters, "Known" vs "Cast" counters

The class-specific submenu (e.g. `Wizard` | `Rituals`) appears as a second row of
`.section-menu` items under the main tab bar — it is populated per class and can be
absent.

## 5. Heightening

* `hashMapPlayerSpells[k].heighten` = number of rank steps added.
* A spell's effective rank = `max(spell.level, slotRank)`; cantrips auto-heighten to
  `ceil(level/2)`.
* Focus spells auto-heighten to `ceil(level/2)` as well.
* The `prefAutoHeighten` setting controls whether the UI auto-selects the heightened
  rank when a spell is added to a higher slot.
* `useUpdatedSpells` selects the Remaster spell text; `spells_*.outdated` filters the
  legacy names.

## 6. Innate and item spells

* `Innate` caster holds ancestry/feat-granted spells; `HashSet`-style dedupe
  (`he7_1`).
* `Other Spells (Staves etc)` is a free-form caster with `o22_1 = true`, letting the
  user enter any spell at any rank — this is how staves, scrolls and wands are
  represented on the sheet.
* Wands/staves/scrolls in inventory do **not** auto-add spells; the user adds them
  through the Other Spells column (or the item's own "add spell" affordance for
  wands).

## 7. Proficiencies and DCs

Per tradition there is a separate proficiency (`castingArcane`, `castingDivine`,
`castingOccult`, `castingPrimal`), using the same rank numbers as skills. Then:

```
spell DC        = 10 + proficiencyBonus + abilityMod + itemBonus
spell attack    =      proficiencyBonus + abilityMod + itemBonus
proficiencyBonus = rank + level        (rank 0 if untrained; 0 if proficiency-without-level)
```

`XDi().t36(character, rank, level)` implements it:

```js
t36(character, rank, level) {
  return character.addLevelToProficiency ? (rank > 0 ? rank + level : 0) : rank;
}
```

## 8. Special caster behaviours worth cloning

| Caster | Behaviour |
| --- | --- |
| **Cleric** | Two extra font slots (`Cleric Font` caster) in addition to the normal table; font is Heal or Harm chosen in `hashMapSpecialSelections["Divine Font"]` |
| **Wizard / Witch / Magus** | Have a spellbook (`hashMapKnownSpellsByCaster`); must *learn* before preparing. `q22_1 = true` |
| **Sorcerer** | Repertoire only; bloodline grants bonus known spells at fixed levels |
| **Oracle** | Repertoire + mystery bonus spells + curse progression |
| **Psychic** | Repertoire, but cantrips and psi cantrips are separate; `m22_1` alternate table for psi amps |
| **Summoner** | Repertoire, but slots come from the eidolon; `hashMapSpellBlending` lets you swap repertoire entries |
| **Druid / Cleric / Animist** | Prepared, full list access, no spellbook |
| **Bard** | Spontaneous, full occult list access (no repertoire limit on *which* spells exist, only on how many are known) |
| **Magus** | Prepared spellbook, but half-caster slot progression |
| **Thaumaturge** | Scroll-only caster; uses `Thaumaturge Scrolls` |
| **Animist** | Two casters: `Animist Prepared` (daily) + `Animist Apparition` (spontaneous from apparitions) |

## 9. Things a clone must get right

1. **Name is the key.** Spells have no id; the same name appears in multiple lists.
   Always carry `spellList` with the name.
2. **Slot tables are literal data**, not formulas. Copy them.
3. **Cantrips are rank 0** in storage but their data `level` is their printed cantrip
   rank — usually `1`, sometimes higher (see the cantrip-levels note in §2).
4. **The `spellist`/`spelllist` spelling split** is real; read both.
5. **Prepared ≠ spontaneous is not a stored flag on the character** — it comes from the
   caster definition. Only the *consequences* (slot entries vs known entries) are
   stored.
6. **Slots are indexed by rank, not by level.** `l22_1[level-1][rank]`.
7. **Bonus slots are additive** on top of the table, not replacements.
8. **Focus points are capped at 3** and only refill on Rest.
9. **Domain/bloodline/patron spells are granted, not chosen** — they must appear
   without consuming slots.
10. **`Other Spells` is a real caster** and the escape hatch for everything unusual
    (staves, scrolls, custom spells).
