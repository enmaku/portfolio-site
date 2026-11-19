# 03 — Character Model

The character is the central object of the app. It is a **flat-ish JSON object** with
~125 serializable properties, most of them maps keyed by strings. Nothing is
"computed and stored": every derived value (AC, saves, skill totals, spell DC) is
recomputed from the object + the rules tables on every render.

## 1. Storage and identity

| Where | What |
| --- | --- |
| IndexedDB `pathbuilder2e_db` → `saves` | The character, stored as a **JSON string** under key = `webID` |
| IndexedDB `saveIDs` | `{characterName, classLevel, timestamp, webID, isStarbuilderCharacter}` — list metadata |
| IndexedDB `folders` | Save folders |
| IndexedDB `portraits` | Portrait image blobs |
| Google Drive / Firebase | Cloud copy, keyed by `googleFileID` / `firebaseID` |
| localStorage `prefLastCharacterID` | Which character to reopen at boot |
| `webID` | UUID v4, primary identity |
| `characterRef` | Short display id |
| `shareCode` / `editToken` | Tokens minted when sharing a copy (`launch.html?build=N`) |
| `emailedBuildID` | Server-side id of a saved build (`/app/builds/N`, `json.php?id=N`) |

The app supports **multiple simultaneously open builds** ("active builds") in the top
bar; switching builds swaps the character object and re-renders, it does not reload
the page. `autoSave` controls whether edits are written back on every change.

## 2. Serialization (Kotlin/JS kotlinx.serialization)

The bundle registers a `@Serializable` descriptor for the character class —
`i.mt("<fieldName>", <isOptional>)` calls, one per property
(bundle line ~45619). `mt(name, true)` = **optional/omittable**; `mt(name, false)` =
required. This list is the authoritative field order and nullability.

Key observations:

* Most maps are `hashMap*` and serialize as JSON objects.
* The lists are `list*` and serialize as JSON arrays.
* Several fields are *Starbuilder-only* (`starbuilderCharacter`,
  `starbuilderIncludeAllPathbuilder`, `starbuilderUseCredits`,
  `listContentTogglesExcludeStarbuilder`, `listPlayerSiegeWeapon`, `mechanicSpentMines`).
* Content-toggle exclusions are stored per game system:
  `listContentTogglesExcludePathbuilder` / `...Starbuilder`.
* Unknown/absent keys are simply omitted; readers must tolerate missing keys
  everywhere (older saves lack newer fields).

### 2.1 Field reference

Grouped alphabetically. `M` = map, `L` = list, `S` = scalar, `B` = bool.

