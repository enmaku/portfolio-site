# Pathbuilder 2e — Reverse-Engineering Context Documentation

> Source of truth: live app at `https://pathbuilder2e.com/app.html?v=81e`, JS bundle
> `Pathbuilder2eWebRemastered112.0.js` (version 112.0, "Feylines"), and the CDN data
> files `data_remastered80.txt` / `data137.txt`.
>
> All findings below were obtained by reading the shipped bundle, probing the running
> app over the Chrome DevTools Protocol, and decoding the data files. Nothing here is
> copied from Archives of Nethys; AoN is only referenced as the canonical rules source.

## Document map

All screenshots live in [`img/`](./img/) and are embedded in
[06-ui-architecture.md](./06-ui-architecture.md).

| File | Contents |
| --- | --- |
| [01-architecture.md](./01-architecture.md) | Runtime, build, hosting, module layout, boot sequence |
| [02-data-files.md](./02-data-files.md) | CDN data files, encoding, full SQLite schema, table inventory |
| [03-character-model.md](./03-character-model.md) | Character JSON schema, every field, storage layout |
| [04-spell-system.md](./04-spell-system.md) | Spell lists, casters, slots, preparation, spellbook, heightening |
| [05-feat-system.md](./05-feat-system.md) | Feat categories, prerequisites, selection keys, archetypes |
| [06-ui-architecture.md](./06-ui-architecture.md) | DOM structure, screens, dialogs, tabs, CSS classes, **screenshots of every dialog** |
| [07-rules-engine.md](./07-rules-engine.md) | Proficiencies, ability boosts, derived stats, bonuses |
| [08-export-and-integrations.md](./08-export-and-integrations.md) | Export JSON, PDF, statblock, share, GM mode, cloud |
| [09-clone-blueprint.md](./09-clone-blueprint.md) | Recommended architecture for a rewrite |
| [10-pathfinder-2e-rules.md](./10-pathfinder-2e-rules.md) | **Pathfinder 2e rules primer sourced from Archives of Nethys**, plus a table of deliberate Pathbuilder deviations |
| [11-legal-and-licensing.md](./11-legal-and-licensing.md) | US law on building a functionally-similar product, JSON compatibility, naming |

