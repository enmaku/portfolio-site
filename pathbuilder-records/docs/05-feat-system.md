# 05 — Feat System

Feats are the main rules-delivery mechanism in Pathbuilder. Almost everything a
character can do that is not a base class proficiency comes from a feat entry, an
archetype feat, or a "special" (class feature). All three share one internal model:
`FeatInformation` / `FeatChoice`.

## 1. Where feats live

| Table group | Count | Notes |
| --- | --- | --- |
| `feats_ancestry_<ancestry>` | 42 | One per ancestry, e.g. `feats_ancestry_dwarf` |
| `feats_heritage_<ancestry>` | 42 | Heritages (+ `feats_heritage_versatile`) |
| `feats_class_<class>` | 29 | One per class (+ Starbuilder classes) |
| `feats_archetype` | 1 | Every archetype feat, with an `archetype` column |
| `feats_general` | 1 | General **and** skill feats |
| `feats_aftermath_deviant` | 1 | Aftermath + Deviant |
| `feats_mythic` | 1 | Basic mythic feats |
| `feats_mythic_destinies` | 1 | Mythic destiny feats |

Two column-signature variants exist inside each group; the app does not care, it
reads by column *name* (see the field map at bundle line 52537).

## 2. The `id` convention

`id` is the **stable key** and is what gets written into `hashMapFeatSelections`.
Shape:

```
<PREFIX>_<Display Name>
```

Examples:

```
WIZARD_Counterspell
WIZARD_Reach Spell
DWARF_Dwarven Lore
DWARF_Rock Dwarf                ← heritages use the ancestry prefix
GENERAL_Fleet
GENERAL_Additional Lore
HUMAN_Versatile Heritage
ARCHETYPE_Bard Dedication
ARCHETYPE_DRAGON_MAGE_Dragon Arcana      ← archetype + archetype code
SUMMONER_Glider Form
BACKGROUND_Acolyte              ← backgrounds share the shape
CLERIC_Domain Initiate
```

Prefix inventory (`grep -oE '\b[A-Z]{2,}[A-Z_]+_'` over the bundle):

* Ancestry: `DWARF_`, `ELF_`, `HUMAN_`, `GNOME_`, `GOBLIN_`, `HALFLING_`, `ORC_`,
  `LESHY_`, `CATFOLK_`, `KOBOLD_`, `RATFOLK_`, `TENGU_`, `ANADI_`, `ANDROID_`,
  `AASIMAR_`, `AUTOMATON_`, `CENTAUR_`, `MERFOLK_`, `MINOTAUR_`, `SURKI_`,
  `SAMARAN_`, `TANUKI_`, `WAYANG_`, `YAKSHA_`, `YAOGUAI_`, `DRAGONET_`, `BUGBEAR_`,
  `FAUN_`, `GREMLIN_`, `NYMPH_`, `SPRITE_`, `STRIX_`, `KASHIISHI_`, `NAGAJI_`,
  `VANARA_`, `VISHKANYA_`, `GHORAN_`, `GOLOMA_`, `GRIPPLI_`, `SHISK_`, `CONRASU_`,
  `FETCHLING_`, `FLESHWARP_`, `KITSUNE_`, `AZARKETI_`, `GNARE…`, `JOTUNBORN_`,
  `AWAKENED_ANIMAL_`, `ATHAMARU_`, `BUGBEAR_`, `DRAGONKIN_`, `IKESHTI_`, `KALO_`,
  `KHIZAR_`, `LASHRUNTA_`, `MADROSARAI_`, `MARAQUOI_`, `MECENAIC_`, `MOYISHUU_`,
  `NOVIAN_`, `OROCORAN_`, `OSHARU_`, `PAHTRA_`, `PHASORQ_`, `RAXILITE_`, `RYPHORIAN_`,
  `SAMSARAN_`, `SARANGAY_`, `SARCESIAN_`, `SHIRREN_`, `SHOBHAD_`, `SKITTERMANDER_`,
  `SRO_`, `TALPHI_`, `TROX_`, `UROG_`, `VESK_`, `VLAAKA_`, `VULKARISU_`, `WORLANISI_`,
  `YSOKI_`
