# 09 — Clone Blueprint

This document turns the preceding analysis into an implementation plan for a
rewrite: what to keep, what to redesign, and in what order.

## 1. What you are actually rebuilding

Pathbuilder is a **single-user, offline-first, data-driven character sheet builder**.
It is *not* a VTT, not a rules validator, not a combat tracker. The value is:

1. A complete, correct **rules database** (245 tables).
2. A **guided build flow** that knows what choices exist at each level.
3. **Derived statistics** that stay correct as you edit earlier levels.
4. **Export surfaces** (sheets, stat blocks, JSON, share links).

Everything else (accounts, GM mode, payments, Starfinder) is optional.

## 2. Recommended architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI (React / Svelte / Solid — anything with real components) │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Rules engine (pure TypeScript, no DOM)                     │
│   • modifier pipeline                                       │
│   • derived-stat calculators                                │
│   • slot/prerequisite resolution                            │
│   • per-feature hooks registry                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Content layer: normalized content DB                      │
│   • compiled from the same 245 tables (or your own schema)  │
│   • typed indexes, not string maps                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Persistence: IndexedDB (idb) + optional cloud sync         │
│   • character document, schema-versioned                    │
└─────────────────────────────────────────────────────────────┘
```

Three hard rules:

1. **The rules engine must be pure.** No DOM, no globals. Given `(character, content)`
   it returns a fully-derived sheet. This is what makes testing possible — the
   original cannot be unit-tested at all.
2. **The character document stays a plain, flat, JSON-serializable object.** Keep the
   original's field names for import compatibility; add a `schemaVersion`.
3. **Content is compiled, not parsed at boot.** Ship a pre-built index (JSON or
   SQLite-WASM) rather than decoding LZ-string + CSV on every load.

## 3. Content pipeline

```
source tables  →  normalise  →  typed records  →  indexes  →  artifact
```

Recommended steps:

1. Decode the shipped data (see [02-data-files.md](./02-data-files.md) for the recipe).
2. Normalise the quirks:
   * `spellist_*` → `spellList`
   * `items_all.type` numeric string → named category
   * `actions` `-2|-1|0|1..7` → `{hide}|{kind:'free'}|{kind:'reaction'}|{count:1..3}|{range:'1-3'|'1-2'|'2-3'}`
   * `req_abilities` `0£16` → `{str:16}`
   * `selectable` blank → `1`
   * missing `src` → `"CRB"`
3. Emit typed records:

```ts
type Feat = {
  id: string;                 // "WIZARD_Counterspell"
  name: string;
  level: number;
  group: FeatGroup;           // "Class Feat" | "Skill Feat" | ...
  traits: string[];
  actions: ActionCost;
  maxTimes: number;           // selectable, default 1
  requires: {
    abilities: Partial<Record<Ability, number>>;
    feats: string[];
    specials: string[];
    proficiencies: Partial<Record<Proficiency, Rank>>;
    level: number;
  };
  grants: {
    proficiencies: Partial<Record<Proficiency, Rank>>;
    magicProficiency?: Rank;
    pet?: PetKind;
    feats?: string[];         // child slots
    spells?: string[];
    specials?: string[];
  };
  text: { prereq?: string; requirement?: string; description: string };
  source: string;
  url: string;
};
```

4. Build indexes: `byId`, `byGroup`, `byLevel`, `byTrait`, `bySource`.
5. Ship as one compressed artifact (brotli) plus a small manifest.

**Do not** reproduce the "parse CSV at runtime" step. It costs seconds of boot time and
makes every load depend on a 4 MB network fetch.

## 4. Character model

Keep the original field names (see [03-character-model.md](./03-character-model.md))
but wrap them:

```ts
type CharacterDoc = {
  schemaVersion: 1;
  id: string;                 // was webID
  name: string;
  level: number;
  // … the ~125 fields, grouped into sub-objects for readability,
  //   but serialized flat-compatible via a migration layer.
};
```

Migration strategy for importing real Pathbuilder saves:

1. Read the string from IndexedDB `saves`.
2. `JSON.parse`.
3. Map old keys onto the new grouped shape (`fromPathbuilderSave()`).
4. Keep an `original` blob so an export can round-trip unknown fields.

Since the serializer is *optional fields*, unknown keys are safe to carry through
untouched — this is how you stay compatible without implementing everything.

## 5. Rules engine design

### 5.1 Modifier pipeline (the core abstraction)

```ts
type BonusType = 'item'|'status'|'circumstance'|'untyped'|'racial'|'potency';
type Modifier = { target: StatKey; type: BonusType; value: number; source: string };
```

```ts
function applyModifiers(base: number, mods: Modifier[]): number {
  const best = new Map<BonusType, number>();
  for (const m of mods) {
    const cur = best.get(m.type);
    if (cur === undefined || Math.abs(m.value) > Math.abs(cur)) best.set(m.type, m.value);
  }
  return base + [...best.values()].reduce((a, b) => a + b, 0);
}
```

This single function replaces a large amount of the original's ad-hoc arithmetic, and
it is where the "typed bonuses don't stack" rule lives.

### 5.2 Derived sheet

```ts
type Derived = {
  abilities: Record<Ability,{score:number; mod:number}>;
  hp: {max:number; current:number};
  ac: {total:number; prof:number; ability:number; item:number; shield?:number};
  saves: Record<'fort'|'ref'|'will', number>;
  perception: number;
  skills: Record<Skill, {rank:Rank; total:number}>;
  classDC: number;
  spellcasting: SpellCastingDerived[];
  bulk: {total:number; encumbered:number; max:number};
  speed: number;
};
```

`derive(character, content): Derived` is a pure function. Memoise by document hash.

### 5.3 Slot resolution

```ts
function slotsForLevel(character, content, level): Slot[]
```

Replaces the original's per-class cog-button assembly. Drive it from declarative data
per class:

```ts
classProgression: {
  feeder: { classFeat: [1,2,4,6,8,…], skillFeat: [2,4,6,…],
            skillIncrease: […], generalFeat: [3,7,11,15,19],
            ancestryFeat: [1,5,9,13,17], abilityBoost: [5,10,15,20] }
}
```

Most of this is uniform; only the exceptions (Alchemist, Magus, Summoner, Psychic,
Commander) need overrides.

### 5.4 Feature hooks

Instead of a 500-branch `if (featId === …)` chain, use a registry:

```ts
registerEffect('GENERAL_Toughness', (ch, out) => { out.hp.bonusPerLevel += 1; });
registerEffect('GENERAL_Fleet',     (ch, out) => { out.speed.bonus += 5; });
```

Then `derive()` runs: base calculation → all effects for selected feats/specials/items
→ conditions → custom buffs → modifier pipeline.

Keep a **data-driven** path for the majority: if a feat only grants a proficiency or a
spell, express it in content, not code.

## 6. UI design notes

The original's imperative DOM is the biggest liability. Replace it, but learn from the
UX:

**Keep:**

* The **build column + tabbed sheet** split. It is genuinely good: choices on the left,
  results on the right.
* **Cog buttons with a remaining count** — an excellent affordance for "you still owe
  N choices here".
* The **level-by-level accordion** (one section per level).
* The **listview dialog** pattern (search + facets + expandable rows + detail pane).
* **"Finished"** as the primary dialog action, so partial progress is never lost.

**Change:**

* Use real `<button>`, `<input>`, `<select>`, `<dialog>`; the original is unclickable by
  keyboard and invisible to screen readers.
* Make the whole thing a component tree with derived state, not a rebuild-on-mutate
  DOM.
* Replace the string-keyed `hashMap*` with typed maps, but keep a serialization layer
  that emits the original shape.
* Virtualise the long feat/spell lists; the original renders thousands of DOM nodes.
* Provide undo. The original has none, and its save-on-every-change behaviour makes
  mistakes permanent.

## 7. Implementation order

### Milestone 1 — Data

- [ ] Decode the shipped tables into a typed content artifact
- [ ] Index feats, spells, items, ancestries, backgrounds, classes, specials
- [ ] Write a `content.search()` API used by every picker

### Milestone 2 — Core character

- [ ] Character document + persistence (IndexedDB, same key names)
- [ ] Ability system (guided boosts + override)
- [ ] Ancestry / heritage / background / class selection
- [ ] Skill training + lore
- [ ] Feat selection with prerequisites (the biggest single piece)
- [ ] Derived stats: HP, AC, saves, perception, skills, class DC, bulk, speed

### Milestone 3 — Sheet

- [ ] Weapons tab (attack/damage math)
- [ ] Defense tab (armour, shield, AC breakdown)
- [ ] Gear tab (money, bulk, inventory tree, containers)
- [ ] Details tab
- [ ] Feats tab
- [ ] Actions tab

### Milestone 4 — Spells

- [ ] Caster definitions and slot tables (copy them literally)
- [ ] Prepared vs spontaneous storage
- [ ] Spellbook / repertoire
- [ ] Per-rank sections, heightening, focus spells

### Milestone 5 — Output

- [ ] Character sheet (HTML print CSS or PDF)
- [ ] Stat block
- [ ] Export JSON in the original shape
- [ ] Import of original saves

### Milestone 6 — Extras

- [ ] Pets (animal companion, familiar, eidolon)
- [ ] Custom content
- [ ] Variant rules
- [ ] Share links
- [ ] GM mode (optional)

## 8. Testing strategy

The original has no tests. A clone should invert that:

1. **Golden-character fixtures.** Encode 5–10 complete characters (one per caster type,
   one martial, one with pets, one with variant rules) and assert the full derived
   sheet.
2. **Cross-check against the real app.** Build the same character in both and diff the
   export JSON. This is the single most valuable test you can write, and it is possible
   because the export JSON is a stable, complete snapshot.
3. **Prerequisite property tests.** For every feat, assert that
   `available(featAtLevel1)` is false when the level is too low, etc.
4. **Round-trip tests.** `parse(serialize(c)) === parse(serialize(parse(serialize(c))))`.
5. **Content invariants.** Every `req_feats` id exists; every spell name in a
   `spelllist_*` table exists in `spells`; every `id` is unique within its table.

## 9. Risks and gotchas

| Risk | Mitigation |
| --- | --- |
| Content licensing | The AoN data is OGL; Pathbuilder's own descriptions are not. Extract rules text from AoN, not from the app's `description` columns, if you redistribute. |
| Rules-text fidelity | The shipped text differs between Remaster and legacy. Support both, like the original does. |
| Feat-hook explosion | Prefer data-driven grants; keep code hooks to the ~50 genuinely numeric feats. |
| Caster slot tables | They are literal data. Copy them, don't derive them. |
| Save compatibility | Keep original field names and the JSON-string-in-IndexedDB convention. |
| Scope creep | Starfinder, GM mode, payments, cloud sync are all separable. Ship the builder first. |
| Missing data | "Not Selected" and empty strings are legitimate values everywhere. Model them explicitly. |

## 10. The minimum viable clone

If you want to ship something useful quickly, this is the smallest honest subset:

1. Content artifact with ancestries, backgrounds, classes, feats, spells, items.
2. Character document with the ability system and feat selections.
3. Derived stats for HP / AC / saves / perception / skills / DCs / bulk.
4. Build column + Details + Feats + Gear tabs.
5. Export JSON (original shape) so users can round-trip to the real app.

That is roughly 30% of the original's surface area but covers the 90% of what a player
actually needs at the table.

## 11. Where to look in the original

| Need | Location |
| --- | --- |
| Field list | bundle ~45619 (`i.mt("fieldName", optional)`) |
| Caster definitions | `probe/assets/pb-main.pretty.js` lines 71119–71730 |
| Slot tables | same, `GKi` at 71846 |
| Spell list lookup | `yA.ya5` at 92597, `yA.za3` at 92857 |
| Feat prerequisites | `~8200` (loader), `N_()` helper |
| Derived AC/saves | `ddt` at ~141630 |
| Proficiency bonus | `t36` at 121099 |
| Level sections | `gu` at 33100–33500 |
| Dialog base | `Ou` at 33620 |
| Listview | `Au` at 10590–10620 |
| Constants | `QDi` at 67959 |

All line numbers refer to the beautified bundle `probe/assets/pb-main.pretty.js`
(regenerate per [`probe/README.md`](../probe/README.md); not included in this repo).
