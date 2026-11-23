# CritCrafter

A mobile-first **character viewer** for Pathbuilder 2e characters: a table-play companion for a player who forgot their sheet. It shows a character; it does not create or edit one. Settled spec: [docs/critcrafter/SPEC.md](../../../docs/critcrafter/SPEC.md); operations: [docs/critcrafter/runbook.md](../../../docs/critcrafter/runbook.md). Say "character", never Strength of Thousands' "hero".

## Language

### CritCrafter

The portfolio **project** at `/projects/critcrafter?id=<Pathbuilder id>`: a phone-framed mobile **project** (**Projects → Mobile**) with a bottom bar cycling Stats, Skills, Gear, Spells and Actions. Shipped name: **CritCrafter** (nav entry, tab title, **shareable route**).

_Avoid_: Character builder or editor; naming the loaded character in the tab title or share card; "hero".

### Character viewer

The CritCrafter surface that renders one **CritCrafter sheet** plus **table state**. Does no rules lookup and no derived-stat math beyond recombining sheet numbers with **table state** (live AC, hands limit, HP, rests).

_Avoid_: Computing bonuses client-side; offline or PWA caching in v1.

### Pathbuilder export

The `{ success, build }` JSON that `pathbuilder2e.com/json.php?id=N` returns for a shared build. The browser fetches it (Pathbuilder blocks scripted servers) and relays it verbatim to the **sheet function**. Carries proficiency ranks, final ability scores, name-only gear and spells, and some precomputed totals (`acTotal`, weapon attack and damage); skills, saves, class DC, max HP and bulk are not in it.

_Avoid_: Storing or caching an export anywhere; calling it a character file.

### Pathbuilder id

The numeric id in `?id=`. Accepted as a bare id or any Pathbuilder URL with `?id=N`, normalised to digits. The key for **table state** and **Recent**; the **sheet function** never sees it.

### Sheet function

`critcrafterSheet`, the Firebase `onRequest` function (App Check verified) that turns a **Pathbuilder export** into a **CritCrafter sheet**: derived stats, name resolution against the **rules corpus**, sheet assembly. Plain CommonJS in `functions/critcrafter/`.

_Avoid_: "The API"; calling it from code that holds the Pathbuilder id.

### Rules corpus

The Firestore `rulesEntries` collection (plus `rulesMeta/current`) built from the Foundry `foundryvtt/pf2e` packs by a manually run, pinned-SHA ingest script. Readable only by the **sheet function** through the Admin SDK; never shipped to clients. Each entry carries its ORC or OGL licence tag. See [ADR 0031](../../../docs/adr/0031-critcrafter-rules-corpus-in-firestore.md).

_Avoid_: Hotlinking or scraping Archives of Nethys at runtime; client-side lookup.

### Name resolution

How the **sheet function** matches an export name to a **rules corpus** entry: exact `nameKey`, then alias, then miss. Ambiguity resolves to the remaster entry, then by the export field's type hint. A miss is never given a placeholder: the entry has `rules: null` and an AoN search link.

### CritCrafter sheet

The versioned JSON envelope the **sheet function** returns, one key per screen (`header`, `stats`, `skills`, `gear`, `spells`, `actions`, `features`), defined by [sheet.schema.json](../../../docs/critcrafter/sheet.schema.json). Evolution is additive-only within a `schemaVersion`; unknown fields are ignored and an unknown version shows a "reload to update" state. Unknown numbers are `null`, never invented.

_Avoid_: "The build" (that is the **Pathbuilder export** body); hand-editing fixtures.

### Stat

A derived number with a **Breakdown**: `{ value, breakdown[], actions? }`. The function guarantees the amounts sum to the value; where Pathbuilder's own total disagrees, Pathbuilder wins and an "Other (from Pathbuilder)" line carries the difference.

### Breakdown

The ordered, bonus-typed lines behind a **Stat**, shown by **tap-to-explain**.

### Tap-to-explain

Tapping a number (dotted underline) opens a bottom sheet with its **Breakdown** and linked corpus actions; tapping a name opens its rules text and licence tag.

### Warnings

`warnings[]` on the **CritCrafter sheet**: everything the function swallowed (unmatched names, breakdown residuals, unknown mods). No viewer UI in v1; logged by code and count only, never with detail.

### Features

The collapsed expansion at the bottom of Stats holding passive feats and class features.

### Action source group

A group on the Actions screen by origin: Class, Ancestry, General, Archetype, Familiar, Basic actions, Exploration, Skill actions. Sorted free, one, two, three actions, reaction.

### Table state

The one exception to "read-only": spell slot and focus usage, consumed counts, equip toggles, shield raised, current HP, temp HP and shield HP, kept as deltas in a Pinia store persisted to `localStorage` by **Pathbuilder id**, clamped to the new sheet's maxima on every load. No server side, no cross-device sync, no conditions.

_Avoid_: Treating stored state as the source of truth over the sheet; per-day ability tracking.

### Live AC

`(worn armor acTotal, else unarmored AC) + (shield raised ? shield bonus : 0)`, one body armor at a time. Armor or a shield with unknown (`null`) AC changes nothing.

### Hands limit

Two hands. Equipping or raising a shield puts weapons away (earliest first) until it fits; equipping a weapon or widening a grip drops other weapons, then the shield (a buckler is lowered). A buckler takes a hand only while raised. No weapon starts held.

### Rest

Refocus, 8 h, 24 h or Extended, applied immediately with a toast (no per-rest prompt). Every 8 h or longer rest refills slots and focus and clears temp HP; rests never repair shields or reset consumables.

### Reset tracking

The one confirmed action that clears a character's **table state**.

### Recent

The landing row of the last three successfully loaded ids, labelled with the character name, kept in `localStorage`.

### Failure states

Four distinct load failures: network or CORS (Retry), Pathbuilder HTTP error (Retry), build not found, including a 200 without JSON or a `build` (try another id), and **sheet function** failure (Retry, hidden for `invalid_build`).