* Class: `ALCHEMIST_`, `ANIMIST_`, `BARBARIAN_`, `BARD_`, `CHAMPION_`, `CLERIC_`,
  `COMMANDER_`, `DRUID_`, `EXEMPLAR_`, `FIGHTER_`, `GUARDIAN_`, `GUNSLINGER_`,
  `INVESTIGATOR_`, `INVENTOR_`, `KINETICIST_`, `MAGUS_`, `MONK_`, `NECROMANCER_`,
  `ORACLE_`, `PSYCHIC_`, `RANGER_`, `ROGUE_`, `RUNESMITH_`, `SORCERER_`, `SUMMONER_`,
  `SWASHBUCKLER_`, `THAUMATURGE_`, `WITCH_`, `WIZARD_`
* Other: `GENERAL_`, `ANCESTRY_`, `ANCESTRY_GENERAL_`, `AFTERMATH_`, `MYTHIC_`,
  `ARCHETYPE_*_`, `BACKGROUND_`, `CUSTOM_`, `SF_*` (Starbuilder)

Archetype feats use a **nested** prefix: `ARCHETYPE_` `<ARCHETYPE_CODE>` `_` `<Name>`,
where the code is the archetype name upper-snake-cased
(`ARCHETYPE_DRAGON_MAGE_`, `ARCHETYPE_BULLET_DANCER_GUNSLINGER_`, `ARCHETYPE_FIVE_BREATH_`).

## 3. Column semantics

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | string | `"<PREFIX>_<Name>"` — the storage key |
| `name` | string | Display name |
| `level` | int | Minimum character level |
| `traits` | csv | Trait list, e.g. `"Arcane,Wizard"` |
| `actions` | int | `-1` free, `0` reaction, `1`/`2`/`3` = 1/2/3 actions, `4` = 1–3 actions, `5` = 1–2 actions, `7` = 2–3 actions. `-2` = hide the icon. Verified against `ki2()` (bundle line 28480). |
| `selectable` | int/blank | **Maximum number of times the feat may be taken.** `99` = unlimited. Blank = once. The bundle stores it as `n2m_1` and tests `takenCount < n2m_1`. |
| `req_abilities` | string | Ability prerequisites |
| `prof_trained` | csv | Skill granted/required at Trained (rank 2) |
| `prof_expert` | csv | … at Expert (4) |
| `prof_master` | csv | … at Master (6) |
| `prof_legendary` | csv | … at Legendary (8) |
| `prof_magic` | int | Magic-tradition proficiency supplied by the feat |
| `pet` | int | Pet/companion granted |
| `req_feats` | csv `&` | Required feat **ids** |
| `req_specials` | csv `&` | Required special names |
| `text_prereq` | html | Prerequisite display text |
| `text_req` | html | Requirement display text |
| `text_descrip` | html | Full description |
| `src` | string | Source book (`PC1`, `PC2`, `CRB`, `APG`, `G&G`, `TV`, `DA`, `WoI`, `SOM`, `IM`, …). Missing ⇒ `"CRB"` |
| `url` | url | AoN link |

### 3.1 `req_abilities` encoding

`&`-separated clauses; each clause is `<abilityIndex>£<minimumScore>`:

```
"2£14"        → Constitution ≥ 14
"0£16"        → Strength ≥ 16
"2£14&4£14"   → Con ≥ 14 AND Wis ≥ 14
```

Ability index: `0=Str, 1=Dex, 2=Con, 3=Int, 4=Wis, 5=Cha`. Parsed at load time
(bundle line 8200) into `hashMapRequiredAbilityScores`.

### 3.2 `req_feats` / `req_specials`

`&`-separated lists of exact ids / special names. Loaded into `p2m_1` / `q2m_1`.

### 3.3 `prof_*` encoding

`&`-separated list of skill/proficiency names. Each becomes an entry in
`hashMapRequiredProficiences` with the rank implied by the column (2/4/6/8).
A feat may both **require** and **grant** a proficiency — the same column is used to
grant, and the prerequisite check reads the *current* character proficiency.

