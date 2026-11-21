# 13 - Pathbuilder export field inventory and derived-stat gaps

Resolves GitHub issue #479 (map #476, CritCrafter character viewer). Research date 2026-11-21.

**Question.** What does a real Pathbuilder export contain, what is missing or irregular for a read-only viewer, which displayed numbers must be derived, and what can be reused from the sibling repo?

## Sources

All first-party artifacts; no secondary write-ups.

| Tag | Source |
| --- | --- |
| `heroes/*` | `~/code/strength-of-thousands/heroes/{anya,cy-an-copperbottom,lithrei-woeborn,solanum-calabash,taraan-skyseeker,yggostrus}.json` (real exports, `build` key; read-only, not modified). Six builds, levels 1-2, classes Summoner x2, Inventor, Oracle/Investigator (Lithrei Woeborn, id 264031), Magus, Cleric/Witch. |
| `pb.js` | `~/code/strength-of-thousands/src/domain/pathbuilder.js` |
| `cards.py` | `~/code/strength-of-thousands/cards/generate_cards.py` |
| `doc03`, `doc08` | `pathbuilder-records/docs/03-character-model.md`, `08-export-and-integrations.md` (reverse-engineered from the Pathbuilder bundle) |

Hard limit: all six samples are level 1-2 and none has pets, formulas, ABP, runes, materials, a raised-shield bonus other than one case, or a caster above rank 1. Anything about those shapes below is marked **unverified** and comes from `doc03`/`doc08` only.

## 1. Envelope

Hero files wrap the export: `{pathbuilderId, displayName, tagline, bio, build, relationships, study}` (SoT-specific extras). The Pathbuilder payload is `build`. Live endpoint envelope is `{success, build}` (`doc08` 3.1, `pb.js extractBuildFromResponse`). All six builds have the identical 39 top-level `build` keys, in the same order (`name` ... `familiars`), so none is omitted-when-empty at top level; empty values are `[]`, `{}`, `null` or `""`.

## 2. Field shapes (observed)

