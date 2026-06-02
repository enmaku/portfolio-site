# Dungeon Runner

Single-device card **match** against AI **opponents**; play is deterministic from **setup**, **seed**, and the action **history**.

**Ubiquitous language (consolidated):** [`UBIQUITOUS_LANGUAGE.md`](../../../UBIQUITOUS_LANGUAGE.md) ↔ [dungeon-runner `UBIQUITOUS_LANGUAGE.md`](https://github.com/enmaku/dungeon-runner/blob/main/UBIQUITOUS_LANGUAGE.md). Training detail: [dungeon-runner `CONTEXT.md`](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md). Index: [`CROSS_REPO.md`](../../../CROSS_REPO.md).

## Language

### Match

One full play from **setup** through **match over**, including bidding, dungeon runs, and scoring until a winner is decided.

_Avoid_: “Game” alone (ambiguous with the whole app or a single dungeon run).

### Match over

**Web game engine** terminal phase `match-over` with a recorded winner (`matchWinnerSeatId`). Authoritative for play, **completed match replay** upload, and dungeon-runner **replay verifier**. Not **Python training sim** **sim empty-pile forfeit** or other sim-only endings without a winner.

_Avoid_: “Finished game,” “complete game”; calling sim forfeit “match over.”

### Dungeon run

One runner’s attempt through the monster lane during a **match**; distinct from the whole **match**.

### Empty dungeon run

A **dungeon run** where the dungeon pile has no **monsters** when the runner is sent in. The runner wins immediately (nothing to fight). Mid-run clears that exhaust the pile use the same success outcome via normal dungeon resolution.

_Avoid_: Treating an empty pile as a stuck dungeon phase or as a runner loss in this product (see **Flagged ambiguities** for training-repo divergence).

### Setup

Seat count and **opponent** roles (human, **neural opponent**, **Randombot**) chosen before a **match** starts.

### Opponent

A non-human seat in **setup** (**neural opponent** or **Randombot**).

_Avoid_: “Role badge,” seat-type chips during play (role is fixed at **setup**; **setup** controls already show human vs **opponent** type); random bot (two words).

### Randombot

A **setup** **opponent** with role `randombot` (lowercase id in CONTRACT). Chooses legal actions without TF.js; produces **Non-NN history step** entries without `modelId`.

_Avoid_: Random bot, **RandomBot** (Python code spelling only in maintainer notes).

### Human player seat

The single seat whose setup role is `human` after seat shuffle, identified by **actor seat id** in **history** (`seat-1`…`seat-4`). Exactly one per **match**; not in `setup.opponents`. dungeon-runner resolves it at **dataset build** for **Human step** / `is_human` (not from `modelId` absent alone).

_Avoid_: Assuming `seat-1`; conflating with **Non-NN history step** or **Randombot** steps without `modelId`.

### Eliminated

A seat with no lives remaining after losing **dungeon runs** as the runner (two failures from the starting two lives); that seat takes no further turns for the rest of the **match**.

_Avoid_: “Out,” “dead,” “removed from play” without tying to lives; treating a single failed **dungeon run** as **eliminated** while lives remain.

### Elimination end (human)

The **match** is over for the **human player seat** once that seat is **eliminated**; remaining **opponent** play may finish without presentation before **match over** is recorded. A brief **finishing match** state may appear while that remainder resolves. The end dialog uses elimination-focused copy and does not name the winning **opponent**.

_Avoid_: “Forfeit,” “concede,” “quit”; implying the whole **match** stops for all seats when only the human is **eliminated** (under normal rules **opponents** continue until one wins); showing the winning **opponent** on the elimination end dialog.

### Defeat (human, not eliminated)

The human lost **match over** while still having lives (e.g. an **opponent** reached two wins first). The end dialog names the winning seat as today.

_Avoid_: Using elimination end copy when the human was not **eliminated**; conflating with **Elimination end (human)**.

### Match over end variant

How the **human player seat** experienced **match over**, as one of: `victory`, `defeat-not-eliminated`, or `elimination-end-human`. Same classification as the end dialog (`getMatchOverEndDialogVariant`). Persisted on **completed match outcome** as `endVariant`.

_Avoid_: Inferring variant from **replay envelope** alone (no terminal winner on envelope v1); conflating **elimination end (human)** with a normal score-race defeat.

### History

Ordered canonical actions and RNG step metadata that fully determine how a **match** unfolded.

_Avoid_: “History panel,” “action log” as in-match player UI (no play-surface for **history**; use **replay envelope** export when inspection is needed).

### Seed

The numeric RNG starting point for a **match**; with the same **setup** and **seed**, initial state and replayed outcomes match.

### Replay envelope

Versioned export shape: **seed**, **setup**, **history**, and optional **presentation pace**—used to rebuild state and share/debug a **match**.

_Avoid_: Treating the envelope as only a debug artifact; it is also the canonical serialized form of a finished **match** for archival.

### Presentation pace

Optional **replay envelope** field `presentationSpeedProfile`: `cinematic` or `brisk`. Playback hint for debug/replay UI only; not rules state, not used by dungeon-runner **replay verifier** or **derived training rows**.

_Avoid_: Presentation pace as a training label; invalid enum at import (`INVALID_REPLAY` when key present).

### Completed match replay

A **replay envelope** for a **match** that has reached **match over**, captured automatically and retained for later analysis (e.g. model training).

_Avoid_: “Telemetry,” “training data,” “upload,” “save prompt,” “consent flow” (pipeline, transport, and opt-in UX are out of glossary scope).

### Completed match replay archive

The RTDB subtree where **completed match replay** envelopes are stored keyed by match id; each key is written at most once from the browser. Root-level read includes **archive listing** for maintainer ingest (see dungeon-runner `CONTEXT.md`).

_Avoid_: Treating the archive as a live **room** or expecting the play app to read it during a **match**.

### Completed match outcome

A write-once, queryable **analytics snapshot** at **match over**, keyed by match id in Firestore. Denormalizes setup, resolved seats, terminal **scoreboard**, outcome semantics, replay linkage fields, and **history** rollups so future dashboards rarely need schema migrations or second backfills. Does **not** embed the full **history** array (that stays on **completed match replay**). **`humanWon`** is `true` only when **match over end variant** is `victory` (same policy as the end dialog, not envelope-only data).

_Avoid_: “Summary,” “telemetry”; treating it as part of the **replay envelope**; minimal field sets that force re-backfill when new charts are added; storing full **history** on the outcome doc; duplicating **replay envelope version** or **seed** on the outcome (join via **completed match replay** if needed).

### Match outcome dashboard

A public portfolio page at `/projects/dungeon-runner/stats` (**Dungeon Runner Stats** in navigation) that aggregates **completed match outcome** docs into human-readable play statistics (counts, rates, simple charts). Uses the portfolio **shell** (`MainLayout`), not the phone-framed Dungeon Runner play **project** shell. Desktop-first layout; responsive Quasar page composition should remain usable on narrow viewports. Listed under **Projects drawer sections** → Desktop with a chart-style nav icon (`bar_chart`). Opens via in-tab navigation (not **detached project launch**). **Paste-unfurl eligible** with share title `Dungeon Runner Stats` and a description summarizing aggregate completed-**match** results (wins, eliminations, opponent outcomes).

Each **dashboard tile** loads its own Firestore query and shows a loading state until that query settles—no single shared in-memory snapshot for the whole page. **Aggregate count tiles** use `getCountFromServer` (and filtered counts) only. **Time-series dashboard tiles** may fetch a bounded, field-projected slice of the **completed match outcome archive** (see **human win series**); the moving average and other series math run client-side on that slice.

_Avoid_: “Analytics portal,” “telemetry console”; conflating with **completed match replay** ingest or maintainer backfill tools; treating it as part of the mobile-forward play route; one monolithic in-memory snapshot shared by all tiles; unbounded full-document collection scans.

### Dashboard tile

One modular statistic block on the **match outcome dashboard**, backed by its own Firestore query and loading UI. **Aggregate count tiles** (headline counts and rates): total completed **matches**; human win rate; counts by **match over end variant**; human **eliminated** rate; winner role breakdown (human / nn / randombot). **Time-series dashboard tiles** plot a metric over a **match sequence** (e.g. **rolling human win rate** from a **human win series**). Each tile is an independently registered unit so new tiles can be added without rewiring the whole page. Default grid span is one-third row width at desktop breakpoints; a tile may declare **`full` row span** (`col-12` at all breakpoints) when a statistic needs full content width—e.g. the **rolling human win rate** line chart with its window-size control.

**Dashboard tile order (desktop):** row 1 — completed **matches**, human win rate, human **eliminated** rate; row 2 — **rolling human win rate** chart (full width); row 3 — **match over end variant** breakdown, winner role breakdown, **defeat flavor** breakdown; row 4 — **match length over time** line chart (full width); row 5 — **matches per week** bar chart (full width, up to 52 UTC weeks). Registry order plus span metadata should produce this layout without ad hoc row markup per tile.

_Avoid_: “Widget” when meaning a dashboard block; reusing the term for phone-framed play UI panels; aggregate tiles that scan every outcome doc for means (e.g. average **history** length)—defer until pre-aggregated rollups exist; fetching full **completed match outcome** documents when a field-projected query suffices.

### Dashboard error state

A failed **dashboard tile** shows the same generic error presentation (not success UI and not silent zeros). Zero completed **matches** in the archive is an error, not an empty success. Successful tiles still render when their queries succeed; one broken tile does not hide the rest.

Visitor-facing copy for any **dashboard error state** (page or tile): “Unable to load match statistics.” Rate **dashboard tiles** show rounded whole percents (e.g. `67%`).

_Avoid_: Per-tile “0 matches yet” or all-zero headline stats; distinct visitor-facing error copy per failure mode in v1 (maintainer detail stays in console/logs only); collapsing the whole page because a single non-critical tile failed.

When Firebase is not configured for the site, the page shows only the generic **dashboard error state** and does not run **dashboard tile** queries. Configured layout uses a responsive tile grid: one column on narrow viewports, two from small breakpoints, **three tiles per row** from medium breakpoints upward (`col-12` → `col-sm-6` → `col-md-4`), with row wrap as width shrinks. Individual **dashboard tiles** may specify a wider span (e.g. full row) when a statistic needs more horizontal space.

### Completed match outcome archive

Firestore collection `dungeonRunnerMatchOutcomes/{matchId}` holding **completed match outcome** docs. Doc id equals RTDB **completed match replay** key and local match id. Outcome `createdAt` always matches the paired envelope `createdAt` (live: one timestamp for both writes; backfill: copy from RTDB).

_Avoid_: Nesting under a generic `analytics/` path; a different id scheme than the replay archive; a separate outcome timestamp that diverges from the replay envelope.

### Human win series

The time-ordered sequence of `{ createdAt, humanWon }` points loaded for a **time-series dashboard tile**, fetched from the **completed match outcome archive** with Firestore sort on `createdAt` and field projection (not full outcome documents). **`humanWon`** uses the same victory-only policy as the headline human win rate tile. Rolling-window math runs client-side on this series; changing window size does not refetch.

### Rolling human win rate (dashboard)

**Dashboard tile** title: **Rolling human win rate** (distinct from the headline **Human win rate** rate tile). For window size *n*, each plotted point is the win rate over the **last *n* matches** ending at that point (strict rolling window). Points appear only once *n* matches exist in the series up to that index; fewer than *n* **matches** in the loaded series is a **dashboard error state** for that tile, not a partial chart. The chart’s horizontal axis is **match sequence** (ordinal position in the loaded **human win series**, oldest→newest left→right), not calendar time labels—`createdAt` orders the series but is not shown on the axis. The vertical axis is fixed **0–100%** with rounded whole-percent ticks, consistent with rate **dashboard tiles**. Window size *n* is visitor-configurable (default **10**, minimum **5**, maximum **100**); changing *n* recomputes the series client-side without refetching the **human win series**. At runtime, cap the slider maximum and default to **`min(100, series.length)`** and **`min(10, series.length)`** respectively so small archives still render when at least **5** **matches** are loaded; fewer than **5** in the series remains a **dashboard error state**.

### Human win series fetch cap

The **human win series** query loads at most the **500 most recent** **completed match outcomes** by `createdAt` (field-projected `humanWon` + `createdAt` only). Older archive rows are omitted from the chart without visitor-facing notice.

_Avoid_: “Win/loss stream,” “game history”; treating **`matchIdEpochMs`** as the series sort key; expanding-window averages for early points; recomputing the **human win series** on every slider move when the underlying query is unchanged; unbounded or paginated full-archive scans in v1 of this tile.

### Match id epoch

Optional numeric `matchIdEpochMs` on **completed match outcome**: milliseconds parsed from `match-{digits}` when the id follows that pattern, else `null`. Charting aid only—not a substitute for outcome `createdAt`.

_Avoid_: Treating it as authoritative match start time if id format changes; using it instead of envelope `createdAt` for upload ordering or **human win series** ordering.

### Equipment sacrifice count

On **completed match outcome**, the number of canonical `SACRIFICE` actions in **history** for that **match** (one per piece removed from the table during bidding). Rolled up at **match over**, not stored per step on the outcome doc.

_Avoid_: Counting equipment merely played or discarded in **dungeon runs**; inferring from **scoreboard** alone.

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
- **Elimination end (human)** and **Defeat (human, not eliminated)** use different end-dialog copy; only the latter names the winning seat.
- Headless completion of remaining **opponent** play after human **elimination** uses the same action choosers as live play (not a simplified bot).
- Each **match** has exactly one **human player seat**; the human is not an **opponent** in **setup**.
- A **completed match replay** is a **replay envelope** captured when **match over** is reached.
- The **completed match replay archive** holds **completed match replay** envelopes keyed by match id; each key is written at most once from the browser; **archive listing** at the root is allowed for maintainer ingest.
- Each **match** has at most one **completed match replay** and at most one **completed match outcome**, both keyed by the same match id; the outcome is stored separately from the envelope (Firestore, not RTDB).
- The **match outcome dashboard** reads the **completed match outcome archive** only; it does not require **completed match replay** payloads for headline aggregate metrics.
- A **time-series dashboard tile** builds a **human win series** from field-projected outcome queries; aggregate **dashboard tiles** continue to use count queries only.
- **Completed match outcome** writes: browser create-only (doc must not exist); no client update/delete. Maintainer **backfill-outcomes** uses Admin SDK and skips existing docs (delete to re-run). Same trust model as **completed match replay archive** (analytics best-effort, not training truth).
- **`buildMatchOutcomeRecord`** lives in portfolio-site; live upload and dungeon-runner **derive_match_outcome** (via **web engine root**) call the same function—same pattern as **replay verifier** importing the **web game engine** kernel in Node.
- **Match outcome derive parity** (`analytics/matchOutcomeDeriveParity.test.mjs`): with `DUNGEON_RUNNER_ROOT` set, replays `analytics/fixtures/replay-envelope-outcome-*.json` through the web engine and asserts `buildMatchOutcomeRecord` deep-equals `derive_match_outcome.mjs` stdout and portfolio outcome goldens.
- **Completed match replay archive** writes use the same RTDB payload sanitization as star-room **projects** (Game Timer, Movie Vote); they are not a separate Firebase stack—only the path and optional-upload behavior differ (see [ADR 0005](../../../docs/adr/0005-shared-firebase-rtdb-core.md)).
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

- **Empty dungeon pile at bidding end** vs **sim empty-pile forfeit**: **web game engine** gives an immediate successful **dungeon run** (see kernel test). **Python training sim** uses **sim empty-pile forfeit** (`EMPTY_DUNGEON_FORFEIT`, no winner)—an anti-pass-farming rule from early training that remains a sim **local minima**; runtime play follows web/table rules. See [`UBIQUITOUS_LANGUAGE.md`](../../../UBIQUITOUS_LANGUAGE.md).
- “Game” in casual speech usually means **match**; “run” usually means **dungeon run**.
- “Catalog” without qualifier may mean the neural **model catalog** or the **game data catalog** — use the full term.
- In-match “history panel” was considered and rejected — **history** stays engine/replay data only.
- Seat “role badges” during play were considered and rejected — **opponent** type belongs in **setup** only.
