# 07 — Rules Engine

Pathbuilder does not implement the Pathfinder 2e rules as a general interpreter. It
implements a **modifier pipeline** plus a set of hand-written per-feature hooks. This
document describes both.

> **Rules authority.** This document describes *how the app computes things*. The
> canonical rules are in [10-pathfinder-2e-rules.md](./10-pathfinder-2e-rules.md); where
> the two disagree, that document is authoritative and the difference is recorded in
> its §13. This document has been audited against it — see the "audited against AoN"
> notes inline.

## 1. The six constants that define everything

From the single constants object (`QDi`, bundle line 67959):

```js
// abilities
y2y_1 = ["Strength","Dexterity","Constitution","Intelligence","Wisdom","Charisma"]
z2y_1 = ["Str","Dex","Con","Int","Wis","Cha"]

// bonuses
h2z_1 = "Item Bonus"      i2z_1 = "Status Bonus"
j2z_1 = "Circumstance Bonus"   k2z_1 = "Untyped Bonus"
l2z_1 = "Racial Bonus"    m2z_1 = "Potency Bonus"
n2z_1 = ["Item Bonus","Status Bonus","Circumstance Bonus",
         "Untyped Bonus","Racial Bonus","Potency Bonus"]

// proficiency ranks
z1x_1 = "Untrained"  a1y_1 = "Trained"  b1y_1 = "Expert"
c1y_1 = "Master"     d1y_1 = "Legendary"
e1y_1 = ["Untrained","Trained","Expert","Master","Legendary"]
u1x_1 = 0  v1x_1 = 2  w1x_1 = 4  x1x_1 = 6  y1x_1 = 8

// sizes
r2z_1 = ["Fine","Diminutive","Tiny","Small","Medium","Large","Huge","Gargantuan","Colossal"]
s2z_1..x2z_1 = 0..5      // Tiny=0, Small=1, Medium=2, Large=3, Huge=4, Gargantuan=5
                          // NOTE: these do NOT index r2z_1 — see below

// action costs
y2z_1 = ["No action","Free Action","Reaction","1 Action","2 Actions","3 Actions"]
z2z_1 = [... , "1 to 3 Actions", "1 to 2 Actions"]
a30_1 = {-1:"Free", 0:"Reaction", 1:"1", 2:"2", 3:"3", 4:"1-3", 5:"1-2", 6:"2-3"}

// damage dice
j31_1 = {3:"d3", 4:"d4", 6:"d6", 8:"d8", 10:"d10", 12:"d12"}
```

### 1.0 The two size numbering schemes

There are **two** size encodings and confusing them shifts every size by two steps:

| Scheme | Range | Meaning |
| --- | --- | --- |
| `r2z_1` (display array) | 9 entries | `Fine, Diminutive, Tiny, Small, Medium, Large, Huge, Gargantuan, Colossal` |
| `s2z_1..x2z_1` (the constants actually stored) | `0`–`5` | `0`=**Tiny**, `1`=Small, `2`=**Medium**, `3`=Large, `4`=Huge, `5`=Gargantuan |

The stored/exported `size` value uses the **second** scheme. Verified three ways:

* the export `sizeName` helper `j35(i)` switches `0 → "Tiny"`, `2 → "Medium"`
  (bundle line 81094);
* the constants `s2z_1…x2z_1 = 0…5` are assigned immediately after `r2z_1` but are
  *not* its indices;
* `export-json-sample.json` (a Medium Human) carries `"size": 2, "sizeName": "Medium"`.

So `Medium = 2`, **not** 4. A clone that writes `r2z_1[size]` renders every character
two sizes too small. Always use `sizeName` from the export, or apply the offset.

### 1.1 The action-cost off-by-one

There are **two** action-cost enums and they are offset from each other:

| Meaning | data column (`actions`) | internal enum (`ki2`) |
| --- | --- | --- |
| (hide the icon) | — | `-2` |
| Free action | `-1` | `-1` |
| Reaction | `0` | `0` |
| 1 action | `1` | `1` |
| 2 actions | `2` | `2` |
| 3 actions | `3` | `3` |
| 1–3 actions | `4` | `4` |
| 1–2 actions | `5` | `5` |
| 2–3 actions | `7` | `6` |
| (none) | `""` | — |

So `7` and `6` are the same thing in different spaces, and the label map

