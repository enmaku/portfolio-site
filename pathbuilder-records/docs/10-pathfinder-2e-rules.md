# 10 — Pathfinder 2e Rules Primer

This document is the **rules reference** for the clone project. It exists so that the
other documents can be checked against a single authoritative statement of how
Pathfinder 2nd Edition actually works.

**Source of truth:** [Archives of Nethys](https://2e.aonprd.com/) (AoN), the official
licensed SRD for Pathfinder 2e. Where this document and any other document in this
series disagree, **this document wins** and the other document is wrong.

**Scope.** This is a *primer*, not a reprint. It covers the rules that a character
builder must implement or display, and it deliberately omits content that can be
looked up on AoN on demand (spell lists, feat text, item stat blocks, creature
statistics). Page references are given as AoN URLs so any claim can be re-verified.

**How to read the citations.** `Rules.aspx?ID=2027` is the AoN rules page for
Character Creation. Class pages are `Classes.aspx?ID=<n>`. Spell pages are
`Spells.aspx?ID=<n>`.

**Rules vs. rights.** This document states *what the rules are*. It does not state what
you may copy — Pathbuilder's code, UI, and file format, and Paizo's rules *text*, are
separate rights questions answered in
[11-legal-and-licensing.md](./11-legal-and-licensing.md). Mechanics themselves are not
copyrightable, but reproducing rules *text* is licensed (OGL 1.0a / ORC).

---

## 1. Core resolution: checks and degrees of success

*Source: [Checks](https://2e.aonprd.com/Rules.aspx?ID=2278)*

A **check** is `d20 + modifiers` compared against a **DC**.

| Result | Outcome |
| --- | --- |
| ≥ DC + 10 | **Critical success** |
| ≥ DC | **Success** |
| < DC | **Failure** |
| ≤ DC − 10 *(i.e. failed by 10 or more)* | **Critical failure** |

**When a check is made against you**, you instead use a **DC = 10 + your total modifier**
for that statistic. A character with a +4 Reflex save has **Reflex DC 14**.

Two adjustments apply **before** any other degree-of-success changes:

* A **natural 20** improves the degree of success by one step.
* A **natural 1** worsens the degree of success by one step.

So a natural 20 on a roll that already beat DC + 10 is a critical success (it cannot
improve further), and a natural 1 on a roll that already failed by 10 is a critical
failure. Conversely, a very high modifier can beat a DC even on a natural 1.

If an effect doesn't list a critical success or critical failure entry, the critical
results are the same as the ordinary success or failure.

**Check types.** Checks are named by what they test: *attack roll*, *skill check*,
*saving throw*, *Perception check*, *flat check*. A **flat check** is `d20` against a
DC with no modifiers at all — used for things like recovery from dying and
persistent damage.

**Modifier stacking.** Bonuses and penalties of the same **type** do not stack; you take
only the *highest* bonus and the *worst* penalty of each type. The canonical types are:

| Type | Stacks with |
| --- | --- |
| Circumstance | nothing of the same type |
| Item | nothing of the same type |
| Status | nothing of the same type |
| **Untyped** | **everything** |

Important subtleties:

* A **bonus and a penalty of the same type both apply**. A +1 status bonus from
  *heroism* and a −2 status penalty from *sickened* both land on the roll.
* **Untyped penalties always add together** rather than taking the worst. This is why
  MAP and the range penalty both apply to the same ranged attack.

Pathbuilder's bonus-type list adds two non-canonical entries — `Racial Bonus` and
`Potency Bonus` — which are internal groupings, not PF2e bonus types. See §13.

**Multiple Attack Penalty (MAP).** *Source: [Checks](https://2e.aonprd.com/Rules.aspx?ID=2278)*

| Attack | Normal | Agile weapon |
| --- | --- | --- |
| First | none | none |
| Second | −5 | −4 |
| Third and later | −10 | −8 |

**Every check with the attack trait counts toward MAP** — Strikes, spell attack rolls,
and skill actions like Shove. MAP applies only **during your turn**; a Reactive Strike
on someone else's turn does not carry it. One exception: an attack you **Readied**
carries the MAP you had when you used Ready.

**Attack roll formulas.**

```
melee attack  = d20 + Str mod (or Dex for finesse) + proficiency + other bonuses + penalties
ranged attack = d20 + Dex mod                        + proficiency + other bonuses + penalties
spell attack  = d20 + casting attribute mod          + proficiency + other bonuses + penalties
```

**Range penalty.** Ranged and thrown weapons have a **range increment**. No penalty
within the first increment; **−2 per additional increment** beyond it. You can attack up
to **six increments** away (−10 at the farthest). MAP and the range penalty stack
because both are untyped. For example, a crossbow (increment 120 ft) shooting at a
target 500 ft away is in the 5th increment for **−8**.

---

## 2. Attribute modifiers

*Source: [Character Creation](https://2e.aonprd.com/Rules.aspx?ID=2027)*

> **Terminology.** The 2024 remaster renamed "ability scores" to **attribute
> modifiers** and dropped the 10-based score entirely. AoN's current text uses
> *attribute modifier*, *attribute boost*, and *attribute flaw*. Older material (and
> Pathbuilder's UI) still says "ability score". They are the same system.

### 2.1 The base

**Every attribute modifier starts at +0.** There is no "10" in the current rules — a
+0 modifier *is* average. The six attributes are Strength, Dexterity, Constitution,
Intelligence, Wisdom, Charisma.

### 2.2 Boosts and flaws

* An **attribute boost** increases a modifier by **+1**.
* An **attribute flaw** decreases a modifier by **−1**.
* **At 1st level no modifier may exceed +4**, and none may be lower than −1.
* When you gain **multiple boosts at the same time**, each must go to a **different**
  attribute. You cannot apply two simultaneous boosts to the same attribute.

### 2.3 Partial boosts

> If the attribute modifier you're boosting is **already +4 or higher**, the boost is
> instead recorded as a **partial boost**. A second boost applied to an attribute that
> already has a partial boost increases the modifier by 1 and clears the partial.

This is the rule most often missed. It means that above +4, **two boosts are needed per
+1**, and a character can be "half way" to an increase. A character builder must track
a *count* of boosts per attribute, not a boolean.

### 2.4 Where boosts come from

| Step | Boosts |
| --- | --- |
| Ancestry | Two fixed boosts + one free boost, **or** an ancestry flaw + boosts, **or** (alternate) two free boosts |
| Voluntary flaws (optional) | Up to two additional flaws, max one per attribute; taking them grants one extra free boost |
| Background | **Two** boosts — one restricted to a choice of two attributes, one free |
| Class | One boost to the class's **key attribute** |
| Free boosts | **Four** free boosts, each to a different attribute |
| Levels 5, 10, 15, 20 | **Four** free boosts each, each to a different attribute |

**Alternate ancestry boosts.** You may always replace an ancestry's listed boosts and
flaws with **two free boosts**.

**Voluntary flaws.** You may take up to two extra flaws (max one per attribute) during
the ancestry step; doing so grants one additional free boost.

### 2.5 Gradual Ability Boost (variant)

*Source: [Ability Scores Variants](https://2e.aonprd.com/Rules.aspx?ID=1299)*

Instead of four boosts at 5/10/15/20, the character gains **one boost at each of**
2, 3, 4, 5 · 7, 8, 9, 10 · 12, 13, 14, 15 · 17, 18, 19, 20. Each group of four is a
single "set", so within a set you still can't boost the same attribute twice.

### 2.6 Point Buy (variant)

Also in the Ability Scores Variants page. Scores start at 10, ancestry flaws drop them
to 8, and you spend Ability Points on a cost curve (8→−2 pts, 10→0, 12→2, 14→5, 16→10,
18→17). Maximum purchasable score at creation is 18. This variant **replaces** boosts
and flaws entirely. Pathbuilder does not implement it.

---

## 3. Proficiency

*Source: [Step 9: Calculate Modifiers](https://2e.aonprd.com/Rules.aspx?ID=2027)*

| Rank | Proficiency bonus |
| --- | --- |
| Untrained | **+0** |
| Trained | **level + 2** |
| Expert | **level + 4** |
| Master | **level + 6** |
| Legendary | **level + 8** |

Note the asymmetry: **untrained is a flat +0, not `level + 0`.** A 15th-level
character untrained in Athletics adds nothing from proficiency.

Proficiency ranks are raised by class features, feats, and skill increases. A
character's rank in a statistic is the *highest* rank granted by any source.

### 3.1 Proficiency Without Level (variant)

*Source: [Proficiency without Level](https://2e.aonprd.com/Rules.aspx?ID=1370)*

The level term is removed: **+2 trained, +4 expert, +6 master, +8 legendary**, and
**untrained becomes −2** (AoN explicitly recommends the −2). Additionally, every
creature/hazard/item statistic that includes a proficiency bonus is reduced by that
element's level, and skill DCs drop to the "Simple Skill DCs (No Level)" table
(untrained 10, trained 15, expert 20, master 25, legendary 30).

---

## 4. Character creation order

*Source: [Character Creation](https://2e.aonprd.com/Rules.aspx?ID=2027)*

1. **Create a concept.**
2. **Start attribute modifiers** at +0 in all six.
3. **Select an ancestry** — pick the ancestry, a heritage, assign free boosts and any
   voluntary flaws, and choose a 1st-level ancestry feat. Ancestry sets size, Speed,
   languages, and contributes Hit Points.
4. **Pick a background** — grants two boosts, training in one skill, training in one
   Lore skill, and a skill feat.
5. **Choose a class** — grants a boost to the key attribute.
6. **Finish attribute modifiers** — apply four free boosts, each to a different
   attribute. Final range should be −1 to +4.
7. **Record class details** — total HP = ancestry HP + class HP; initial proficiencies;
   choose trained skills; class features; spells.
8. **Buy equipment** — **15 gp** at 1st level.
9. **Calculate modifiers** — Perception, saves, Strikes, skills.
10. **Finishing details** — edicts/anathema, deity, age, gender, appearance, personality.

**Trained-skill collision rule.** If a class would make you trained in a skill you are
already trained in (usually from your background), **you may pick a different skill**
instead. Pathbuilder implements this as `classOptionalTrainedSkill`.

---

## 5. Leveling up

*Source: [Leveling Up](https://2e.aonprd.com/Rules.aspx?ID=2065)*

* **XP threshold:** each time your character reaches **1 000 XP**, their level increases
  by 1 — and you then **deduct 1 000 XP** from the total. XP is therefore a **running
  remainder**, not a cumulative lifetime total. Any leftover XP counts toward the next
  level.
* **Hit Points:** each level adds `class HP per level + Constitution modifier`
  (plus any feat/item bonuses). If an attribute boost raises your Constitution
  modifier, **recalculate maximum HP with the new modifier** — typically +1 HP per level.
* **Proficiency:** every trained-or-better proficiency bonus increases by 1
  automatically, so AC, attack rolls, Perception, saves, skills, spell DC and class DC
  all rise by at least 1.
* **Intelligence boost:** raises your Intelligence modifier → **one additional trained
  skill and one additional language**.
* **Class advancement table:** each class lists what it grants at each level — class
  feats, skill feats, general feats, ancestry feats, skill increases, ability boosts,
  and class features.

### 5.1 Leveling-up checklist (AoN's own list)

1. Increase level by 1 and subtract 1 000 XP.
2. Increase maximum Hit Points by the amount listed in the class entry.
3. Add class features from the class advancement table, including attribute boosts and
   skill increases.
4. Select feats as indicated on the advancement table.
5. Add spells and spell slots if the class grants spellcasting.
6. Increase all trained-or-better proficiency bonuses by 1, plus any increases from
   skill increases or class features.
7. Adjust bonuses from feats and abilities that are based on your level (e.g. Toughness).

### 5.2 The standard slot cadence

Most classes follow this pattern. The table below is taken from the Fighter advancement
table and is representative — **always read the specific class's own table**, because
casters and some martials differ (e.g. a wizard's class feats are *Wizard Feats*).

| Level | Grants |
| --- | --- |
| 1 | Ancestry and background, attribute boosts (**four free boosts**), initial proficiencies, class feat, class features |
| 2 | Class feat, skill feat |
| 3 | General feat, skill increase |
| 4 | Class feat, skill feat |
| 5 | Ancestry feat, attribute boosts, skill increase |
| 6 | Class feat, skill feat |
| 7 | General feat, skill increase |
| 8 | Class feat, skill feat |
| 9 | Ancestry feat, skill increase |
| 10 | Attribute boosts, class feat, skill feat |
| 11 | General feat, skill increase |
| 12 | Class feat, skill feat |
| 13 | Ancestry feat, skill increase |
| 14 | Class feat, skill feat |
| 15 | Attribute boosts, general feat, skill increase |
| 16 | Class feat, skill feat |
| 17 | Ancestry feat, skill increase |
| 18 | Class feat, skill feat |
| 19 | General feat, skill increase |
| 20 | Attribute boosts, class feat, skill feat |

Summarised:

| Grant | Levels |
| --- | --- |
| Class feat | 1st, then every even level |
| Skill feat | 2nd, then every even level |
| General feat | 3rd, then every 4 levels |
| Skill increase | 3rd, then every 2 levels |
| Ancestry feat | 1st *(from the ancestry step)*, then 5th and every 4 levels |
| Ability boosts | 1st (four free), then 5th, 10th, 15th, 20th |

**Class feats are not always called "Class Feat".** A wizard's class feats are
**Wizard Feats**; a cleric's are **Cleric Feats**. Pathbuilder stores these under
per-class slot keys, so a clone must not assume a single generic slot name.

**Fighter-specific note.** The Fighter table lists no ancestry feat at 1st level
because that feat comes from the ancestry step, not the class. Several classes also
have a **no class feat at 1st level** pattern (e.g. Cleric grants *Cleric Feat* only
from 2nd).

### 5.3 Skill increases

A skill increase raises one skill's proficiency by one rank (Trained → Expert →
Master → Legendary). You cannot skip ranks. Some classes restrict which skills can be
raised (e.g. a rogue's skill increases can go to any skill).

---

## 6. Derived statistics

### 6.1 Hit Points

A class's Hit Points are printed as a number **plus your Constitution modifier**, and
that whole amount is granted at 1st level:

```
level 1 total = ancestryHP + classHP + conMod
each level after the 1st += classHP + conMod + bonusPerLevel
```

Equivalently:

```
maxHP = ancestryHP + (classHP + conMod + classHPBonuses) × level + bonusHP
```

**The Constitution modifier applies at 1st level.** A 1st-level fighter with
Constitution +2 has 10 + 2 = 12 HP from their class, plus ancestry HP.

* Ancestry HP is granted once, at 1st level (`ancestries_new.hp`).
* Constitution modifier applies **at every level, including the 1st**.
* Toughness and similar feats add flat and per-level bonuses.
* **Drained** reduces maximum HP by the drained value **per level**.

**Dying, wounded, doomed.** *Source: [Hit Points, Healing, and Dying](https://2e.aonprd.com/Rules.aspx?ID=2319)*

* At **0 HP** you fall unconscious and gain **dying 1**.
* If the effect that knocked you out was a **critical hit** by the attacker or **your
  own critical failure**, you gain **dying 2** instead.
* Add your **wounded** value to the dying value you gain.
* **Nonlethal damage** does not give you the dying condition — you are simply
  unconscious at 0 HP.
* **Dying 4 = death** (reduced by your **doomed** value).
* **Taking damage while already dying** increases your dying value by 1, or by 2 if the
  damage came from a critical hit or your own critical failure.
* **Recovery check:** at the start of each of your turns while dying, attempt a **flat
  check with DC 10 + your current dying value**.

  | Result | Effect |
  | --- | --- |
  | Critical success | dying value −2 |
  | Success | dying value −1 |
  | Failure | dying value +1 |
  | Critical failure | dying value +2 |

* **Losing the dying condition:** you lose it when it reaches **dying 0**. If you are
  still at 0 HP you remain unconscious; you wake automatically if you ever reach
  **1 HP or more**.
* **Anytime you lose the dying condition, you gain wounded 1**, or increase your
  existing wounded value by 1.
* **Wounded** is removed by resting or by a successful Treat Wounds.

### 6.2 Armor Class

```
AC = 10
   + proficiencyBonus(armorRank, level)
   + min(dexMod, armorDexCap)
   + armorItemBonus
   + otherBonuses
   + penalties
```

* Unarmored characters use the **unarmored** proficiency and no Dex cap.
* Explorer's clothing counts as unarmored.
* A **raised shield** adds its circumstance bonus to AC.
* **Armor check penalty** applies to Strength- and Dexterity-based skill checks
  **except those with the attack trait**, and is negated entirely if you meet the
  armor's Strength threshold.
* **Armor speed penalty** is reduced by 5 feet if you meet the armor's Strength
  threshold.

### 6.3 Saving throws

```
save = proficiencyBonus(rank, level) + attributeMod + itemBonus + otherBonuses
```

| Save | Attribute |
| --- | --- |
| Fortitude | Constitution |
| Reflex | Dexterity |
| Will | Wisdom |

### 6.4 Perception

```
perception = proficiencyBonus(rank, level) + Wis mod + itemBonus
```

*Source: [Perception and Detection](https://2e.aonprd.com/Rules.aspx?ID=2400)*

Perception is used for initiative and for detecting hidden creatures. Detection states
are **observed → hidden → undetected → unnoticed**.

### 6.5 Skills

```
skillMod = proficiencyBonus(rank, level) + attributeMod + itemBonus + otherBonuses − armorCheckPenalty
```

*Source: [Skills](https://2e.aonprd.com/Rules.aspx?ID=2134)*

```
skill modifier = key attribute modifier + proficiency bonus + other bonuses + penalties
```

| Skill | Key attribute |
| --- | --- |
| Acrobatics, Stealth, Thievery | Dexterity |
| Arcana, Crafting, Occultism, Society | Intelligence |
| Athletics | Strength |
| Deception, Diplomacy, Intimidation, Performance | Charisma |
| Medicine, Nature, Religion, Survival | Wisdom |

**Lore skills** are Intelligence-based and always specific ("Warfare Lore",
"Scribing Lore"). Each is its own skill with its own proficiency rank. **If you would
become trained in a Lore skill you already have, the replacement must also be a Lore
skill.**

**Simple skill DCs** (the default, level-scaled game):

| Task | Simple DC |
| --- | --- |
| Untrained | 10 |
| Trained | 15 |
| Expert | 20 |
| Master | 30 |
| Legendary | 40 |

(Note the jump: 10/15/20/**30/40**. Under Proficiency Without Level the same ladder
becomes 10/15/20/**25/30** — see §3.1.)

**Trained-skill collision rule.** *Each time after the first* that you would become
trained in a skill, you instead allocate that training to **any other skill of your
choice** (a Lore skill if the duplicate was a Lore skill).

**Armor and skills.** Armor check penalties apply to **Strength- and Dexterity-based
skill checks and skill DCs**, unless the action has the **attack** trait.

**Secret checks.** Actions with the **secret** trait are rolled by the GM, who reports
only the effect.

**Untrained actions.** Most skills have actions usable untrained; some are
**trained-only**. A builder must know which is which to validate choices.

### 6.6 Class DC

```
classDC = 10 + proficiencyBonus(classDCRank, level) + keyAttributeMod + itemBonus
```

### 6.7 Spell DC and spell attack

```
spellDC     = 10 + proficiencyBonus(rank, level) + castingAttributeMod + itemBonus + otherBonuses
spellAttack = d20 + proficiencyBonus(rank, level) + castingAttributeMod + itemBonus + otherBonuses
```

**Innate spells use Charisma** unless the ability says otherwise.

---

## 7. Actions and the action economy

*Source: [Actions](https://2e.aonprd.com/Rules.aspx?ID=2335)*

* Each turn you get **3 actions** and **1 reaction**.
* Actions cost 1, 2, or 3 actions; **free actions** cost nothing; **reactions** use
  your reaction for the round.
* **Activities** are multi-action abilities that may also include free actions and
  reactions as components.
* Some abilities are printed as **1 to 3 actions**, **1 to 2 actions**, or
  **2 to 3 actions** — the player chooses how many to spend, and the effect scales.

### 7.1 Movement

*Source: [Movement](https://2e.aonprd.com/Rules.aspx?ID=2345)*

* A creature's **Speed** normally means its **land Speed**. Special movement types
  (**burrow, climb, fly, swim**) each have their **own Speed value**.
* **Stride and Step use your land Speed only.** Moving with a special movement type
  requires its own action (Burrow, Climb, Fly, Swim), and **you cannot Step** with one.
* **Speed cannot be reduced below 5 feet** by penalties unless a rule says otherwise.
* **Switching movement types** requires ending the current action and starting a new one
  (climb 10 ft, *then* Stride).
* **Movement cost** ("spending movement") is how many feet of Speed a move consumes;
  **difficult terrain** makes a distance cost more (typically double).
* Having a **swim Speed** means you auto-succeed at Swimming, move up to your swim
  Speed, and gain a **+4 circumstance bonus** to Athletics checks to Swim.
* Some rules change all movement types at once; others target one. This is why a
  character's Speed must be stored **per movement type**.

---

## 8. Equipment

*Source: [Equipment](https://2e.aonprd.com/Rules.aspx?ID=2143)*

### 8.1 Bulk

```
encumberedLimit = 5 + Str mod     (at or above this, you are encumbered)
maxLimit        = 10 + Str mod    (you cannot hold or carry more than this)
```

* **Light (L) items:** **10 light items = 1 Bulk**, and fractions are **rounded down**
  (9 light items = 0 Bulk, 11 light items = 1 Bulk).
* Items of **negligible (`—`)** Bulk count as 0 unless carried in vast numbers.
* **Coins:** **1 000 coins of any denomination = 1 Bulk**, rounding down fractions
  (1 999 coins = 1 Bulk, not 2).

**Bulk Conversions for Different Sizes** (AoN Table 6-19):

| Creature Size | Bulk Limit | Treats as Light | Treats as Negligible |
| --- | --- | --- | --- |
| Tiny | **×½** | — | none |
| Small or Medium | standard | L | — |
| Large | **×2** | 1 Bulk | L |
| Huge | **×4** | 2 Bulk | 1 Bulk |
| Gargantuan | **×8** | 4 Bulk | 2 Bulk |

* A **backpack** ignores the Bulk of its contents (up to its own limit).
* Materials with `reducesBulk` subtract from the item's Bulk.

**Encumbered** (Bulk ≥ the encumbered limit): **clumsy 1** and **−10-foot penalty to
all your Speeds**. As with all Speed penalties, this **cannot reduce a Speed below
5 feet**.

**Over the maximum limit:** you simply **cannot hold or carry that much Bulk**; you must
shed or stow items to move.

### 8.2 Weapons

Weapon categories are **simple, martial, advanced, unarmed**. Proficiency is per
category (and per specific weapon for some classes/feats).

| Trait | Effect |
| --- | --- |
| Agile | MAP is −4/−8 instead of −5/−10 |
| Finesse | May use Dex instead of Str on attack rolls |
| Thrown | Can be thrown; uses Dex for ranged attack |
| Propulsive | Adds half Str mod to ranged damage |
| Two-hand | Damage die increases when held in two hands |
| Versatile | Can deal a second damage type |
| Deadly / Fatal | Extra damage on a critical hit |
| Reach | Extends reach |

**Damage.** Melee weapons add the Strength modifier to damage. Ranged weapons add
Strength only if they have **propulsive** (half) or **thrown** (full).

### 8.3 Armor and shields

*Source: [Armor](https://2e.aonprd.com/Rules.aspx?ID=2143)*

| Statistic | Rule |
| --- | --- |
| **AC Bonus** | Item bonus to AC; **Dex Cap** limits the Dexterity modifier that applies |
| **Check Penalty** | Applies to **Strength- and Dexterity-based skill checks, except those with the attack trait**. **Negated** if you meet the armor's Strength threshold |
| **Speed Penalty** | Applies to **Speed and to all other movement types** (climb, swim, fly, burrow), **minimum Speed 5 feet**. **Reduced by 5 feet** if you meet the Strength threshold — e.g. −10 becomes −5, and −5 becomes no penalty |
| **Strength** | The Strength *modifier* at which you overcome the check penalty and reduce the speed penalty by 5 ft |
| **Bulk** | Armor being *worn* is listed Bulk; armor being *carried* is 1 Bulk more |

**Donning/removing:** 1 minute to don light armor, 5 minutes to don medium or heavy,
1 minute to remove any.

**Shields.**

* Must be **wielded in one hand** and grant their AC bonus **only when Raised**.
* Raise a Shield costs an action and grants the shield's bonus as a **circumstance
  bonus** until the start of your next turn.
* A **shield's Speed penalty applies whenever you're holding it**, raised or not.
* **Take Cover** with a raised tower shield increases the circumstance bonus to **+4**.
* **Shield Block** (reaction) reduces damage by the shield's **Hardness**; both you and
  the shield take any remaining damage.
* A **buckler** doesn't occupy your hand.

---

## 9. Spellcasting

*Source: [Spells](https://2e.aonprd.com/Rules.aspx?ID=2221)*

### 9.1 Traditions

Arcane, Divine, Occult, Primal. A spell's tradition determines which casters can use
it. Some spells are on multiple lists.

### 9.2 Spell ranks and slots

* Spell **rank** (formerly "spell level") runs 1–10.
* **Cantrips** are rank 0 in terms of slots but are printed at a rank.
* A caster's **slots per day** come from their class table, indexed by character level
  and spell rank.
* **Heightening:** casting a spell in a higher-rank slot increases its power. Some
  spells have explicit heightened entries; others scale by rank.

### 9.3 Cantrips

* Casting a cantrip **does not use a spell slot** and it can be cast at will.
* **You cannot prepare a cantrip in a spell slot.**
* A cantrip is **always automatically heightened to half your level, rounded up**. For
  a typical spellcaster this equals the highest spell rank they have slots for.
* A cantrip printed at a rank higher than 1 (e.g. *Allegro*, printed as **Cantrip 7**)
  has a **minimum rank**, so it is unusable until `ceil(level/2)` reaches that value.

### 9.4 Focus spells

* Focus spells are learned only from class features or feats, never chosen from a spell
  list.
* **You cannot prepare a focus spell in a spell slot**, and you cannot use spell slots
  to cast focus spells (or Focus Points to cast non-focus spells).
* **Auto-heightened to half your level rounded up**, exactly like cantrips. You cannot
  cast a focus spell whose **minimum rank exceeds** `ceil(level/2)`, even if you gain
  access to it.
* **Casting any focus spell costs 1 Focus Point.**
* You gain a focus pool the first time you gain a focus spell. The pool maximum is
  **the number of focus spells you know, or 3, whichever is lower** — and **only spells
  that require Focus Points to cast count**. Composition cantrips (e.g. a bard's) do
  **not** count toward the pool size.
* **Daily preparations** refill the pool entirely. **Refocus** (a 10-minute activity)
  regains **1** Focus Point, and you may Refocus repeatedly up to the pool maximum.

### 9.5 Innate spells

Granted by ancestry, heritage, or a magic item.

* **Don't use spell slots**, and you can't cast them with your slots.
* Usually castable **once per day** each; **refreshed during your daily preparations**.
* **You become trained in the spell attack modifier and spell DC statistics** when you
  gain an innate spell. These **increase to expert at 12th level**.
* Unless noted otherwise, **Charisma** is your spellcasting attribute modifier for
  innate spells.
* You **cannot heighten** innate spells (though the granting ability may give the spell
  at a higher rank).
* You can cast an innate spell **even if it's of a rank you can't normally cast**.
* Innate **cantrips** are cast at will and auto-heighten as normal.

### 9.6 Focus spells without spellcasting

A class or other source that grants focus spells but **not** spellcasting still provides
your proficiency for spell attack modifier and spell DC, plus the magic tradition of
those focus spells — but such a character **does not qualify as a spellcaster** for feats
and abilities that require spell slots.

If you gain focus spells from **multiple sources**, you still have **one** focus pool
counting all of them, and you can spend any point on any focus spell. The tradition of
each focus spell is unchanged, and each uses the **attribute modifier determined by its
own source**.

### 9.7 Prepared vs spontaneous

| | Prepared | Spontaneous |
| --- | --- | --- |
| Spells known | Spellbook / all prepared spells | Repertoire |
| Daily prep | Assign spells to specific slots | Nothing to assign |
| Casting | Expend the prepared slot | Expend any slot of that rank or higher |
| Signature spells | n/a | One spell per rank can be freely heightened |

### 9.8 Spell defenses

* **Basic saving throw:** the spell's Defenses entry says "basic". The target takes
  **no damage on a critical success**, **half damage on a success**, **full damage on a
  failure**, and **double damage on a critical failure**.
* A spell that uses **AC** as its defense typically requires a **spell attack roll**.
* Whenever a spell allows a saving throw, **it uses the caster's spell DC**.
* **Counteract:** `d20 + counteract modifier` vs the target effect's DC; the counteract
  level determines how many degrees of success are needed.
* **Spell attack rolls take the multiple attack penalty** like any other attack roll.
  Item bonuses to spell attacks are rare; circumstance and status bonuses apply.

### 9.9 Rituals

Rituals are cast by anyone with the Ritualist feat or a class feature, take hours or
days, require a primary caster and often secondary casters, and use a **skill check**
(usually Arcana, Nature, Occultism, or Religion) rather than a spell attack.

---

## 10. Conditions

*Source: [Conditions Appendix](https://2e.aonprd.com/Rules.aspx?ID=2455)*

Conditions are persistent until their duration ends or they are removed. **A condition
with a value** (e.g. *clumsy 2*) conveys severity; if the value drops to 0 the
condition ends.

**Redundant conditions.** You can have a given condition only once. If the same
condition is imposed again, you keep it for the **longer duration**. Conditions with
different **values** are treated as different conditions — apply only the **highest
value**, but track both durations.

**Condition groups:**

| Group | Conditions |
| --- | --- |
| Detection | observed, hidden, undetected, unnoticed |
| Senses | blinded, concealed, dazzled, deafened, invisible |
| Death and dying | doomed, dying, unconscious, wounded |
| Attitudes | hostile, unfriendly, indifferent, friendly, helpful |
| Lowered abilities | clumsy, drained, enfeebled, stupefied |

**Lowered-ability conditions.** These impose a **status penalty** equal to the condition
value, and they hit **rolls *and* DCs**, not just checks:

| Condition | Affects |
| --- | --- |
| **Clumsy** | Dexterity-based rolls and DCs, **including AC, Reflex saves, ranged attack rolls**, and Acrobatics/Stealth/Thievery checks |
| **Enfeebled** | Strength-based rolls and DCs, including Str melee attack rolls, Str damage rolls, and Athletics |
| **Stupefied** | Intelligence-, Wisdom-, and Charisma-based rolls and DCs, including **Will saves, spell attack modifiers, spell DCs**. **Casting a spell while stupefied requires a flat check, DC 5 + your stupefied value, or the spell is disrupted** |
| **Drained** | Constitution-based rolls and DCs (Fortitude saves) **plus** −`level × drained value` Hit Points, and your **maximum HP is reduced by the same amount**. Drained decreases by 1 per full night's rest |

**Doomed.** Reduces the dying value at which you die. If your maximum dying value
reaches 0, you die instantly. Decreases by 1 per full night's rest.

**Wounded.** If you lose the dying condition without already having wounded, you become
**wounded 1**; if you already have it, it **increases by 1**. If you gain dying while
wounded, **increase your dying value by your wounded value**. Wounded ends when someone
successfully restores HP with **Treat Wounds**, or when you are restored to full HP and
rest 10 minutes.

**Encumbered.** *Clumsy 1* and a **−10-foot penalty to all your Speeds**, which **cannot
reduce a Speed below 5 feet**.

**Action-affecting conditions.** *Quickened*, *slowed*, and *stunned* change how many
actions you regain **at the start of your turn**, so gaining them **during** your turn
does not change that turn's actions.

* **Quickened** — gain **1 additional action** at the start of your turn. Many effects
  restrict how that extra action may be used. If you are quickened from multiple
  sources, the extra action can be used for **any single action allowed by any of
  them**.
* **Slowed N** — reduce the number of actions you regain **by N**.
* **Stunned N** — you **can't act**. Each time you regain actions, reduce the number
  regained by your stunned value, then **reduce the stunned value by the number of
  actions actually lost**. Stunned may instead have a duration, in which case you lose
  all actions for that duration. **Stunned overrides slowed**: if stunned ends while you
  are slowed, actions lost to stunned count toward those lost to slowed.
* **Sickened N** — a **status penalty equal to N on all checks and DCs**. You can't
  willingly ingest anything. You can spend **1 action retching** to attempt a Fortitude
  save against the originating DC; success reduces sickened by 1, critical success by 2.
* **Off-Guard** — **−2 circumstance penalty to AC**. Unless the source says otherwise,
  it applies against **everything**, not just the creature that caused it.

---

## 11. Hero Points

*Source: [Hero Points](https://2e.aonprd.com/Rules.aspx?ID=2333)*

* A character can have a **maximum of 3 Hero Points** at a time.
* Hero Points last for a single session and are lost at the end of it.
* **Spend 1** to **reroll a check** — you must use the second result. This is a
  **fortune** effect, so you can't spend more than 1 Hero Point on the same check.
* **Spend all remaining (minimum 1) to avoid death.** You may do this when your
  **dying condition would increase**. You lose the dying condition entirely and
  stabilize at 0 HP. You **do not gain or increase the wounded condition** from this.
* Neither use is an action, and you can spend Hero Points even when you can't act.
* You may spend a Hero Point on behalf of your familiar or animal companion.
* The GM awards Hero Points — typically 1 at the start of a session, plus more for
  heroic deeds.

---

## 12. Variant rules

| Variant | Source | Effect |
| --- | --- | --- |
| Free Archetype | GM Core | Extra archetype feat slot every even level |
| Gradual Ability Boost | [ID 1299](https://2e.aonprd.com/Rules.aspx?ID=1299) | One boost at each of 2/3/4/5, 7/8/9/10, 12/13/14/15, 17/18/19/20 |
| Point Buy | [ID 1299](https://2e.aonprd.com/Rules.aspx?ID=1299) | Ability Points replace boosts/flaws |
| Alternative Scores | [ID 1299](https://2e.aonprd.com/Rules.aspx?ID=1299) | Str absorbs Con; Dex splits into Dex + Agility; Cha drives Will |
| Proficiency Without Level | [ID 1370](https://2e.aonprd.com/Rules.aspx?ID=1370) | Drop level from proficiency; untrained −2 |
| Automatic Bonus Progression | GM Core | Runes replaced by level-based potency bonuses |
| Stamina | [ID 1378](https://2e.aonprd.com/Rules.aspx?ID=1378) | HP split into HP + Stamina; Resolve Points |
| Ancestry Paragon | GM Core | Extra ancestry feat at 1st and every even level |
| Dual Class | GM Core | Two classes, both advance |
| Skill Paragon | GM Core | Extra skill increases |

---

## 13. Where Pathbuilder diverges from AoN

The user's instruction is that **AoN is the source of truth** and our documentation
must match it. That applies to *rules statements*. It does **not** mean the app's
behaviour should be described as something it isn't — where Pathbuilder implements a
rule differently, both facts must be recorded. This table is that record.

| # | Rule | AoN says | Pathbuilder does | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Proficiency Without Level, untrained | **−2** | `t36` returns raw rank → **0** | **Deviation.** No untrained penalty under PWL. |
| 2 | Bonus types | Item, Status, Circumstance, Untyped | Adds `Racial Bonus` and `Potency Bonus` | **Extension.** Extra internal groupings; harmless as long as they don't stack with the canonical four. |
| 3 | Attribute terminology | "attribute modifier", base +0 | "ability score", base 10, boost = +2 | **Representation only.** `floor((score−10)/2)` is identical to the modifier. |
| 4 | Partial boosts | Two boosts per +1 above +4 | Modelled — `▲` shown when the score is odd | **Conforms.** |
| 5 | Encumbered | clumsy 1, −10 ft all Speeds (min 5 ft) | `dqi(level, -10, 3, 5)` + `Clumsy (Encumbered)` 1 | **Conforms.** |
| 6 | Cantrip rank | Printed rank, auto-heightens to `ceil(level/2)` | Data `level` holds the printed rank (1, 2, 3, 5, 7 all occur) | **Conforms.** |
| 7 | Focus pool | min(focus spells, 3) | Capped at 3 | **Conforms.** |
| 8 | Rules enforcement | — | Warns on illegal builds but does not block | **Deliberate scope choice**, not a rules error. |
| 9 | Feat/item effects | Fully mechanical | Mostly descriptive; ~20 feats change derived numbers | **Deliberate scope choice.** |
| 10 | Action economy | 3 actions + 1 reaction, spent | Displayed, never spent | **Deliberate scope choice.** |

**Items 1 and 2 are the only places where the app's *math* differs from AoN.** Both
are worth fixing in a clone; neither is worth "correcting" in the reverse-engineering
documents, because those documents describe the app.

---

## 14. Quick reference card

```
CHECK          d20 + mods vs DC
               crit success ≥ DC+10 · success ≥ DC · failure < DC · crit failure ≤ DC−10
               nat 20 improves one step · nat 1 worsens one step

PROFICIENCY    untrained +0 · trained level+2 · expert level+4 · master level+6 · legendary level+8
               (PWL: +2/+4/+6/+8, untrained −2)

ATTRIBUTES     all start at +0 · boost +1 · flaw −1 · max +4 at 1st level
               boost above +4 = partial boost (two boosts per +1)

AC             10 + prof + min(Dex, cap) + armor item + shield (if raised) + other

SAVE           prof + attribute (Fort=Con, Ref=Dex, Will=Wis) + item + other

PERCEPTION     prof + Wis + item

SKILL          prof + attribute + item + other − armor check penalty

SPELL DC       10 + prof + casting attribute + item + other
SPELL ATTACK   d20 + prof + casting attribute + item + other

HP             ancestryHP + (classHP + Con + classHPBonuses) × level + bonusHP
               (Con applies from 1st level — a fighter is 10 + Con at L1, not 10)

BULK           encumbered at 5 + Str · max at 10 + Str
               Tiny ×½ · Large ×2 · Huge ×4 · Gargantuan ×8 · 10 light = 1 Bulk · 1000 coins = 1 Bulk
ENCUMBERED     clumsy 1 · −10 ft to all Speeds (min 5 ft)

MAP            2nd −5 · 3rd+ −10 · agile −4/−8
RANGE          −2 per increment past the first, max 6 increments

DYING          0 HP → dying 1 (dying 2 on crit / your crit-fail) · +wounded · dying 4 = death
               recovery = flat check DC 10 + dying · crit succ −2 · succ −1 · fail +1 · crit fail +2
               losing dying → wounded +1 · 1+ HP ends it · hero points can avoid death

HERO POINTS    max 3 · spend 1 to reroll a check (fortune, no second reroll)
               spend all (min 1) to avoid death → stabilize at 0, no wounded increase

XP             1000 XP per level, then subtracted from the total (running remainder)
STARTING GOLD  15 gp at 1st level
```

---

## 15. AoN page index used for this document

| Topic | URL |
| --- | --- |
| Character Creation | https://2e.aonprd.com/Rules.aspx?ID=2027 |
| Leveling Up | https://2e.aonprd.com/Rules.aspx?ID=2065 |
| Checks | https://2e.aonprd.com/Rules.aspx?ID=2278 |
| Damage Rolls | https://2e.aonprd.com/Rules.aspx?ID=2301 |
| Hit Points, Healing, and Dying | https://2e.aonprd.com/Rules.aspx?ID=2319 |
| Hero Points | https://2e.aonprd.com/Rules.aspx?ID=2333 |
| Actions | https://2e.aonprd.com/Rules.aspx?ID=2335 |
| Movement | https://2e.aonprd.com/Rules.aspx?ID=2345 |
| Perception and Detection | https://2e.aonprd.com/Rules.aspx?ID=2400 |
| Skills | https://2e.aonprd.com/Rules.aspx?ID=2134 |
| Equipment | https://2e.aonprd.com/Rules.aspx?ID=2143 |
| Spells | https://2e.aonprd.com/Rules.aspx?ID=2221 |
| Conditions Appendix | https://2e.aonprd.com/Rules.aspx?ID=2455 |
| Ability Scores Variants | https://2e.aonprd.com/Rules.aspx?ID=1299 |
| Proficiency without Level | https://2e.aonprd.com/Rules.aspx?ID=1370 |
| Stamina | https://2e.aonprd.com/Rules.aspx?ID=1378 |
| Fighter | https://2e.aonprd.com/Classes.aspx?ID=35 |
| Cleric | https://2e.aonprd.com/Classes.aspx?ID=33 |
| Wizard | https://2e.aonprd.com/Classes.aspx?ID=39 |

The full AoN rules index (701 entries) is cached at `/tmp/aon-toc.txt` for locating any
further page by name.
