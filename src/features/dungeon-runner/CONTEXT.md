# Dungeon Runner

Single-device card **match** against AI **opponents**; play is deterministic from **setup**, **seed**, and the action **history**.

## Language

### Match

One full play from **setup** through **match over**, including bidding, dungeon runs, and scoring until a winner is decided.

_Avoid_: “Game” alone (ambiguous with the whole app or a single dungeon run).

### Match over

The **match** has ended; a winner seat is recorded and the player sees the match-over outcome.

_Avoid_: “Finished game,” “complete game” (use **match** vocabulary).

### Dungeon run

One runner’s attempt through the monster lane during a **match**; distinct from the whole **match**.

### Empty dungeon run

A **dungeon run** where the dungeon pile has no **monsters** when the runner is sent in. The runner wins immediately (nothing to fight). Mid-run clears that exhaust the pile use the same success outcome via normal dungeon resolution.

_Avoid_: Treating an empty pile as a stuck dungeon phase or as a runner loss in this product (see **Flagged ambiguities** for training-repo divergence).

### Setup

Seat count and **opponent** roles (human, neural opponent, random bot) chosen before a **match** starts.

### Opponent

A non-human seat in **setup** (neural opponent or random bot).

_Avoid_: “Role badge,” seat-type chips during play (role is fixed at **setup**; **setup** controls already show human vs **opponent** type).

### History

Ordered canonical actions and RNG step metadata that fully determine how a **match** unfolded.

_Avoid_: “History panel,” “action log” as in-match player UI (no play-surface for **history**; use **replay envelope** export when inspection is needed).

### Seed

The numeric RNG starting point for a **match**; with the same **setup** and **seed**, initial state and replayed outcomes match.

### Replay envelope

Versioned export shape: **seed**, **setup**, **history**, and optional **presentation pace** (e.g. cinematic or brisk)—used to rebuild state and share/debug a **match**.

_Avoid_: Treating the envelope as only a debug artifact; it is also the canonical serialized form of a finished **match** for archival.

### Completed match replay

A **replay envelope** for a **match** that has reached **match over**, captured automatically and retained for later analysis (e.g. model training).

_Avoid_: “Telemetry,” “training data,” “upload,” “save prompt,” “consent flow” (pipeline, transport, and opt-in UX are out of glossary scope).

### Game data catalog

The single source of truth for static **equipment** and **monster** definitions shared by rules resolution and presentation.

_Avoid_: “Model catalog” (neural opponent weights), “display catalog” alone when meaning the full **game data catalog**, “content pack.”

### Adventurer

One of the four runner-chosen classes (Warrior, Barbarian, Mage, Rogue), identified in code by a stable adventurer id (e.g. `WARRIOR`).

_Avoid_: “Hero” when meaning the class choice (use **adventurer** in product language; `hero` remains an implementation alias in actions and state).

### Hero loadout

The fixed set of six **equipment** ids dealt to an **adventurer** class for bidding and dungeon play.

### Default loadout

The **equipment** kit used before an **adventurer** is chosen for the round; same ids as the Warrior **hero loadout** (not a separate catalog entry).

### Base adventurer HP

Starting hero HP for an **adventurer** class before **equipment** HP bonuses apply.

### Adventurer identity

Badge colors, glyphs, and concise labels for an **adventurer** class; lives in the **ui** slice of that **adventurer** catalog entry.

### Equipment

A bid-and-play card type identified by a stable equipment id (e.g. `W_PLATE`); defined by one **game data catalog** entry with rules fields (e.g. HP contribution) and a **ui** slice for presentation.

### Monster

A dungeon-lane card type identified by a stable **species** id (e.g. `goblin`); defined by one **game data catalog** entry with a fixed **strength** (combat value).

_Avoid_: “Creature,” “enemy” (use **monster** in product and catalog language); treating **strength** as the catalog primary key (use **species** — strength is unique per species but is a field, not the id).

### Catalog rules

The core fields on a **game data catalog** entry that rules resolution may use—e.g. **equipment** HP contribution, optional use/decline action types, **monster** **strength**—distinct from the **ui** slice.

_Avoid_: Importing **ui** from the engine/kernel (presentation stays downstream).

### ui (catalog slice)