```js
a30_1 = {-1:"Free", 0:"Reaction", 1:"1", 2:"2", 3:"3", 4:"1-3", 5:"1-2", 6:"2-3"}
```

is the *internal* space. Reading `actions` straight from the data file without
normalising will mislabel 2–3-action activities as 1–2.

**Proficiency ranks are the numbers themselves, not an enum**: `0, 2, 4, 6, 8`.
That is why the export `proficiencies` block holds values like `2` and `4` and why
arithmetic (`rank + 2`) is used to raise proficiency.

## 2. Proficiency bonus

```js
proficiencyBonus(rank, level) = rank > 0 ? rank + level : 0     // normal rules
proficiencyBonus(rank, level) = rank                             // proficiency-without-level
```

Implementation `XDi().t36(character, rank, level)`:

```js
t36 = function(ch, rank, level) {
  return ch.m3j() ? (rank > 0 ? rank + level : 0) : rank;
}
```

`m3j()` is `addLevelToProficiency` (true unless Proficiency Without Level is on).

The stored `rank` values are `0, 2, 4, 6, 8` — i.e. the *non-level* half of the
canonical bonus. AoN states the bonus as "Trained = your level + 2, Expert = level + 4,
Master = level + 6, Legendary = level + 8", so `rank + level` reproduces the rule
exactly. Untrained is `+0` (not `level + 0`), which is why the `rank > 0` guard exists.

> **Divergence from AoN.** Under Proficiency Without Level, AoN says the bonus becomes
> **+2/+4/+6/+8 and untrained becomes −2**. Pathbuilder's `t36` returns the raw rank
> with **no −2 untrained penalty**. See §13.

The variant `w9t` additionally handles feats that grant a bonus when *untrained*
(Martial Experience, Kasatha Weapon Elegance, Called to War), and `vcm` handles
Untrained Improvisation:

```js
vcm = function(ch, caster, rank, level) {
  return ch.m3j()
    ? (rank > 0 || ch.l3f(level) ? rank + level
       : rank === 0 && hasFeat(ch,"GENERAL_Untrained Improvisation") ? improvise(0, ch.f22(), level)
       : 0)
    : rank;
}
```

A clone needs these three call sites, because "trained/untrained" interacts with
several feats.

## 3. Ability modifiers

```
modifier(score) = floor((score - 10) / 2)
```

Applied to saves, skills, attack, damage, AC (capped by armour Dex cap), spell DC.

**Pathbuilder stores ability *scores*, not modifiers.** The character JSON has
`hashMapAbilityBoosts` (the boosts chosen) and `abilityScoreOverrides` (manual
overrides); the score is derived, and `y35(score)` is the modifier function above.
The Set Abilities dialog renders the *score* with the modifier beneath it.

AoN frames the same system from the other end: **every ability modifier starts at +0**
(equivalent to a score of 10), ancestry boosts are **+1** and flaws **−1**, and at
1st level no modifier may exceed **+4**. Pathbuilder's `+2`-per-boost appearance is an
artefact of displaying scores: a boost moves the score 10 → 12, which is +1 to the
modifier.

**Partial boosts.** AoN: once a modifier is **+4 or higher**, a boost only counts as a
*partial* boost — you need two boosts to raise it by 1. Pathbuilder models this in the
ability renderer:

```js
pjg = function(ch, score, index) {
  this.mjg_1[index].innerHTML = b36(y35(score));          // the modifier
  this.njg_1[index].innerHTML = ch.f22()
    ? (score % 2 ? "&#8682;" : "")                        // ▲ when the score is odd
    : score.toString();
}
```

`▲` (U+21CA) appears when the score is **odd**, i.e. the character has taken one of
the two boosts needed to move the modifier. `ch.f22()` is the "show partial boosts"
flag. A clone must track boosts as a *count per ability*, not a boolean.

## 4. Derived statistics

### 4.1 Hit points

```
maxHP = ancestryHP + (classHP + conMod + classHPBonuses) × level + bonusHP
```

Equivalently, in AoN's step-by-step wording:

```
level 1 total = ancestryHP + classHP + conMod
each level after the 1st += classHP + conMod + bonusPerLevel
```

**The Constitution modifier applies at 1st level too**, because a class's Hit Points are
printed as "N + your Constitution modifier" and the whole amount is granted at 1st level.
An earlier revision of this document wrote the per-level term as
`× (level - 1)`, which drops the 1st-level Constitution bonus and under-reports every
character's HP by their Con modifier.