### 3.4 `pet`

Numeric — from `Pets`: `0…n` selects a companion class of pet. Recorded on
`o2m_1` and resolved through `ManagerPets`.

## 4. Feat categories ("feat groups")

The app calls the category a **feat group** (`z23_1`). Categories seen in the export
tuple and in slot names:

```
Ancestry Feat, Heritage, Class Feat, Skill Feat, General Feat, Archetype Feat,
Class Archetype, Dedication Feat, Background Feat, Awarded Feat, Custom Feat,
Eidolon Feat, Aftermath Feat, Mythic Feat, Basic Mythic Feat, Destiny Mythic Feat,
Dragon Feat, <Ancestry> Feat, <Class> Feat, <Ancestry> Heritage, Versatile Heritage,
General Ancestry Feat, Versatile Ancestry Feat, <Starbuilder> Feat, …
```

The exhaustive list is the ~250-constant block in the bundle at line 45261
(`"Fighter Feat"`, `"Rogue Feat"`, … `"Wizard Feat"`, plus one per ancestry heritage).

There is also a *feat group* used for list filtering:
`d2y_1 = ["Fighter Feat","Rogue Feat","Champion Feat",…,"Technomancer Feat"]` — this
is the set of per-class feat groups used by the Feat Browser filter dropdown.

## 5. Slot names and storage

`hashMapFeatSelections[slotName] = "PREFIX_Name"`.

Slot names are **constructed**, not stored in data. Observed shapes:

| Shape | Example | Meaning |
| --- | --- | --- |
| `<Category> Feat` | `"Class Feat"`, `"General Feat"`, `"Skill Feat"` | The generic slot for that category |
| `<Category> Feat <n>` | `"Class Feat 2"` | nth occurrence of the category |
| `<Ancestry> Feat <n>` | `"Dwarf Feat 1"` | Ancestry feat slot for level 1 |
| `<Ancestry> Feat <n><letter>` | `"Dwarf Feat 1a"` | Sub-slot opened by a feat that grants a choice |
| `<ParentSlot><choiceKey>` | `"Heritage Featversatile heritage"` | Child slot named by the parent's selection value, lower-cased |
| `<Class> Feat <n>` | `"Cleric Feat 1"` | Class-specific feat key |
| `"Heritage Feat"` | — | The heritage itself is a feat |
| `"Awarded Feat"` | — | Export-only pseudo-category for free feats |

The `<ParentSlot><choiceKey>` convention is important: when a feat grants a
sub-choice (Versatile Heritage grants any general feat; some feats grant a skill
feat), the child slot's name is the parent slot name with the choice value appended
(raw, not normalised: `"Heritage Feat"` + `"versatile heritage"`), and the child is
tagged `childChoice` in the export.

`hashMapFeatExtraSelections` holds any further nested choices.

## 6. Prerequisite evaluation

Loading (bundle ~8200) parses a CSV row into `FeatInformation`:

```
j2m_1  id              k2m_1  name           l2m_1  level
m2m_1  actions         n2m_1  selectable     o2m_1  pet
p2m_1  reqFeats[]      q2m_1  reqSpecials[]  r2m_1  ?
s2m_1  ?               t2m_1  textDescription
u2m_1  ?               v2m_1  profMagic
w2m_1  src             x2m_1  url
y2m_1  hashMapRequiredProficiences      z2m_1  hashMapRequiredAbilityScores
a2n_1  ?  (-1)         b2n_1  ?          c2n_1  listCustomEffects[]
d2n_1  featGroup ("Custom Feat")        e2n_1  reqClassArchetype
f2n_1  copiedID        g2n_1  "MIDDLE"
```

Availability check for a slot (in order):

1. `level >= feat.level`
2. Every entry of `hashMapRequiredAbilityScores` is satisfied by the current score
3. Every entry of `hashMapRequiredProficiences` is satisfied by the current rank
4. Every id in `reqFeats` is present anywhere in `hashMapFeatSelections`
   (or `hashMapFeatExtraSelections` / custom choices / `listUserBonusFeats`)