| Field | T | Meaning |
| --- | --- | --- |
| `abp` | B | Automatic Bonus Progression variant on |
| `addGenericCompanion` | B | Grant a blank generic companion |
| `addLevelToProficiency` | B | Proficiency-Without-Level off (i.e. add level) |
| `age` | S | Free text / preset string |
| `alignment` | S | Legacy alignment (`LG…CE`, `N`); Remaster hides it |
| `allowHalfHeritages` | B | Allow "half" heritages |
| `allowMultiplePurchase` | B | Allow buying the same item repeatedly |
| `ancestry` | S | Ancestry name |
| `ancestryParagon` | B | Ancestry Paragon variant |
| `autoSave` | B | Autosave on change |
| `background` | S | Background **id** (`BACKGROUND_Acolyte`) |
| `backgroundBoostLimitedSelection` | M | Background restricted-boost choice |
| `backgroundBoostThirdSelection` | M | Background third-boost choice |
| `booksLastChecked` | S | Number of known source books at last run (drives "New Books") |
| `characterLevel` | S | Level (1–20), independent of `characterLevel` naming |
| `characterName` | S | Display name |
| `characterRef` | S | Short reference |
| `classArchetype` / `classArchetypeDual` | S | Class archetype ids |
| `classDualOptionalTrainedSkill` | S | Dual-class free skill |
| `className` | S | Class name (`Fighter`) |
| `classKeyAbility` / `dualClassKeyAbility` | S | Key-ability index 0–5 |
| `classOptionalTrainedSkill` | S | Free class skill (e.g. Fighter Acrobatics/Athletics) |
| `cloudStorage` | B | Saved in Drive |
| `copper`/`silver`/`gold`/`platinum` | S | Currency |
| `damageTaken` | S | Current damage |
| `deity` | S | Deity name |
| `dialects` | L[6] | Per-language dialect slots |
| `dualClass` | S | Dual class name |
| `editToken` | S | Edit token for shared build |
| `emailedBuildID` | S | Server build id |
| `experiencePoints` | S | XP (drives XP→level bar) |
| `firebaseID` | S | Firebase node id |
| `folderID` | S | Save-folder id |
| `freeArchetype` | B | Free Archetype variant |
| `gender` | S | Free text / preset |
| `getBackgroundBoostFreeSelection` | S | Background free-boost choice |
| `gold`/`silver`/`copper`/`platinum` | S | see above |
| `googleFileID` | S | Drive file id |
| `gradualAbilityBoost` | B | Gradual Ability Boost variant |
| `hashMapAbilityBoosts` | M | `{level: [abilityIdx,…]}` |
| `hashMapActiveConditions` | M | `{conditionName: value}` |
| `hashMapActiveCustomBuffs` | M | Custom buff → value |
| `hashMapAncestryFreeBoostSelections` | M | `{"0": abilityIdx, …}` |
| `hashMapBonusSpellPerDay` | M | Bonus slots/day per caster |
| `hashMapBonusSpellPrepared` | M | Bonus prepared spells |
| `hashMapBonusSpellSlots` | M | Bonus slots |
| `hashMapCustomAbilityIncreases` | M | Custom ability increases |
| `hashMapCustomFeatChoices` | M | Custom feat choices |
| `hashMapCustomSkillIncreases` | M | `{level: count}` |
| `hashMapEquipmentContainers` | M | `{containerUUID: {containerName, backpack}}` |
| `hashMapFeatExtraSelections` | M | Sub-selections inside feats |
| `hashMapFeatSelections` | M | **slot name → `"PREFIX_Name"`** |
| `hashMapFormulaBookByCaster` | M | Alchemist formula book |
| `hashMapKnownSpellsByCaster` | M | Caster → list of spell names (spellbook/repertoire) |
| `hashMapPetData` | M | Pet name → pet object (see §5) |
| `hashMapPlayerSpells` | M | `"Caster&rank&index"` → `{spellList, spellName, heighten}` |
| `hashMapRepertoireOverride` | M | Manual repertoire override |
| `hashMapSelectedRunes` | M | Runes currently applied |
| `hashMapEtchedRunes` | M | Runes etched onto items |
| `hashMapSignatureFormula` | M | Alchemist signature formulas |
| `hashMapSignatureSpellsMultiple` | M | Multiple signature spells |
| `hashMapSkillIncreases` | M | `{level: [skillName,…]}` |
| `hashMapSpecialSelections` | M | `{specialName: {choiceKey: value}}` |
| `hashMapSpellBlending` | M | Summoner spell blending |
| `hashMapSpontaneousSpellsCast` | M | `{caster: {rank: count}}` |
| `hashMapTrainedOnlySkillChoices` | M | `{slot: [skillName,…]}` |
| `hashMapUsedInfusedReagentsByCaster` | M | Alchemist infused reagents spent |
| `hashMapUsedVersatileVialsByCaster` | M | Alchemist versatile vials spent |
| `heroPoints` | S | 0–3 |
| `ignoreFreeArcheAbilityReq` | B | Ignore FA ability prereqs |
| `ignoreFreeArcheRest` | B | Ignore FA feat restrictions |
| `isFreeAbilitySelection` | B | Using free (unrestricted) ability selection mode |
| `listCurrentlyInactiveBuffs` | L | Buffs toggled off |
| `listCustomLores` | L | Custom lore skills |
| `listDisabledRulebooks` | L | Books to hide (e.g. `["CRB","APG"]`) |
| `listLanguages` | L | Known languages |
| `listOptInBooks` | L | Extra books to include (e.g. `["PC2"]`) |
| `listPlayerEquipment` | L | Inventory (see §5) |
| `listPlayerFormula` | L | Known alchemical formulas |
| `listPlayerSiegeWeapon` | L | Siege weapons (Starbuilder) |
| `listPlayerWeapons` | L | Weapons (see §5) |
| `listRituals` | L | Known rituals |
| `listSpentSpellSlots` | L | Spent slots |
| `listStowedPlayerArmor` | L | Armor in a bag |
| `listStowedPlayerShields` | L | Shields stowed |
| `listUserBonusFeats` | L | User-granted bonus feats |
| `mapAnimistApparitions` | M | Animist apparition state |
| `mechanicSpentMines` | S | Starbuilder mechanic |
| `mythicAlternative` | B | Mythic via alternate rules |
| `mythicAsArchetypes` | B | Treat mythic as archetypes |
| `notes` | S | Free-text notes |
| `optionalFlaw` | B | Character took a voluntary flaw |
| `otherCaster` | M | "Other Spells" caster |
| `playerArmor` | M | Equipped armour |
| `playerShieldNew` | M | Equipped shield |
| `portraitFilename` | S | Portrait reference |
| `remastered` | B | Remaster rules on |
| `remasteredPC2` | B | Player Core 2 options on |
| `separateAdventurersKit` | B | Don't bundle adventurer's kit |
| `shareCode` | S | Share link code |
| `showAftermathFeats` | B | Show aftermath feats |
| `showDedicationFeats` | B | Show dedication feats |
| `showLevelWarnings` | B | Warn on incomplete levels |
| `showMythic` | B | Show mythic options |
| `showSpellbookConfirmation` | B | Confirm before overwriting spellbook |
| `skillParagon` | B | Skill Paragon variant |
| `spentResolve` / `spentResonance` / `spentSpellPoints` | S | Resource trackers |
| `staminaDamage` | S | Stamina variant |
| `starbuilderCharacter` | B | This is a Starfinder character |
| `temporaryHP` / `temporaryHPSource` | S | Temp HP |
| `useStamina` | B | Stamina variant on |
| `useUpdatedSpells` | B | Remastered spell data |
| `webID` | S | UUID primary key |