Presentation and card-face fields on a **game data catalog** entry—**equipment** `shortName`, `label`, and `details`, symbol art keys, and **monster** neutralization icon keys—kept separate from **catalog rules** on the same row.

_Avoid_: “Display catalog” as a second parallel table; a separate UI-only module that duplicates ids.

### Equipment short name

Compact **equipment** label for tight UI (e.g. sacrifice phrasing); from the entry’s **ui** `shortName`.

### Equipment label

Full **equipment** title for modals and token chrome; from the entry’s **ui** `label` (may differ from **equipment short name**).

### Species

The canonical id string for a **monster** catalog entry (e.g. `goblin`); keys deck composition, rules lookup, and doodle assets.

### Strength

The combat value on a **monster** entry; each strength maps to exactly one **species** (e.g. strength 2 is always skeleton, 3 always orc).

### Monster deck

The standard ordered list of **monster** **species** ids (including duplicates) used to build the dungeon lane at **match** start.

### Policy species order

The canonical ordering of **monster** **species** ids for neural observation encoding; fixed in the **game data catalog** and stable across balance edits unless models are retrained.

### TF.js model sync

Maintainer workflow after dungeon-runner **gated promotion**: convert promoted H5 weights to TF.js under `public/models/dungeon-runner/<promoted version>/`, regenerate the neural **model catalog**, and refresh **web deployed latest** only when the synced id equals dungeon-runner **production latest** (`models/latest` symlink). Semver dirs are immutable **deployed model version** pins; `latest/` is the moving production alias (`modelId: 'latest'` in default setup).

_Maintainer doc_: [`scripts/MODEL_RELEASE.md`](../../../scripts/MODEL_RELEASE.md) (**two-repo model release**, **release smoke**).

_Avoid_: Conflating **game data catalog** with the neural **model catalog**; syncing training-run ids (`bc-*`) instead of **promoted version** semver dirs.

## Relationships

- The **game data catalog** is the sole maintainer of **equipment**, **monster**, **adventurer**, and **monster deck** static definitions; older parallel tables are removed rather than re-exported.
- For static **match** content, the **game data catalog** overrides informal design notes when they disagree.
- The **game data catalog** holds one entry per **equipment** id, per **monster** **species**, and per **adventurer** id.
- Each **monster** **species** has exactly one **strength**, and each **strength** in the catalog refers to exactly one **species**.
- **Equipment** optional use/decline action types are **catalog rules**; effect help prose lives in **ui** `details`.
- **Adventurer identity** fields are **ui** only; the engine/kernel consumes **catalog rules** only, not **ui**.
- **Equipment** and **monster** definitions are consulted during **dungeon runs** and bidding within a **match**.
- A **match** contains one or more **dungeon runs** before **match over**.
- A **completed match replay** is a **replay envelope** captured when **match over** is reached.
- **History** supplies the ordered actions recorded in a **replay envelope**.
- **TF.js model sync** runs in portfolio-site after dungeon-runner promote; default NN opponents load **web deployed latest** without setup changes.

## Example dialogue

> **Dev:** “When the player wins, do we save the last **dungeon run** or the whole **match**?”
> **Domain expert:** “The whole **match** — once we’re at **match over**, persist a **completed match replay**, not an isolated run.”

> **Dev:** “Is that the same JSON as debug export?”
> **Domain expert:** “Same **replay envelope** — **completed match replay** is the product name for that payload after a real finish.”

> **Dev:** “Should HP and goblin strength live in `equipmentDisplayCatalog`?”
> **Domain expert:** “No — one **game data catalog** entry per id/species; labels and symbol keys live in the entry’s **ui** slice, not a parallel table.”

## Flagged ambiguities

- **Empty dungeon run** vs [dungeon-runner](https://github.com/enmaku/dungeon-runner) training: the physical game and this web **match** treat an empty pile as a runner win. The Python training simulator historically scored it as a runner **loss** so policies would not farm wins by passing forever without adding **monsters**. Exported NN weights were trained under that rule; runtime play here follows table rules.
- “Game” in casual speech usually means **match**; “run” usually means **dungeon run**.
- “Catalog” without qualifier may mean the neural **model catalog** or the **game data catalog** — use the full term.
- In-match “history panel” was considered and rejected — **history** stays engine/replay data only.
- Seat “role badges” during play were considered and rejected — **opponent** type belongs in **setup** only.