5. Every name in `reqSpecials` is present in `hashMapSpecialSelections` / specials list
6. The number of times this feat id already appears `< selectable`

If any check fails the row is either hidden or rendered with
`.warning-text` **"Prerequisites not met or taken too many times!"** (that exact
string is set in `tI()` for the feat row widget).

Additional filters applied *before* prerequisites:

* `listDisabledRulebooks` — hide feats whose `src` is disabled
* `listOptInBooks` — show feats whose `src` is opted in
* `showDedicationFeats` — hide `Dedication`-trait feats when off
* `showAftermathFeats` — hide Aftermath feats when off
* `showMythic` / `mythicAsArchetypes` / `mythicAlternative` — mythic visibility
* `remastered` — hide Remaster-incompatible rows
* `freeArchetype` + `ignoreFreeArcheRest` — relax archetype restrictions
* `hashMapCustomFeatChoices` — user-defined extra slots

## 7. Archetypes

Archetypes are **not a separate storage area** — they are feats in
`feats_archetype` with an `archetype` column, and the code identifies them by the
`Dedication` trait plus the `ARCHETYPE_` id prefix.

Rules the code enforces:

* A Dedication feat must be taken before any other feat of that archetype
  (`req_feats` on the non-dedication rows points at `ARCHETYPE_<X>_<X> Dedication`).
* "You can't take another dedication until you have taken 2 feats from the first"
  — implemented as a count check over the archetype's feats.
* `freeArchetype` adds a free slot; `ignoreFreeArcheRest` removes the restriction
  text, `ignoreFreeArcheAbilityReq` removes ability prerequisites for those slots.
* `classArchetype` / `classArchetypeDual` allow "class archetypes" (e.g. Battle
  Harbinger), which replace class features rather than adding new ones.

`feats_archetype.type` is a numeric `0|1|2` flag distinguishing dedication /
standard / special rows.

## 8. Feat Browser (sidebar)

A standalone tool (`Feat Browser` in the sidebar) that lists every feat in every
table with:

* Tabs / filter dropdown bound to the feat-group list
* Search across `Names` / `Traits` / `Other`
* Level filter
* Trait chips
* Source-book filter honouring `listDisabledRulebooks` / `listOptInBooks`
* Sort by name or level (`prefAlphaOrder`)

It reads the same `FeatInformation` objects; it does not write to the character.

## 9. Custom feats and custom packs

The **Custom** sidebar group lets a user author content that is stored outside the
data file, in IndexedDB `customFiles` / `customBGs`:

| Dialog | Produces |
| --- | --- |
| Custom Ancestry | `CustomAncestry` |
| Custom Heritage | `CustomHeritage` |
| Custom Background | custom background (stored in `customBGs`) |
| Custom Class / Custom Class Feature / Custom Class Trained Skills | custom class |
| Custom Feat / Custom Ancestry Feat | a `FeatInformation` with `d2n_1 = "Custom Feat"` |
| Custom Weapon / Armor / Shield / Equipment / Scroll | custom items |
| Custom Spell / Custom Special / Custom Buff | misc |
| Custom Animal Companion / Custom Eidolon / Custom Specific Familiar / Custom Generic Companion | pets |
| Custom Ability Increases / Custom Skill Increases / Custom Feat Choices / Custom Free Feats | rule overrides |

Custom entries are merged into the same in-memory maps as the shipped data and are
matched by the same prefix scheme (`CUSTOM_`). The **Custom Pack** dialog
exports/imports a bundle of them (`Export Custom Pack`, `Remove Custom Pack`).

Character fields that carry custom content:

* `hashMapCustomAbilityIncreases` — `{level: [delta,…]}`
* `hashMapCustomSkillIncreases` — `{level: count}`
* `hashMapCustomFeatChoices` — extra feat slots
* `listUserBonusFeats` — user-granted feats

## 10. Awarded / free feats

Some sources grant a feat without consuming a slot:

* Backgrounds (`backgrounds.freeFeatID` / `freeFeatDetail`)
* Classes and archetypes (`Awarded Feat`)
* `listUserBonusFeats`
* Custom free feats