The variables on line 78506 also reveal that the export's `attributes` block is **raw**:
`ancestryhp`, `classhp`, `bonushp` (actually per-level), and `bonushpPerLevel` (actually
a feat count) carry **no Constitution modifier and no ×level multiplier**. The level is
implied, not applied. See
[08-export-and-integrations.md](./08-export-and-integrations.md) §3.7.

Implementation (`nj.w40`, bundle line 88614):

```js
var n = ancestryHP(i);                              // ancestries_new.hp
var e = rh(classHPPerLevel(i), level);              // classes_new HP, × level
var r = rh(conMod(i), level);                       // Con modifier, × level
...
return (n + e + r + drainPenalty) + classFeatureHP + featHP;
```

* `_ = q96(i) + rh(r96(i), level)` adds class-feature and feat HP bonuses; `r96` counts
  Toughness, Dragon's Tenacity, Fey Skin, Scion Transformation, Unbreakable, Mountain's
  Stoutness, Golem Grafter Dedication, Stonebound Dedication, Resilient Polyps,
  Thick Skin, and Gremlin Hide, and subtracts 1 for Ghostly Resistance.
* **Drained** subtracts `rh(drainedValue, level)` — drained reduces max HP per level.
* The **Stamina variant** (`t.k3j()`) uses `(n + (e / 2 | 0) + drainPenalty) + _`, i.e.
  half of the class HP goes to Stamina instead.
* From the export `attributes` block: `ancestryhp`, `classhp`, `bonushp`,
  `bonushpPerLevel`. `ancestries_new.hp` and `classes_new.hp` supply the base values.

Current HP = `maxHP - damageTaken`, plus `temporaryHP`. Stamina variant splits HP
into HP + Stamina with `staminaDamage` / `spentResolve`.

### 4.2 Armour class

```
AC = 10
   + proficiencyBonus(armourRank, level)
   + min(dexMod, armourDexCap)
   + armourItemBonus
   + shieldBonus (only if raised)
   + otherBonuses + penalties
```

The `level` term is already inside `proficiencyBonus()` — do not add it a second time.
Under Proficiency Without Level the same call returns the level-free rank.

Implementation (`sh(ddt).ohg`, bundle ~141700):

```js
ac = 10 + proficiencyBonus + dexBonus(capped) + itemBonus
```

* `shieldBonus` is only added when the shield is raised.
* `acProfBonus` / `acAbilityBonus` / `acItemBonus` / `acTotal` / `shieldBonus` are
  exported separately.
* Automatic Bonus Progression replaces the item bonus with a level-derived potency
  bonus.
* Unarmored uses the `unarmored` proficiency; explorer's clothing counts as
  unarmored.
* See [10-pathfinder-2e-rules.md](./10-pathfinder-2e-rules.md) §6.2 for the canonical
  formula and the armour check/speed penalty rules.

### 4.3 Saves

```
save = proficiencyBonus(saveRank, level) + abilityMod + itemBonus + otherBonuses + penalties
```

* Fortitude uses Con, Reflex Dex, Will Wis.
* `itemBonus` comes from runes/invested items and is tracked separately (the export
  has `fort_prof_bonus`, `fort_item_bonus`, `fort_con_bonus`, etc.).
* Classes grant differing initial ranks (Fighter: Expert Fort/Reflex, Trained Will).

### 4.4 Perception

`perception = proficiencyBonus(perceptionRank, level) + Wis mod + itemBonus`.
Class table sets `Expert in Perception` for most martial classes, `Trained` for casters.

### 4.5 Skills

```
skillMod = key attribute modifier + proficiencyBonus(rank, level) + itemBonus + otherBonuses − armorCheckPenalty
```

The armour check penalty is a **penalty**, so it is subtracted. AoN restricts it to
**Strength- and Dexterity-based skill checks and skill DCs, except those with the
attack trait**; the bundle approximates this with the explicit list Unarmored / Light
Armor / Reflex / Acrobatics / Stealth / Thievery plus any Str/Dex skill. It is negated
entirely when the armour's Strength threshold is met.

Lore skills use Int by default and carry their own rank in `listCustomLores` /
`hashMapSkillIncreases`.

### 4.6 Class DC

`classDC = 10 + proficiencyBonus(classDCRank, level) + keyAbilityMod + itemBonus`.

### 4.7 Spell DC / attack

See [04-spell-system.md](./04-spell-system.md) §7.