**Reading order for a clone author:** 10 (what the rules are) → 00 (what the app is) →
01/02 (what data exists) → 03/04/05 (how it's modelled) → 06/07 (how it's rendered and
computed) → 08 (how it escapes) → 09 (what to build) → 11 (what you're allowed to ship).

**Authority.** [10-pathfinder-2e-rules.md](./10-pathfinder-2e-rules.md) is the rules
authority. Documents 01–09 describe *the app*; where the app's behaviour differs from
the rules, doc 10 §13 records the divergence and both statements stand.
[11-legal-and-licensing.md](./11-legal-and-licensing.md) governs what may be copied,
which is a separate question from what the rules say.


## Executive summary

Pathbuilder 2e is a **single-page Kotlin/JS application** compiled to JavaScript and
served as one ~4.2 MB bundle. It is not a framework app: it builds its DOM imperatively
with `document.createElement` and direct `appendChild` calls, and it keeps all state in
a hand-rolled object graph.

Key facts a clone must reproduce:

1. **Data is a compressed SQLite dump.** The app downloads `data_remastered80.txt`
   (or `data137.txt` for legacy), which is **LZ-string `compressToBase64`** output
   wrapping a JSON object whose values are **CSV exports of 245 SQLite tables**.
   The app parses the CSV into in-memory maps at boot.
2. **Character state is a flat JSON object** with ~125 possible keys, stored as a
   string in IndexedDB (`pathbuilder2e_db` → `saves` store) and optionally in Google
   Drive / Firebase.
3. **Spellcasting is modelled as a list of "casters"**, each with a per-level slot
   table, a tradition, a preparation mode, and a spell list. Spells are stored in
   `hashMapPlayerSpells` keyed by `"<CasterName>&<rank>&<index>"`.
4. **Feats are stored in `hashMapFeatSelections`** keyed by a *slot name* string
   (e.g. `"Heritage Feat"`, `"Class Feat"`, `"Heritage Featversatile heritage"`),
   with values of the form `"<PREFIX>_<Name>"`.
5. **Everything is derived on demand** from the character object plus the data tables;
   there is no persisted "computed" state beyond a few caches.

## How this was gathered

* A persistent CDP bridge (`ws://127.0.0.1:9222/devtools/browser/...`) was opened once
  and reused for every probe (evaluate, click, key, screenshot).
* The bundle was beautified (`js-beautify`) to 146 426 lines for reading.
* The two data files were downloaded from the CDN and decoded with `lz-string`.
* The decoded CSV tables were loaded into a local SQLite database for querying.

## Key findings (condensed)

### Data
* One ~4 MB LZ-string blob per ruleset, containing **245 SQLite tables** exported as
  CSV inside a JSON object. Decoded and rebuilt locally as `pb_remastered.db`.
* Volume in the Remastered dataset: **5 172 feats**, **1 379 spells**, 288 backgrounds,
  38 ancestries, 28 classes, 245 tables total.
* Table naming is inconsistent (`spellist_*` vs `spelllist_*`); column names are the
  contract, not column order (three different signatures per table group).
* `id` columns are `"<PREFIX>_<Display Name>"` and are the storage keys for feats,
  backgrounds and heritages.

### Character
* ~125 optional fields, mostly string-keyed maps. Stored as a **JSON string** in
  IndexedDB `saves`, keyed by a UUID `webID`.
* No computed state is persisted — everything derives from the document plus content.
* Heritage, background feats and class features are all normalized into feat /
  special selections rather than having dedicated fields.

### Spells
* Casters are **hard-coded Kotlin classes** with literal 20×11 `Int32Array` slot
  tables; there is no formula.
* Per-character spells live in one flat map keyed
  `"<Caster>&<rank>&<index>"` with `{spellList, spellName, heighten}`.
* Prepared vs spontaneous is a property of the *caster definition*, not the character.

### Feats
* One flat map `hashMapFeatSelections[slotName] = "PREFIX_Name"`.
* Slot names are constructed strings; child slots concatenate the parent slot with the
  chosen value (`"Heritage Featversatile heritage"`).
* Prerequisites are structured (`req_abilities` uses `£`, `req_feats` uses `&`) plus
  free-text that is not machine-checked.
* `selectable` is the **max times taken**, not a boolean.

### UI
* 8 fixed main tabs + up to 2 class-specific submenus, a build column with one
  accordion section per level, a slide-out sidebar, a slide-out dice tray, and
  modal dialogs created on demand and appended to `<body>`.
* Two widget families carry almost everything: the **cog button** (per-level choices
  with a remaining count) and the **listview dialog** (search + facets + expandable
  rows + detail pane).
* No framework, no templating, no diffing: render = clear + rebuild.

### Rules engine
* Six bonus types with typed non-stacking, applied through one modifier pipeline.
* Proficiency ranks are the numbers `0/2/4/6/8` and the proficiency bonus is
  `rank + level` (or `rank` under Proficiency Without Level).
* Class features, feats and items contribute partly through data and partly through
  ~a few hundred hand-written id-keyed hooks. Only a small subset of them are numeric.

## Files produced

```
docs/
  00-overview.md                 this file
  01-architecture.md             hosting, boot, bundle, storage, services
  02-data-files.md               encoding, schema, all 245 tables, rebuild recipe
  03-character-model.md          every character field, storage, export shape
  04-spell-system.md             casters, slot tables, storage, picker, heightening
  05-feat-system.md              tables, ids, columns, prerequisites, archetypes
  06-ui-architecture.md          DOM contract, all screens, 55 screenshots
  07-rules-engine.md             modifier pipeline, derived stats, variants
  08-export-and-integrations.md  JSON/PDF/share/cloud/GM, storage keys
  09-clone-blueprint.md          architecture, milestones, testing, risks
  10-pathfinder-2e-rules.md      PF2e rules primer sourced from Archives of Nethys,
                                 plus the app-vs-rules divergence table
  11-legal-and-licensing.md      US law: copyright, JSON format, trade dress,
                                 trademark, trade secrets, DMCA, ToS, OGL/ORC
  img/                           55 captured screenshots
probe/
  README.md                      how the toolkit works, and how to rebuild assets/
  cdp-bridge.mjs                 persistent CDP bridge used for all probing
  capture.mjs, pbui.mjs          drivers
  cap-*.mjs                      one script per captured UI region
```

> **Not included: `probe/assets/`.** The beautified bundle, the decoded CDN data
> files, the 245-table SQLite mirror, and the derived text dumps are third-party
> artifacts and are deliberately absent from this repo. Every reference to
> `probe/assets/…` below names a file you regenerate locally — see
> [`probe/README.md`](../probe/README.md) for the recipe.