These appear in the export as `["<Name>", null, "Awarded Feat", <level>]` and are
rendered as non-editable rows in the build column.

## 11. Skill, general and ancestry feat cadence

Which slots a level offers is derived from the class/special managers, not hard-coded,
but the standard cadence the UI produces is:

| Level | Ancestry feat | Class feat | Skill **feat** | Skill **increase** | General feat | Other |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | — | — | — | heritage, background feat, 4 attribute boosts, initial proficiencies |
| 2 | — | 1 | 1 | — | — | — |
| 3 | — | — | — | 1 | 1 | class feature |
| 4 | — | 1 | 1 | — | — | — |
| 5 | 1 | — | — | 1 | — | 4 attribute boosts, class feature |
| 6 | — | 1 | 1 | — | — | — |
| 7 | — | — | — | 1 | 1 | class feature |
| 8 | — | 1 | 1 | — | — | — |
| 9 | 1 | — | — | 1 | — | class feature |
| 10 | — | 1 | 1 | — | — | 4 attribute boosts |
| 11 | — | — | — | 1 | 1 | class feature |
| 12 | — | 1 | 1 | — | — | — |
| 13 | 1 | — | — | 1 | — | class feature |
| 14 | — | 1 | 1 | — | — | — |
| 15 | — | — | — | 1 | 1 | 4 attribute boosts, class feature |
| 16 | — | 1 | 1 | — | — | — |
| 17 | 1 | — | — | 1 | — | class feature |
| 18 | — | 1 | 1 | — | — | — |
| 19 | — | — | — | 1 | 1 | class feature |
| 20 | — | 1 | 1 | — | — | 4 attribute boosts |

> **Audited against AoN.** An earlier revision of this table had three defects: it
> labelled the level-1 ancestry cell `1 (+2 from ancestry)`, which implies three
> ancestry feats when there is one; it **merged skill feats and skill increases into a
> single "Skill" column**, which hides the fact that 2nd level grants a skill *feat*
> while 3rd grants a skill *increase* (different things); and it recorded **no skill
> feat at 10th level**, which the Fighter table does grant. Compare with
> [Classes.aspx?ID=35](https://2e.aonprd.com/Classes.aspx?ID=35).

Class features are class-specific and are omitted from the "Other" column except where
they affect slot counts. Skill increases additionally come from Intelligence and from
feats such as Skill Training / Additional Lore, which is why
`hashMapTrainedOnlySkillChoices` has per-feat slot keys.

## 12. Feat UI widget

A feat row (`eI` / `tI` / `ZT`) is built as:

```
.div-button.small-margin-right-bottom
  .button-column  → img.button-icon (icon_class.png / icon_ancestry.png / icon_background.png / icon_general.png / icon_skill.png)
  .button-column
    .small-text.grey-text        ← the slot label ("Class Feat")
    div[display:flex]
      span.button-selection[.red-text]   ← the chosen feat, or "Not Selected"
      span                                ← the "clear" ✕ (icon)
    .warning-text.hidden                 ← "Prerequisites not met or taken too many times!"
```

Feats that open a sub-dialog carry a `selectable` value and their row click opens a
`Select Special` / `Select Feat` dialog rather than writing directly.

## 13. Gotchas for a clone

* `selectable` is a **count**, not a boolean.
* Prerequisites live in five different columns plus free text; only the structured
  ones are machine-checked. `text_prereq` is display-only and may mention things the
  code cannot verify (it renders as a tooltip).
* `req_abilities` uses `£`, not `:`. Easy to mis-parse.
* Feat ids embed a space in the name portion (`WIZARD_Reach Spell`); never split on
  the last underscore.
* Heritages are feats in `feats_heritage_*` but share the *ancestry* prefix, so
  `DWARF_` covers both ancestry feats and Dwarf heritages. Distinguish by table.
* `src` missing ⇒ treat as `"CRB"`.
* The `Feat Browser` and the in-character feat picker use the same widget and the
  same filters, so getting the filter pipeline right once covers both.