### 4.8 Bulk

```
encumberedLimit = adjust(5 + strMod)
maxLimit        = adjust(10 + strMod)
adjust(x) = Tiny → floor(x/2), Large → 2x, Huge → 4x, Gargantuan → 8x, else x
```

Item bulk: `L` counts as **0.1** (ten light items = 1 Bulk, fractions rounded down),
`–` as 0. A backpack ignores the bulk of its contents. A material with `reducesBulk`
subtracts that amount. 1 000 coins = 1 Bulk. See
[10-pathfinder-2e-rules.md](./10-pathfinder-2e-rules.md) §8.1.

### 4.9 Speed

`speed = ancestrySpeed + speedBonus - armourSpeedPenalty` (feet). `attributes.speed`
and `attributes.speedBonus` are both exported; the armour's `speedPenalty` is applied
on top. Encumbrance adds another penalty.

**Speed is tracked per movement type, not as one number.** The engine keeps five
buckets (`fcf_1` land, `gcf_1` climb, `hcf_1` swim, `icf_1` fly, `jcf_1` burrow) and
modifiers carry a *speed type*:

| `speedType` | Meaning |
| --- | --- |
| `0` | Land |
| `1` | Swim |
| `2` | Climb |
| `3` | Burrow |
| `4` | Fly |
| `5` | **All speeds** (applies to every bucket) |

So a modifier built with `dqi(level, -10, 3, 5)` is "−10 ft to all speeds", while
`dqi(level, 5, 0, 0)` is "+5 ft land only". A clone that models speed as a single
integer will get Encumbered, Fleet, and flight-granting feats wrong.

Armour speed penalties are reduced by 5 ft when the wearer meets the armour's Strength
threshold, and several feats (Unburdened Iron, Armiger's Mobility, Hellknight
Mobility, Mighty Shoulders, Shell Insurance) remove or reduce the penalty further.

## 5. The modifier pipeline

Every bonus/penalty in the app is an entry in a modifier map with a **bonus type**.
The pipeline is:

```
1. Collect all applicable modifiers for a statistic.
2. Remove duplicates of the same type, keeping the highest (bonuses) or lowest
   (penalties) — the standard PF2e "typed bonuses don't stack" rule.
3. Sum the surviving values.
4. Add the untyped/base parts (proficiency, ability, level).
```

Bonus types and their ordering key (`k31_1`):

| Type | Key |
| --- | --- |
| `Item Bonus` | 0 |
| `Status Bonus` | 1 |
| `Circumstance Bonus` | 2 |
| `Untyped Bonus` | 3 |
| `Racial Bonus` | 4 |
| `Potency Bonus` | 5 |

Two entry points that matter:

* `sh(Pf).u24(target, source, label, value)` — add an **untyped** modifier
  (`r.u24(n, t, "Speed Boosters", …)`)
* `r.f24(target, source, label, value)` — add a **typed** modifier (used by the
  automaton/otherworldly protection hooks)

The same pipeline serves conditions, custom buffs, feats, items, and class features.
Conditions attach modifiers with the exact names the rules use, e.g.
`"Clumsy (Encumbered)"` for the encumbrance-induced clumsy.

### 5.1 Conditions

Every condition is a small object with per-target hooks. Encumbrance, for example:

```js
// Encumbered: clumsy 1, plus a -10 ft penalty to ALL Speeds (min 5 ft)
ah(this.bag_1.e97_1.e2("Clumsy")).f97(i, t, "Clumsy (Encumbered)", 1),
r.u24(t, i, n, dqi(i.t1v().j36(), -10, 3, 5))
```

`dqi(level, value, target, speedType)` builds a speed modifier: `target = 3` means
"all Speeds" (see §4.9), and `speedType = 5` is the "all" bucket. This matches AoN's
Encumbered condition exactly: **clumsy 1 and −10 feet to all Speeds (minimum 5 feet)**.

The `+5` you will see in the speed routine is *not* the encumbrance penalty — it is a
correction that gives back 5 feet when a feat (Unburdened Iron, Armiger's Mobility,
Mighty Shoulders, Shell Insurance) or a heavy-armour interaction has already reduced
the armour's speed penalty. Read the whole routine before concluding anything about
net speed.

`conditions.value` = `TRUE` marks numeric conditions. The UI renders a number stepper
for those and a plain on/off for the rest.

### 5.2 Custom buffs