### 2.2 Variant-rule flags

`freeArchetype`, `abp`, `gradualAbilityBoost`, `ancestryParagon`, `useStamina`,
`dualClass`, `addLevelToProficiency` (inverse of Proficiency Without Level), `skillParagon`.
These are toggled from **Character Options** and change the whole level-up flow: e.g.
`freeArchetype` adds a "Free Archetype Feat" slot to every even level, `abp` removes
potency/striking runes and grants them automatically at fixed levels.

## 3. Ability scores

Two orthogonal systems:

1. **Guided boosts** — ancestry boosts/flaws, background boosts, class key ability,
   four level-1 free boosts, plus four boosts at levels 5/10/15/20.
   Stored in `hashMapAncestryFreeBoostSelections`, `getBackgroundBoostFreeSelection`,
   `backgroundBoostLimitedSelection`, `backgroundBoostThirdSelection`,
   `classKeyAbility`, `hashMapAbilityBoosts: {"1":[…],"5":[…],"10":[…],"15":[…],"20":[…]}`.
2. **Manual override** — `abilityScoreOverrides` (the "Override Character Creation
   Ability Scores" dialog). When present, the guided system is bypassed.

The four level-1 free boosts are a **separate step from ancestry/background/class**
(AoN Step 6). Each of the four must go to a **different** attribute. See
[10-pathfinder-2e-rules.md](./10-pathfinder-2e-rules.md) §2.4 for the canonical list of
boost sources and their order.

The Set-Abilities dialog (`Hf`) computes free boosts as
`4 - <boosts already granted at level 1>` and exposes a per-ability `-`/`+` stepper
(`Bv`). Voluntary flaws are explicitly *not* handled here — the dialog text points the
user at the override dialog.

Boost arrays are **ability indices**: `0=Str, 1=Dex, 2=Con, 3=Int, 4=Wis, 5=Cha`.
The display arrays are `z2y_1 = ["Strength",…,"Charisma"]` and
`z2y_1short = ["Str","Dex","Con","Int","Wis","Cha"]`.

Gradual Ability Boost switches the boost levels from `[5,10,15,20]` to
`[2,3,4,5,7,8,9,10,12,13,14,15,17,18,19,20]` (bundle line 81929).

### 3.1 Final score

```
score = 10
      + 2 × (number of boosts applied to this ability)
      - 2 × (number of flaws applied)
```

Base is 10; every boost is +2 and every flaw −2. The `abilityMod` displayed is
`floor((score-10)/2)`.

> **Correction (audited against AoN).** An earlier revision of this document claimed
> "PF2e has no partial boosts". That is **wrong**. AoN's *Ability Boosts* rule states
> that once an ability modifier is **+4 or higher**, a boost is only a **partial
> boost** — two boosts are required to raise the modifier by 1. Pathbuilder models
> this: the ability renderer (`Wv.pjg`, bundle line 34008) prints `▲` (U+21CA) when
> the stored **score is odd**, i.e. when exactly one of the two required boosts has
> been applied. See [07-rules-engine.md](./07-rules-engine.md) §3.
>
> The `+2 per boost` arithmetic above is still correct *as score arithmetic* — a boost
> always moves the score by 2. What changes at +4 is that the **modifier** only moves
> on every second boost, which is exactly what an odd score encodes.

## 4. Levels, feats and slots

### 4.1 Level structure

A character has 1–20 levels. Each level renders as a `.build-section` inside
`#divBuildLevels`. Slots per level follow the class advancement table; the
Fighter/standard cadence is:

| Level | Slots |
| --- | --- |
| 1 | Ancestry, Heritage, Background, Class, 4 free ability boosts, initial proficiencies, class feat, skill training, class features |
| 2 | Class feat, skill feat |
| 3 | General feat, skill increase, class feature |
| 4 | Class feat, skill feat |
| 5 | Ancestry feat, 4 ability boosts, skill increase, class feature |
| 6 | Class feat, skill feat |
| 7 | General feat, skill increase, class feature |
| 8 | Class feat, skill feat |
| 9 | Ancestry feat, skill increase, class feature |
| 10 | 4 ability boosts, class feat, skill feat |
| 11 | General feat, skill increase |
| 12 | Class feat, skill feat |
| 13 | Ancestry feat, skill increase |
| 14 | Class feat, skill feat |
| 15 | 4 ability boosts, general feat, skill increase |
| 16 | Class feat, skill feat |
| 17 | Ancestry feat, skill increase |
| 18 | Class feat, skill feat |
| 19 | General feat, skill increase |
| 20 | 4 ability boosts, class feat, skill feat |

> **Audited against AoN.** An earlier revision of this table was wrong in three ways:
> it put the 1st-level **class feat** and **four free ability boosts** in the wrong
> relationship to the ancestry step, it omitted the **1st-level ancestry feat** (which
> comes from the ancestry step, not the class), and it labelled levels 3/7/11/15/19 as
> simply "general feat" while omitting the **skill increase** those levels also grant.
> The canonical per-class table is at
> [Classes.aspx?ID=35](https://2e.aonprd.com/Classes.aspx?ID=35).

Note that **skilled classes differ**. A cleric, for example, gains *Cleric Feat* only
from 2nd level, and a wizard's class feats are *Wizard Feats*.

The code does not hard-code this list; it asks the class/special managers
(`k9z(caster,level)`, `l9z(...)`, `h9z(...)`) how many skill increases a level grants
and then renders whatever the current class/archetype data says is available.

### 4.2 `hashMapFeatSelections`

Key = **slot name**, value = **`"<PREFIX>_<Name>"`** (the `id` column of the feats
tables). Examples from a real save:

```json
{
  "Heritage Feat": "DWARF_Rock Dwarf",
  "Dwarf Feat 1": "DWARF_Dwarven Lore",
  "Heritage Featversatile heritage": "GENERAL_Fleet",
  "Human Feat 1": "HUMAN_Natural Skill",
  "Evolution Feat 1": "SUMMONER_Glider Form",
  "Class Feat": "CLERIC_Domain Initiate"
}
```

Slot-name shapes observed:

* `"<Category> Feat"` — generic slots (`Class Feat`, `Skill Feat`, `General Feat`, `Ancestry Feat`)
* `"<Ancestry> Feat <n>"` — level-1 ancestry feat slots (`Dwarf Feat 1`)
* `"<Slot> <n><letter>"` — sub-slots opened by a feat (`Dwarf Feat 1a`, `Dwarf Feat 1b`)
* `"<ParentSlot><specialisation>"` — child slot of a choice (\
  `"Heritage Featversatile heritage"` = the extra general feat granted by Versatile Heritage)
* `"<Class> Feat"`, `"<Class> Feat <n>"` — class-specific feat slots

Prefixes come straight from the data tables (`DWARF_`, `HUMAN_`, `WIZARD_`,
`ARCHETYPE_`, `GENERAL_`, `AFTERMATH_`, `ARCHETYPE_*_`, …).

### 4.3 `hashMapFeatExtraSelections`

For feats that embed a second choice (e.g. a feat that grants a 1st-level spell, or an
archetype dedication that asks for a skill). Keyed by the parent slot plus a
discriminator, value is the inner choice id.

### 4.4 Export tuple format

The exported `feats` array is a list of tuples:

```
[ name, null, category, level, slotKey, relation, parentSlot ]
```

* `relation` ∈ `"standardChoice" | "parentChoice" | "childChoice"` (also an
  `"Awarded Feat"` pseudo-category for feats granted automatically).
* `parentSlot` is `null` for top-level feats.

Real example:

```json
["Fleet", null, "General Feat", 1, "Heritage Featversatile heritage", "childChoice", "Heritage Feat"]
```

### 4.5 `hashMapSpecialSelections`

Class features that ask a question store their answer here, nested two deep:

```json
{
  "Divine Font": {"Select Font": "Healing Font"},
  "Doctrine": {"Select Doctrine": "Warpriest"},
  "Warpriest": {"Select Deity's Favored Weapon": "Warhammer"},
  "Sanctification": {"Select Cleric Sanctification": "Holy"},
  "Eidolon": {"Select Eidolon Type": "Beast Eidolon"},
  "Human Feat 1": {"Select Skill 1": "Acrobatics", "Select Skill 2": "Medicine"}
}
```

The outer key is the special's name (matching a row in a `specials_*` table); the inner
key is the prompt text; the value is the chosen option name.

### 4.6 `hashMapTrainedOnlySkillChoices`

Skill-training slots:

```json
{
  "standardSelection": ["Acrobatics","Athletics","Crafting"],
  "Dwarf Feat 1a": ["Arcana"],
  "Dwarf Feat 1b": ["Diplomacy"],
  "Background Skill Choice": ["Intimidation"],
  "Background Skill Choice 2": ["Stealth"],
  "Background Skill Choice 3": ["Medicine"]
}
```

`standardSelection` is the class's own skill list; other keys map to the feature that
granted the extra training.

### 4.7 `hashMapSkillIncreases`

```json
{"1":[],"2":[],"3":["Athletics"],"4":[],"5":["Religion"], …}
```

Keyed by the level at which the increase was spent. Values are skill names;
`"Lore: X"` entries are lore skills.

## 5. Equipment, weapons, pets

### 5.1 `listPlayerWeapons[]` — `PlayerWeapon`

Serialized fields (`mt(...)` list, bundle line 67368):

```
weaponName, attackAbilityRef, itemStriking, listPropertyRunes, damageAbilityRef,
increasedDice, material, sizeChange, attackOverride, damageBonusOverride, extraTraits,
nameOverride, listEnabledPrecisionKeys, listBonusDamageDice, hasSpecialization, use2H,
overrideTrainingLevel, overrideWeaponGroup, overrideDamageType, overrideDiceSize,
showFromLevel, improvementLevel, currentMagazine, currentMagazineLimit, magSource,
magName, showDetails, referenceForWeaponMount, potency, ref, damageType,
stowed, inContainerID, amount, mapInvModSel, bulkOverride, firebaseID
```

`attackAbilityRef` / `damageAbilityRef` are ability indices (0=Str, 1=Dex) — this is
why a Strength fighter and a Dexterity rogue point the same weapon at different stats.

### 5.2 `listPlayerEquipment[]` — `PlayerEquipment`

```
name, stowed, inContainerID, amount, mapInvModSel, bulkOverride, firebaseID
```

`inContainerID` references a key in `hashMapEquipmentContainers`:

```json
{"03aca6f9-…": {"containerName": "Backpack", "backpack": true}}
```

An item with `inContainerID` is nested inside that container in the inventory tree; the
container itself is also an entry in `listPlayerEquipment`.

### 5.3 `playerArmor` / `playerShieldNew`

```
playerArmor:  {armorName, stowed, inContainerID, amount, mapInvModSel, bulkOverride,
               firebaseID, itemResilient, potency, armorName, listPropertyRunes,
               material, armoredSkirt, worn, improvementLevel}
playerShield: {shieldName, …}
```

`potency` and `itemResilient` carry the fundamental runes; `listPropertyRunes` the
property runes; `material` the special material (which can alter bulk, hardness, AC).

### 5.4 Bulk

```
encumberedLimit = 5 + Str mod      (size-adjusted: Tiny ×½, Large ×2, Huge ×4, Gargantuan ×8)
maxLimit        = 10 + Str mod     (same size adjustment)
```

Displayed as `Total Bulk N` plus `Unencumbered|Encumbered|Over Max (Enc: x; Max: y)`.

Items count `bulk` from `items_all`. **An `L` (light) item counts as 0.1 Bulk — ten
light items make 1 Bulk** (an earlier revision of this document said "halved", which is
wrong: light means *one tenth*, not *one half*). A `–` (negligible) item counts as 0.
Fractions are rounded **down**. A backpack ignores its own contents' bulk; `reducesBulk`
on a material subtracts a flat amount. **1 000 coins = 1 Bulk.**

> **Audited against AoN.** The size multipliers above match
> [AoN's Bulk Conversions table](https://2e.aonprd.com/Rules.aspx?ID=2143) (Table 6-19)
> exactly for Tiny/Large/Huge/Gargantuan. Pathbuilder only implements the multiplier,
> not the "treats as light / treats as negligible" columns of that table.

### 5.5 Pet data — `hashMapPetData`

Keyed by pet selector (`petEidolon`, `petAnimal`, `petFamiliar`, `petFollower`, …).
A pet object is a *sub-character*: it has its own `hashMapPetData`, `playerArmor`,
`listPlayerWeapons` (via `hashMapEidolonAttacks`), `dialects`, `remastered`,
`petType`, `petName`, plus

```
petType, incredibleType, petName, switchA, switchB, hashMapAnimalSpecializations,
nickname, hashMapSelectedFamiliarAbilities, hashMapSelectedFamiliarSkilled,
hashMapSelectedFamiliarResistances, familiarSpecific, specificGainedLevel,
hashMapEidolonAttacks, simplePet, robotCompanion, mechanicDrone, imitatorAncestry,
mapRobotCustomizations
```

`petType` is numeric; `2` was observed for an Eidolon. Pet keys are nested: a
`hashMapPetData` inside a pet is how an animal companion's own companion is stored.

## 6. Export JSON

`Export JSON` (sidebar) opens the server viewer `json.php?id=N`; the same structure is
produced client-side. Top level:

```json
{ "success": true,
  "build": {
    "name","class","dualClass","level","xp","ancestry","heritage","background",
    "alignment","gender","age","deity","size","sizeName","keyability",
    "languages":[…],"rituals":[…],"resistances":[…],"inventorMods":[…],
    "abilities": { "str","dex","con","int","wis","cha",
                   "breakdown": { "ancestryFree":[…],"ancestryBoosts":[…],
                                  "ancestryFlaws":[…],"backgroundBoosts":[…],
                                  "classBoosts":[…],"mapLevelledBoosts":{} } },
    "attributes": { "ancestryhp","classhp","bonushp","bonushpPerLevel","speed","speedBonus" },
    "proficiencies": { "classDC","perception","fortitude","reflex","will",
                       "heavy","medium","light","unarmored","advanced","martial","simple","unarmed",
                       "castingArcane","castingDivine","castingOccult","castingPrimal",
                       "acrobatics","arcana","athletics","crafting","deception","diplomacy",
                       "intimidation","medicine","nature","occultism","performance","religion",
                       "society","stealth","survival","thievery","piloting","computers" },
    "mods": {},
    "feats": [ [name,null,category,level,slotKey,relation,parentSlot], … ],
    "specials": [ "Arcane School: Not Selected", "Arcane Bond", … ],
    "lores": [ ["Alcohol", 2] ],
    "equipmentContainers": {},
    "equipment": [],
    "specificProficiencies": {"trained":[],"expert":[],"master":[],"legendary":[]},
    "weapons": [],
    "money": {"cp","sp","gp","pp"},
    "armor": [],
    "spellCasters": [ {…} ],
    "focusPoints": 0,
    "focus": {},
    "formula": [],
    "acTotal": {"acProfBonus","acAbilityBonus","acItemBonus","acTotal","shieldBonus"},
    "pets": [],
    "familiars": []
  } }
```

Proficiency numbers in `proficiencies` are **the PF2e rank numbers**:
`0=Untrained, 2=Trained, 4=Expert, 6=Master, 8=Legendary`. The word labels are
`["Untrained","Trained","Expert","Master","Legendary"]`.

`abilities` holds final scores (not modifiers); `breakdown` lists which boosts went
where. `attributes` holds the components of HP and speed.

## 7. Conditions, buffs, hit points

| Field | Meaning |
| --- | --- |
| `damageTaken` | Damage; current HP = max − damage |
| `temporaryHP` / `temporaryHPSource` | Temp HP and its source label |
| `staminaDamage` / `spentResolve` | Stamina variant |
| `heroPoints` | 0–3 |
| `hashMapActiveConditions` | `{conditionName: value}` — conditions with a numeric value (`Clumsy 2`) store the number; valueless ones store `true` |
| `hashMapActiveCustomBuffs` | User-defined buffs, same shape |
| `listCurrentlyInactiveBuffs` | Buffs the user turned off |

The `conditions` table has a `value` column that is `TRUE` for conditions that take a
number (Clumsy, Doomed, Drained, Dying, Enfeebled, Frightened, Sickened, Slowed,
Stupefied, Wounded, Persistent Damage). `conditions.description` is the rules text.

Applying a condition `X n` adds a typed modifier to the affected statistics — e.g.
`Clumsy n` → `-n` status penalty to AC, Reflex, and Dex-based checks; `Enfeebled n` →
`-n` to Str-based rolls and damage. Custom buffs use the same modifier pipeline with
user-chosen bonus type (`Item Bonus` `0`, `Status Bonus` `1`, `Circumstance Bonus` `2`,
`Untyped Bonus` `3`).

## 8. Which fields a clone must implement first

If you are rebuilding from scratch, this is the minimum viable subset in dependency
order:

1. `webID`, `characterName`, `characterLevel`, `ancestry`, `heritage`-slot,
   `background`, `className`, `classKeyAbility`.
2. Ability system: `hashMapAncestryFreeBoostSelections`, `getBackgroundBoostFreeSelection`,
   `backgroundBoostLimitedSelection`, `backgroundBoostThirdSelection`,
   `hashMapAbilityBoosts`, `abilityScoreOverrides`.
3. `hashMapFeatSelections` + `hashMapFeatExtraSelections` + `hashMapSpecialSelections`
   (these carry most of the rules).
4. `hashMapTrainedOnlySkillChoices` + `hashMapSkillIncreases`.
5. `listPlayerWeapons`, `playerArmor`, `listPlayerEquipment`,
   `hashMapEquipmentContainers`, currency.
6. `hashMapPlayerSpells`, `hashMapKnownSpellsByCaster`, `hashMapSpontaneousSpellsCast`,
   `hashMapBonusSpell*` (see [04-spell-system.md](./04-spell-system.md)).
7. Everything else can be added incrementally; because the object is flat and the
   serializer is optional, unknown fields round-trip harmlessly.

## 9. Gotchas

* **`saves` values are strings.** Reading them as objects silently yields garbage;
  always `JSON.parse` a second time. This bit the probe scripts repeatedly.
* **Absent ≠ empty.** `mt(name, true)` means the key may be missing entirely; code must
  not assume `{}` or `[]`.
* **Map keys are strings even when numeric.** `hashMapAbilityBoosts` uses `"1"`, `"5"`,
  `"10"`, `"15"`, `"20"` — not numbers.
* **Two names for the same thing.** `hashMapAbilityBoosts` keys are boost *levels*;
  `hashMapAncestryFreeBoostSelections` keys are *boost ordinal*, not level.
* **Ability indices are 0-based** in storage but 1-based-ish in the Set Abilities
  dialog's dropdown (`jjh_1 = ["None","Strength",…]`, so index 1 = Strength).
* **Heritage is stored as a feat**, not as a `heritage` field: the save has no
  `heritage` key — it is `hashMapFeatSelections["Heritage Feat"]`. Only the export JSON
  synthesises a `heritage` string.
* **The background is stored by id** (`BACKGROUND_Acolyte`) but the ancestry and class
  are stored by name (`Dwarf`, `Cleric`).