### Identity / scalars
`name, class, dualClass (null if none), level (number), xp, ancestry, heritage, background, alignment ("N"), gender, age (string), deity ("Not set" when none), size (ordinal), sizeName, keyability ("str".."cha", lowercase)`.
- `size`: 0 Tiny, 1 Small, 2 Medium. Use `sizeName` (`doc08` 3.7). Yggostrus is `size 0 Tiny`.
- `background`, `languages`, `lores` may hold the literal placeholder `"None selected"` (Cy'An: `languages: ["None selected"]`; handled by `pb.js isPathbuilderNoneSelected`). `deity` uses `"Not set"` instead, which `pb.js` does not strip.
- Free text is user-controlled (`"Acedemia"` lore typo in Lithrei, `"ancient mwangi expanse"` lowercase, `gender` ranges from `"boy"` to `"masculine, he/him"`). Display verbatim.
- `dualClass` is set for the dual-class variant (Lithrei, Taraan); archetypes are NOT in it (they appear only as `... Dedication` feats; `pb.js buildClassLine` reconstructs the class line from them).

### abilities
`abilities.{str,dex,con,int,wis,cha}` are final **scores**, not modifiers. `breakdown` lists boost sources by ability *name* (`"Int"`, capitalised, unlike `keyability`'s lowercase): `ancestryFree, ancestryBoosts, ancestryFlaws, backgroundBoosts, classBoosts, mapLevelledBoosts{"1":[...]}`. A viewer can ignore `breakdown`. Odd scores (partial boosts) are legal at higher levels (`doc03` 3.1); modifier is `floor((score-10)/2)`.

### attributes
`ancestryhp, classhp, bonushp, bonushpPerLevel, speed, speedBonus`. Raw components, no Con (`doc08` 3.7). Speed = `speed + speedBonus` (Anya: 25 + 5). **Max HP is not in the export.**

### proficiencies
Flat ranks 0/2/4/6/8 (untrained..legendary) for `classDC, perception, fortitude, reflex, will, heavy, medium, light, unarmored, advanced, martial, simple, unarmed, castingArcane|Divine|Occult|Primal`, 16 core skills, `piloting, computers` (Starfinder leftovers, always 0 here). There is **no** `shield` key in `proficiencies` (`pb.js computeProficiencies` reads `prof.shield`, which is always undefined, so it falls back to the worn-shield check). Lore ranks live in `lores`, not here. Rank is the proficiency bonus component without level: total = rank + level when rank > 0.

### mods
`{}` for five builds; Taraan: `{"Diplomacy":{"Item Bonus":1},"Religion":{"Item Bonus":1}}` (plausibly from the Glasses of Sociability and Shining Symbol in his inventory; the export does not say). Shape: `{<statistic label>: {<bonus type>: number}}`. Only bonus type seen is `"Item Bonus"`. The label set is not enumerated by any source (**unverified**: whether status/circumstance types, penalties, or save/AC/attack labels appear). `pb.js` reads `mods.Perception["Item Bonus"]` only.

### feats
Array of tuples; **two lengths coexist**:
- Length 4: `[name, null, "Awarded Feat", level]`, granted feats with no slot (Shield Block, Experienced Tracker, class-granted Dedication feats).
- Length 7: `[name, extra, category, level, slotKey, relation, parentSlot]`.

Irregularities versus `doc03`/`doc08`:
- Element 1 is **not always null**: `["Skill Training","Intimidation","Skill Feat",2,"Skill Feat 2","standardChoice",null]` carries the feat's selected option (Taraan). `doc08` 3.2 says it is a "legacy placeholder, always null"; that is wrong. Treat it as the feat's sub-choice.
- `relation` seen: `standardChoice`, `parentChoice` (Versatile Human), `childChoice` (Fleet, with `parentSlot "Heritage Feat"`). Awarded feats have no relation at all.
- `category` seen: `Awarded Feat, Heritage, Ancestry Feat, General Feat, Skill Feat, Class Feat, Archetype Feat, Summoner Evolution Feat`. Class-specific categories exist (`Summoner Evolution Feat`); the set is open.
- `slotKey` is a free string: `"Heritage Feat"`, `"Human Feat 1"`, `"Ancestry Paragon 1"`, `"Free Archetype 2"`, `"BACKGROUND_Archaeologistchild1"`, or a bare UUID for custom General Feat slots (Additional Lore in Lithrei/Taraan). Do not parse it for meaning except as an opaque key.
- Heritage is in `feats` (category `Heritage`) as well as the `heritage` string.
- **Duplicates**: Taraan has `Additional Lore` three times (awarded, general, skill). Key rows by tuple, not name.
- A feat name never says whether it is an action; that needs a rules lookup (section 6).

### specials
Array of strings, **heterogeneous and unordered by type**: class features (`Spellstrike`), subclass picks (`Life Mystery`, `Dragon Eidolon`), ancestry traits (`Low-Light Vision`, `Darkvision`), feat echoes (`Enhanced Familiar Feat`), and stray choice values with no feature semantics (`acid`, `Acrobatics`, `Medicine`, `Soul`, `No special vision`). Duplicates occur (`Low-Light Vision` twice in Anya, `Dragon Eidolon` twice in Yggostrus). `doc03` shows the pre-export save format `"Arcane School: Not Selected"` style strings; none of the six builds contains a colon-form or `Not Selected` entry (**unverified** for builds with unmade choices). Nothing but the name is provided: no level, source, text. Entries are not necessarily AoN names.

### lores
`[[name, rank]]`, rank 2 in every sample. The lore total is not given.

### equipment / equipmentContainers
- `equipment`: array of tuples with **two lengths**:
  - `[name, qty, "Invested"]` (top level or non-contained)
  - `[name, qty, containerUUID, "Invested"]` (in a container)
- The last element is the literal `"Invested"` on **every** item in all 50 entries across the six samples, including Bedroll, Torch and Rations. It is not a reliable "invested" flag; do not display it as one. No other value was seen (possible values **unverified**).
- A container is itself an entry (`["Backpack",1,"Invested"]`) plus a row in `equipmentContainers[UUID] = {containerName, bagOfHolding, backpack, augmentations}`.
- Container irregularity: Taraan has `equipmentContainers` with "Smuggler's Sack" but **no item references that UUID**, and the actual items `Sack` / `Smuggler's Sack II` appear as ordinary rows. Cy'An, Solanum have no containers at all and a lone `Artisan's Toolkit`/`Backpack`. Containers can be unreferenced; items can be unreferenced. Display containers by walking `equipment` for UUID tuples and listing the rest flat.
- Container name in `equipmentContainers` is user-editable and may differ from the item name.
- **No bulk, price, description, worn/held state, or charges** appear anywhere. Names are display names, which for variants are non-canonical (`Smuggler's Sack II`, `Spellbook (Blank)`, `Religious Symbol (Wooden)`, `Clothing (Explorer's)`).
- Yggostrus: `equipment: []`, `weapons: []`, `armor: []` (empty is valid, not an error).

### weapons
Uniform 16-key objects: `name, qty, prof, die, pot, str, mat, display, runes, damageType, attack, damageBonus, extraDamage, increasedDice, isInventor, grade`.
- `prof`: `simple | martial | unarmed` (category, string; not a rank).
- `die`: `"d4"`, `"d6"`, `"d8"`, and `"d1"` for Blowgun (Anya). Number of dice (striking) is not a field; `str` is `""` in all samples, so striking rune handling is **unverified** (`doc03` 5.1 suggests `itemStriking` exists in the save; the export maps it to `str`, presumably `"striking"`, **unverified**).
- `pot` 0-3 potency; `mat` null or a material; `runes` array of property runes (all empty); `extraDamage` array (all empty); `grade` `""`.
- `damageType`: single-letter `S`, `P`, `B`.
- **`attack` is the full attack bonus**, `damageBonus` the full flat damage bonus (checked: Cy'An dagger, level 1, trained, Str 16/Dex 12, finesse: `attack 6 = 2 rank + 1 level + 3 ability`, `damageBonus 3`; Solanum Bo Staff `7 = 2+1+4`, `damageBonus 4`; Anya untrained Bola `attack 1` = Dex mod only, no level; Taraan Wordreaper `7` includes `pot 1`).
- It does NOT include: the second/third MAP values, crit text, weapon traits, range, reload, group/critical specialisation, and no melee/ranged flag. Reach versus range must be looked up (`Bola`, `Sling`, `Blowgun` are ranged but indistinguishable from the object).
- `display` equals `name` except when the user renamed it; for a custom item `name` may be the user label (`Branch Implement (Lithrei)`). For unarmed strikes granted by ancestry (`Sharp Beak`) the entry is listed as a weapon with `prof: unarmed`.
- `pb.js pickPrimaryWeapon` looks for `w.default`/`w.starred`, which do not exist in any sample; it effectively always falls through to max `attack`.

### armor
Objects: `name, qty, prof, pot, res, mat, display, worn, runes, grade`. Shields are in the same array with `prof: "shield"` (`display: ""`, Taraan's Caster's Targe) and `res` (resilient) is `""`. `prof` is `unarmored|light|medium|heavy|shield`. Only `worn: true` entries matter for AC; `acTotal` already accounts for them. No hardness, HP, BT, shield HP, check penalty, Dex cap, or strength requirement. `display` is empty for a shield rather than the name: use `name`.

### acTotal
`{acProfBonus, acAbilityBonus, acItemBonus, acTotal, shieldBonus}`; `acTotal = 10 + prof + ability + item`, verified on all six (Lithrei: `10+4+0+1=15`, Taraan: `10+4+2+2=18`). **`shieldBonus` is `null` or a string** (`"1"`), is not included in `acTotal`, and is only present as a raised-shield value to add. `acProfBonus` includes level (`4 = rank 2 + level 2`, Lithrei/Taraan; `3` at level 1 with rank 2). Dex cap is already applied (Lithrei `acAbilityBonus 0` with Dex 10 and light armor is 0; ok but not informative). Untrained/unarmored builds are still given a total.

### spellCasters
Array of caster objects, 11 keys: `name, magicTradition, spellcastingType, ability, proficiency, focusPoints, innate, perDay[11], spells[], prepared[], blendedSpells[]`. All observed ranks <= 1; shape for higher ranks follows `doc08` 3.4 (**unverified** beyond rank 1).
- `spellcastingType`: `spontaneous | prepared`. No `innate`/`focus` type value; **innate is a boolean flag**, and Yggostrus's innate Homing Drake caster is still `spellcastingType: "prepared"` (irregular).
- `name` mixes real class casters (`Oracle`, `Cleric`, `Witch`, `Summoner`, `Magus`), archetype casters (`Archetype Oracle`, `Archetype Wizard`), pseudo casters (`Cleric Font` carries Heal x4 as a separate prepared-type caster; `Other Spells (Staves etc)`; `Homing Drake` = ancestry innate casting). Present in 4 of 6 builds: `Other Spells (Staves etc)` appears in Lithrei and Taraan even when the player may not own a staff.
- `perDay[0]` is cantrips known/day, `[1..10]` slot counts. For prepared casters it is slots; for `Cleric Font`, `[0,4,...]`.
- `ability` is a key `str..cha` (lowercase), `proficiency` is a rank 0-8. **`Other Spells` proficiency is inconsistent**: `0` in Lithrei, `2` in Taraan, with `ability: "cha"` in both (hard-coded). Treat `Other Spells` stats as unreliable.
- `spells[]` is `[{spellLevel, list[]}]`. It omits empty ranks for some casters and includes empty ranks 0-10 for `Other Spells`. Spell levels start at 0 (cantrip).
- `prepared[]` has the same shape but is **empty for every spontaneous caster and for Cleric** (a prepared cleric's actual daily prepared set is NOT exported; `spells` is the list of known/available spells).
- **`prepared` is not a subset of `spells`.** Magus: `spells` rank 0 = [Approximate, Healing Plaster, Bramble Bush, Telekinetic Hand, Take Root], `prepared` rank 0 adds `Tangle Vine`, `Time Sense` that are in neither `spells` list; Cy'An Archetype Wizard: `prepared` has `Eat Fire` not in `spells`. Probably spells from ancestry/feats/spellbook sources. **A viewer must union both lists.**
- `blendedSpells` is `[]` in all samples (Summoner spell blending is **unverified**; the field exists).
- `focusPoints` per caster is `0` in all; the real focus pool is top level.
- Duplicates: Cleric Font lists `Heal` four times (one per slot). Show counts.
- Same spell name can appear in two casters (Taraan: `Admonishing Ray` in Cleric and Witch) with different DC/ability.
- No spell rank-of-prepared-slot assignments (heightening), no cast/spent state, no spell DC or attack, no tradition for spells.

### focus / focusPoints
Top-level `focusPoints` = pool size (Lithrei 2, Anya 1, Solanum 1, Cy'An 0 with `focus: {}`). `focus` is keyed by tradition then ability: `{arcane:{int:{abilityBonus, proficiency, itemBonus, focusCantrips[], focusSpells[]}}}`. **`abilityBonus` is the ability modifier** (Lithrei Cha 16 -> 3; Solanum Int 12 -> 1), so DC = `10 + abilityBonus + proficiency(rank) + level + itemBonus`, with rank applying level only when trained (matches `proficiency: 2`). Multiple traditions/abilities can coexist; only the first is handled by `pb.js`.

### lores, languages, rituals, resistances, inventorMods
- `languages`: strings, may be `"None selected"`; may contain `"Taldan (common)"` style variants; no ordering.
- `rituals`: `[]` or strings (Cy'An: `["Bonding Meal"]`, a name only).
- `resistances`: `[]` in all samples (shape **unverified**); `inventorMods`: `[]` in all (shape **unverified**).

### specificProficiencies
`{trained[], expert[], master[], legendary[]}` of **item names**: Taraan `trained: ["Pick"]` is the way a weapon outside the usual category is trained. A viewer should use it to override attack rank for named weapons, but `attack` already includes it.

### formula, pets, familiars
- `formula`: `[]` in all samples (Alchemist formulas **unverified**).
- `pets`: `[]` in all six samples. Shape is **unverified**; `cards.py hero_actions` expects `{type:"Animal Companion", animal, name:"Species (Name) - Young Scorpion", mature}`, so that is the only primary evidence. Eidolons are NOT in `pets` (Anya/Yggostrus are Summoners with `pets: []`; their eidolon appears only as the specials `Beast Eidolon` / `Dragon Eidolon` and `lores` `"Dragon Eidolon"`). **The eidolon's stat block is not in the export at all.**
- `familiars`: Taraan has one: `{type:"Familiar", name:"Elemental Wisp (Earth) (Erudite (Eru))", equipment:[], specific:"Elemental Wisp (Earth)", abilities:["Accompanist","Elemental","Speech","Burrower","Independent","Tough"]}`. `name` is a compound string `"<specific> (<nickname> (<short>))"`; parse defensively. Familiar HP/skills/speeds are not given and must be derived from the master.

## 3. Numbers that are NOT in the export (must be derived)

Formulas verified against the samples where marked. `L` = `level`, `mod(x)` = `floor((x-10)/2)` of `abilities.x`, `rank` from `proficiencies`.

| Displayed number | Derivation | Notes |
| --- | --- | --- |
| Ability modifier | `mod(score)` | Scores only in export. |
| Skill total (16 core) | `rank>0 ? mod + rank + L + itemBonus : mod` | Ability per skill is fixed by rules (Acrobatics/Stealth/Thievery Dex, Arcana/Crafting/Occultism/Society Int, Athletics Str, Medicine/Nature/Religion/Survival Wis, Deception/Diplomacy/Intimidation/Performance Cha). `mods[<Skill>]["Item Bonus"]` is the only item/other-bonus source. Armor check penalty is not available. `pb.js` has no skill totals. |
| Lore total | `mod(int) + rank + L` | `lores` rank only. |
| Saves | `mod(con/dex/wis) + rank + L` | `pb.js computeSave` ignores `mods` for saves (e.g. a resilient or item bonus in `mods` would be dropped). The export gives no resilient rune or item-bonus field for saves. |
| Perception | `mod(wis) + rank + L + mods.Perception["Item Bonus"]` | `pb.js passivePerception = 10 + ...`. |
| Class DC | `10 + mod(keyability) + rank(classDC) + L` | `keyability` is in the export. |
| Spell attack / DC | `mod(caster.ability) + caster.proficiency + L (+ item)`; DC `= 10 +` that | Per caster; for focus use `focus.*.abilityBonus + proficiency + L + itemBonus`. `pb.js primarySpellCaster` picks one non-innate caster and ignores focus and archetype-secondary casters. |
| Max HP | see section 5 | `ancestryhp + (classhp + conMod + bonushpPerLevel) * L + bonushp` in `pb.js`; `doc08` says `bonushp` is per level. |
| Speed | `speed + speedBonus` | Armor speed penalty not applied. |
| Attacks | In export (`weapons[].attack/damageBonus`) | Missing: MAP, crit/spec, range. Damage string is `die + pot` only if `str` empty; striking is separate. |
| AC | In export (`acTotal.acTotal`) | Raised shield `+shieldBonus` is a string; not summed. |
| Bulk | **Not derivable from the export alone** | Needs per-item bulk from a rules database (AoN `bulk`), container rules, coin rule (1000 coins = 1 Bulk, `doc03` 5.4), `qty`, and Str mod for the limits (`5+Str`, `10+Str`; size-adjusted). Nothing in the export is a bulk number. |
| Hero/focus/other current state | Not available | No current HP, temp HP, conditions, spent slots, hero points, damage taken; these are in the Pathbuilder save but not the export. Viewer is read-only so this is fine (map decision). |
| Heightened/prepared slots per rank | Partially | `perDay` gives counts; no assignment. |
| Variant-rule flags | **Not exported** | Free Archetype is detectable only by `Free Archetype N` slot keys; Proficiency Without Level, ABP, Gradual Boosts, Ancestry Paragon (`Ancestry Paragon 1` slot appears) are not flagged. Derivations that add level to rank assume the default rules. |
| Rules text for feats, specials, items, spells, actions | Not in export | Names only. Needs AoN lookup (decided: embed). |
| Item bonuses from invested items (e.g. `+1 Diplomacy`) | Only through `mods` | The label set is unverified. |

Worked checks against samples: Cy'An Fortitude = rank 4 + level 1 + Con +2 = 7; Lithrei Will = rank 4 + level 2 + Wis +3 = 9; AC `10 + prof + ability + item` matches `acTotal` in all six. These are arithmetic checks only; no build includes the game's own displayed totals to compare against.

## 4. Version drift and edge cases

1. **Placeholder strings**: `"None selected"` in languages/lores/background; `"Not set"` for deity.
2. **Mixed tuple lengths** in `feats` (4 vs 7) and `equipment` (3 vs 4). Index access past length returns `undefined`; destructure defensively.
3. **`"Invested"` on every equipment row** (not a meaningful flag).
4. **`feats[i][1]`** carries a sub-choice though docs say null.
5. **`prepared` not a subset of `spells`**; empty for spontaneous and Cleric.
6. **`Other Spells (Staves etc)`** pseudo-caster with unreliable proficiency; **`Cleric Font`** and **`Homing Drake`** pseudo-casters; archetype casters are named `Archetype <Name>`.
7. **`shieldBonus` string vs null**, `display: ""` for shields.
8. **Duplicate entries** in `specials`, `feats`, `spells` lists (Heal x4).
9. **`specials` has non-rule strings** (`acid`, `Soul`, `No special vision`, skill names).
10. **Unreferenced containers**, empty `equipment`/`weapons`/`armor`.
11. **Level/rank rule**: trained+ adds level; untrained does not (verified on Anya's untrained Bola `attack 1`). `proficiencies` ranks are numbers 0/2/4/6/8.
12. **Dual-class**: `class` plus `dualClass` (Lithrei, Taraan); proficiencies are already merged (Lithrei `perception 4` from the Investigator side). Class DC is a single number (`classDC`), not per class; `keyability` is a single value (the primary class's).
13. **Size**: use `sizeName`.
14. **Version drift**: the export carries no version/remaster field. `doc03` indicates `remastered`, `useUpdatedSpells`, `abp`, etc. exist in the save but none are in the export; legacy vs remaster spell/feat names (e.g. `Telekinetic Hand`, `Healing Plaster`) are inconsistent across rules versions, so name-based AoN lookups prefer remaster entries (`cards.py fetch_aon` sorts remaster first). `doc08` 3.7 notes two shape traps (misnamed `bonushp`, ordinal `size`). Newly added fields in later versions are untested; the viewer must tolerate unknown/missing keys everywhere (`doc03` 2 and 9).
15. **Starfinder leftovers** `piloting`, `computers` in `proficiencies`.
16. **Fetch**: `pb.js` calls `https://pathbuilder2e.com/json.php?id=N` directly; the map records that plain `curl` gets a Cloudflare 403, so browser behaviour (CORS and challenge) remains the gating risk and is out of scope here.

## 5. Discrepancy: max HP

`doc08` 3.7 says `bonushp` is a per-level class-feature HP and `bonushpPerLevel` is a count of HP feats, giving `maxHP = ancestryhp + (classhp + bonushp + bonushpPerLevel + conMod) * L`. `pb.js computeMaxHp` instead computes `ancestryhp + (classhp + conMod + bonushpPerLevel) * L + bonushp` (bonushp flat). Both agree on all six samples because both bonus fields are 0. No sample can disambiguate; the sources conflict. **Decision needed for the spec**: pick one, and cover it with a fixture that has a nonzero value (for example a Toughness or Dragon's Tenacity build, Sorcerer bloodline HP, etc.). Until then treat max HP as the least reliable derived stat.

## 6. Reuse candidates in the SoT repo

### `pathbuilder.js` (JS, pure, directly portable)
Reusable: `parsePathbuilderId`, `pathbuilderJsonUrl`, `extractBuildFromResponse`, `fetchPathbuilderBuild` (error messages already user-facing), `dedicationArchetypeNames` / `buildClassLine`, `abilityMod`, `abilityMods`, `profTotal`, `computeSave`, `computePerception`, `computeSpellStats`, `formatLores`, placeholder filtering. Needs fixing or extending before reuse:
- `computeSave` ignores `mods`.
- `computeMaxHp`: see section 5.
- No skill totals, class DC, focus DC, per-caster stats, bulk, familiar stats, or eidolon.
- `computeSpellStats` uses one caster; spec needs a list of casters, plus focus.
- `pickPrimaryWeapon` tests nonexistent `default`/`starred`; viewer should list all `weapons`.
- `computeProficiencies` reads `proficiencies.shield`, which is never exported.
- `heroTile`-specific shape (`deriveHeroTile`, `createHeroFromImport`, `mergeHeroUpdate`, `isPathbuilderIdInRoster`) is SoT roster logic; do not port.
- `profTotal(rank, ...)` returns `mod + itemBonus` for untrained; correct for default rules, wrong if Proficiency Without Level variants matter (not detectable).

### `generate_cards.py` (Python, networked; port the logic, not the code)
How it classifies names today:
- **Items** (`hero_items`): `weapons[].name`, `armor[].name`, `equipment[][0]`, de-duplicated; lookup against AoN categories `equipment, weapon, armor, shield`. A name ending in a roman numeral falls back to `Base (Type II)` / `Base (II)` (so `Smuggler's Sack II` resolves). A blacklist file (`cards/blacklist.json`) excludes categories/subcategories/names. Gap: ignores `qty`, containers and `Invested`.
- **Spells** (`hero_spells`): every name in `spellCasters[].spells[].list` plus focus cantrips/spells plus `rituals` (prefix `rit:`), de-duplicated. **Gap: never reads `prepared[]`**, so prepared-only spells (Magus Tangle Vine / Time Sense; Cy'An Eat Fire) get no card. Spell category `spell`; a spell result with category `ritual` is rendered through the action card.
- **Actions** (`hero_actions`): `feats[][0]`, `specials`, familiar `abilities`, and `pets` (Animal Companion with `animal` and `mature`), de-duplicated, then universal actions: Basic Actions, Specialty Basic Actions, Exploration Activities pages, and each core skill's untrained actions plus trained actions only when `proficiencies[skill] >= 2`. Lookups search categories `feat, class-feature, familiar-ability, action, heritage, skill-general-action`, restricted so a `class-feature` only counts if its class matches the hero's classes. Ranking prefers `feat` over `class-feature` over others, remaster over legacy, Player Core/GM Core sources.
- **Action vs passive**: a card is kept if it has an action cost (`s.actions` or the `<actions string=...>` in the markdown title), or its category is `action`/`skill-general-action`/`animal-companion`, otherwise it is "passive" and dropped. A cost-less class feature that embeds an action document (`<document ... id="action-N">`, e.g. Spellstrike, Overdrive) is followed to that action. So the classification signal is AoN's data, not anything in the export.
- Data source: `https://elasticsearch.aonprd.com/aon/_search` with `match_phrase` on `name` + `terms` on `category`, and fields `name, category, level, markdown, actions, trait, source_raw, spell_type, range_raw, area_raw, target, saving_throw, duration_raw, remaster_id, legacy_id, class, item_category`. Cached per name under `cards/cache/aon/`. This is a third-party public ES endpoint (not a documented API); for the viewer this is the rules-text contract that the map's "embed AoN rules text" decision depends on, and that decision is out of scope here.
- Known name-resolution gaps visible in the samples: `Elemental Wisp (Earth) (Erudite (Eru))` (compound familiar name), custom/typo'd names (`Acedemia`), `Spellbook (Blank)`, stray `specials` (`Soul`, `acid`), duplicate names. These will return `missing`; the viewer needs a graceful "no rules text" path.

## 7. Answer for #479 (summary)

- The export gives identity, final ability scores, proficiency **ranks** (not totals), a feat tuple list, a flat `specials` name list, name-only equipment, weapons with attack/damage already computed, AC components with a computed total, spellcasters with known/prepared name lists and slot counts, focus data with DC components, and familiars. It gives no rules text, no bulk, no current state, no version flag and no eidolon stat block.
- Must be derived by the viewer: ability mods, every skill/lore total, saves, perception, class DC, spell attack/DC (per caster and focus), max HP, speed, bulk. Weapon attack and AC are already in the export; MAP, ranged/reach and shield bonus are not.
- Biggest irregularities: mixed-length tuples in `feats` and `equipment`; `feats[i][1]` not always null; `prepared` is not a subset of `spells`; `"Invested"` on every item; pseudo-casters (`Other Spells`, `Cleric Font`, innate ancestry casters); `"None selected"` and duplicate/stray strings; `shieldBonus` as a string; unverified shapes for pets, eidolons, formula, runes, striking, resistances, and higher-rank spells because none of the six samples exercises them.
- Reuse `pathbuilder.js` for id/fetch/modifier math after fixing the gaps in section 6; reuse the `generate_cards.py` classification as a specification (names -> AoN lookup, action-cost-based passive filter, followed embedded actions), not the code, and add `prepared[]` to the spell source.
- Open decisions for the spec: max HP formula (section 5); collect and add fixtures for pets/eidolon/formula/higher-level builds before relying on those shapes; how to show `Invested`.