User-authored buffs use the same modifier shape and can target:

* Ability checks, attack rolls, damage, AC, saves, skills, specific skills
* Speed, perception, HP, bulk
* With a chosen bonus type and an optional conditional note

They live in `hashMapActiveCustomBuffs` and are toggled with
`listCurrentlyInactiveBuffs`.

## 6. Feats that change math

Rather than encoding rules, the code has explicit hooks keyed on feat id. This is the
single biggest maintenance cost in the codebase and a clone must decide whether to
copy it or generalise.

Examples of hard-coded hooks:

| Feat id | Effect |
| --- | --- |
| `GENERAL_Toughness` | `bonushpPerLevel += 1` (plus level-1 bump) |
| `GENERAL_Fleet` | `speedBonus += 5` |
| `GENERAL_Untrained Improvisation` | untrained skills get `level/2` (or `level`) |
| `GENERAL_Martial Experience` · `SF_KASATHA_Kasatha Weapon Elegance` · `SF_FORMIAN_Called to War` | untrained weapon gets a scaling proficiency bonus |
| `GENERAL_Animal Whisperer` etc. | grant a companion |
| `ARCHETYPE_*_Basic … Spellcasting` | adds an archetype caster |
| `WIZARD_Spellbook` (special) | `q22_1 = true` on the Wizard caster |
| `CLERIC_Domain Initiate` | adds a focus spell from `spells_domain` |
| `*_Versatile Heritage` | opens a `"Heritage Feat<choice>"` child slot |
| `GENERAL_Weapon Proficiency` / `Armor Proficiency` | adds a proficiency rank |
| `GENERAL_Adopted Ancestry` | unlocks another ancestry's feat list |
| `ARCHETYPE_*_Dedication` | registers the archetype as unlocked |

Detection is by string id, so a clone that keeps the ids keeps the behaviour.

## 7. Class features ("specials")

Class features are rows in `specials_class_<class>` plus `specials_universal`. They
carry `name`, `level`, `actions`, `traits`, `text_req`, `text_descrip`, `src`, `url`
and behave exactly like feats except they are granted by level, not chosen.

Sub-choices are the `specials_class_<class>_<group>` tables:

```
specials_class_cleric_doctrines        → Cloistered / Warpriest
specials_class_cleric_fonts            → Healing / Harmful
specials_class_barbarian_instincts     → Animal / Dragon / Giant / …
specials_class_champion_causes         → …
specials_class_champion_tenets         → …
specials_class_druid_orders            → …
specials_class_witch_patrons           → …
specials_class_witch_lessons[_greater|_major]
specials_class_wizard_theses           → …
specials_class_psychic_conscious / _subconscious
specials_class_oracle_mysteries        → …
specials_class_sorcerer (bloodlines)
specials_class_summoner_eidolons
specials_class_inventor_innovations / _modifications_*
specials_class_magus_hybrids
specials_class_thaumaturge (implements, in other_thaumaturge_implements)
specials_class_gunslinger_deeds / _actions
specials_class_exemplar_* (ikons, epithets)
specials_class_necromancer_fatal_methods / _grim_fascinations
specials_class_commander_tactics
specials_class_animist_practices
specials_class_alchemist_research_fields
specials_class_rogue_rackets
specials_class_swashbuckler_styles
specials_class_ranger_edges
specials_class_investigator_methodologies
specials_class_monk (stances)
```

Plus independent special tables:

```
specials_actions                → granted actions
specials_domains                → cleric/champion domains
specials_eidolon_abilities
specials_mythic_callings
specials_weapon_groups
specials_automaton_enhancements
specials_archetype_soulforger
```

Selecting one writes `hashMapSpecialSelections[<specialName>][<prompt>] = <option>`.

## 8. Level-up flow (what the engine does per level)

```
for level 1..N:
  1. Ensure the class exists and lock ancestry/background/class at level 1.
  2. Ask the class manager which slots this level grants:
       class feats, skill feats, general feats, ancestry feats,
       skill increases, ability boosts, class features (specials)
  3. Render one cog button per slot; each opens its picker.
  4. When a picker commits, write to the appropriate hashMap and re-derive.
  5. Recompute derived stats for this level and every later level.
```

Because everything is derived, changing an *earlier* level re-derives later ones. This
is why the app warns when a later-level choice becomes invalid ("Prerequisites not met
or taken too many times!").

## 9. Variant rules

Every one of these is a `boolean` field on the character JSON. They are not
special-cased in the rules engine; they are *inputs* to the slot-calculation and
proficiency functions.

| Variant | Field | Effect | AoN match |
| --- | --- | --- | --- |
| Free Archetype | `freeArchetype` | Extra feat slot every even level, archetype-only | ✅ |
| — relaxed | `ignoreFreeArcheRest` | Free-archetype slots may take any feat | app-only |
| — relaxed | `ignoreFreeArcheAbilityReq` | …and ignore ability prereqs | app-only |
| Automatic Bonus Progression | `abp` | Remove potency/striking/resilient runes; grant their effects at fixed levels | ✅ |
| Proficiency Without Level | `!addLevelToProficiency` | Proficiency bonus drops the level term | ⚠ **missing the −2 untrained penalty** (doc 10 §3.1) |
| Ancestry Paragon | `ancestryParagon` | Extra ancestry feat at 1st and every even level | ✅ |
| Gradual Ability Boost | `gradualAbilityBoost` | 1 boost at each of 2/3/4/5, 7/8/9/10, 12/13/14/15, 17/18/19/20 | ✅ |
| Dual Class | `dualClass` + `dualClassKeyAbility` | Two classes; both advance | ✅ |
| Stamina | `useStamina` | HP split into half HP + half Stamina; `spentResolve` | ✅ |
| Skill Paragon | `skillParagon` | Extra skill increases | ✅ |
| Mythic | `showMythic`, `mythicAsArchetypes`, `mythicAlternative` | Mythic feats/callings/destinies | ✅ |
| Half heritages | `allowHalfHeritages` | Allow two heritages | app-only |
| Optional flaw | `optionalFlaw` | Two voluntary flaws for one extra boost | ✅ (base rule, optional) |

The Gradual Ability Boost level list is exactly `b1n_1 =
[2,3,4,5,7,8,9,10,12,13,14,15,17,18,19,20]` in the bundle, matching AoN's four
"sets" of four boosts.

**Not implemented:** Point Buy and Alternative Scores (both in
[Ability Scores Variants](https://2e.aonprd.com/Rules.aspx?ID=1299)). A clone that wants
them must add them; the existing `abilityScoreOverrides` field is the closest hook.

## 10. Starfinder mode

The same engine serves Starfinder 2e. Differences are data-driven plus a handful of
fields:

* Separate tables (`*_sf`, `pets_followers`, `items_*` with tech/biotech)
* `starbuilderCharacter`, `starbuilderUseCredits` (credits instead of gold)
* Extra proficiencies `Computers`, `Piloting`
* Ship/siege weapons in `listPlayerSiegeWeapon`
* Different classes/casters (`Envoy`, `Mystic`, `Operative`, `Solarian`, `Soldier`,
  `Witchwarper`, `Mechanic`, `Technomancer`)

A Pathbuilder-only clone can ignore all of this while keeping the fields for
round-tripping.

## 11. Where the rules *aren't*

Things Pathbuilder deliberately does not enforce (important for a clone's scope):

* **No tactical grid, no encounter simulation.** The dice tray rolls dice; nothing
  else uses them.
* **No automatic action economy** — action counts are displayed, not spent.
* **No automatic damage application** — except the HP box and shield HP.
* **No rules validation beyond prerequisites.** Illegal builds are possible; the app
  warns but does not block.
* **No automatic condition expiry.**
* **Spell damage/heights are text**, not structured. Heightening changes the rank,
  not the numbers.
* **Most feat effects are descriptive.** Only a curated set changes derived numbers.
* **Equipment effects are mostly descriptive** except AC, saves, skills, bulk, and a
  small set of runes.

A clone should reproduce this scope: it is a *character sheet builder*, not a
virtual tabletop.

## 12. Practical rule-engine checklist

If you are rebuilding the engine, implement in this order:

1. Constants (ranks, sizes, abilities, bonus types, action costs).
2. `proficiencyBonus(rank, level)` with the PWL switch.
3. Ability modifiers and the ability-boost arithmetic.
4. HP, AC, saves, perception, skills, class DC, spell DC.
5. Bulk + encumbrance.
6. The modifier pipeline with typed non-stacking.
7. Conditions and custom buffs on top of the pipeline.
8. Feat hooks keyed by id — start with the ~20 that are actually mechanical.
9. Class-feature (special) hooks per class.
10. Variant-rule switches as inputs to 2/3/8.
