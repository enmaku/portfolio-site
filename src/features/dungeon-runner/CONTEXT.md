# Dungeon Runner

Single-device card **match** against AI **opponents**; play is deterministic from **setup**, **seed**, and the action **history**.

**Ubiquitous language (consolidated):** [`UBIQUITOUS_LANGUAGE.md`](../../../UBIQUITOUS_LANGUAGE.md) ↔ [dungeon-runner `UBIQUITOUS_LANGUAGE.md`](https://github.com/enmaku/dungeon-runner/blob/main/UBIQUITOUS_LANGUAGE.md). Training detail: [dungeon-runner `CONTEXT.md`](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md). Index: [`CROSS_REPO.md`](../../../CROSS_REPO.md).

## Language

### Match

One full play from **setup** through **match over**, including bidding, dungeon runs, and scoring until a winner is decided.

_Avoid_: “Game” alone (ambiguous with the whole app or a single dungeon run).

### Current match

The locally persisted in-progress **match** until **match over** or explicit clear: **setup**, engine state, **history**, and optional **persisted neural recovery**. Distinct from a finished **match** archived as **completed match replay**.

_Avoid_: “Saved game,” “session blob”; conflating with **replay envelope** or **completed match outcome**; treating **current match** as live-only with no storage.

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

### Neural opponent

A **setup** **opponent** with role `nn` that chooses legal actions via TF.js inference for a configured `modelId` (defaults to **web deployed latest**). Subject to **neural runtime recovery** when load or infer fails.

_Avoid_: “NN seat,” “AI opponent” without **setup** role; treating **Randombot** as a **neural opponent**; conflating `modelId` with **game data catalog** ids.

### Neural runtime recovery

Coordinated handling of TF.js load and infer failures for a **neural opponent** `modelId` (shared model cache): retries with escalating repair until success clears the coordinator or a **neural recovery terminal outcome** is reached. While recovery is in progress and non-terminal, only the active **neural opponent** seat’s turn is blocked. Consumers subscribe to coordinator changes rather than polling opaque internal state. Live-play reactions to recovery (re-schedule, prefetch cancel, recovery UI) consolidate in one page subscribe handler; **persisted neural recovery** is written at the terminal moment (including live-play **REFRESH** before refresh UX is shown), not in the subscribe path.

_Avoid_: Retry counts, backend names, or coordinator field names (see `CONTRACT.md`); blocking human or **Randombot** turns during NN recovery; substituting a legal action on failure; Vue-specific reactivity hacks (e.g. revision counters) inside recovery modules; folding **current match** persistence into recovery subscribe callbacks.

### Match neural load gate

Pre-**match** check that runs before the first turn on new **match** start and on resume-from-storage: preload each **neural opponent** `modelId` from **setup** once. Any load failure immediately yields **neural recovery terminal outcome** **SETUP** (clear the **current match**, restore the **setup** snapshot) without **neural runtime recovery** retries.

_Avoid_: Conflating with per-turn **neural runtime recovery**; expecting multi-strike load retries at **match** bootstrap; treating gate failure as **REFRESH**.

### Live AI turn pipeline gate

Single live-play policy for whether an **opponent** turn may be scheduled, prefetched, or run. Evaluated from **match** state, **neural runtime recovery**, **match neural load gate** in-flight, **neural recovery terminal outcome** UX (e.g. refresh dialog open), presentation lock, and headless-completion in-flight. Returns all three permissions from one snapshot so schedule, prefetch, and run cannot drift.

Schedule and prefetch may diverge: while an active **neural opponent** is recovering or presentation locks gameplay input, schedule stays blocked but prefetch may still run to warm inference for the upcoming turn. Prefetch stays blocked when the **match neural load gate** is in flight, a **neural recovery terminal outcome** refresh dialog is open, or **finishing match** headless completion is in flight. **Run** shares schedule’s blockers (including load gate and deferred post-dungeon state); only prefetch may be permitted while schedule is blocked.

_Avoid_: “AI pipeline,” “scheduling gates” without **live** scope; conflating with **match neural load gate** (bootstrap-only) or headless **finishing match** chooser wiring; three independent skip checks in the play page; assuming schedule blocked always implies prefetch blocked; letting run proceed when schedule would not.

### Neural recovery terminal outcome

The terminal state of **neural runtime recovery** for a given **neural opponent** `modelId`: `NONE` (no terminal outcome—recovery may still be in progress or cleared after success), `REFRESH` (infer failures exhausted—the player must refresh the page and the **current match** may remain), or `SETUP` (load failures exhausted—return to **setup** with the last **setup** choices preserved and the **current match** cleared).

_Avoid_: Separate glossary entries for `REFRESH` and `SETUP`; treating **SETUP** as discarding **setup** choices; conflating **REFRESH** with abandoning the **match**.

### Persisted neural recovery

Optional state on the in-progress **current match** (`neuralRecoveryByModelId`): per-`modelId` **neural runtime recovery** coordinator state and **neural recovery terminal outcome** when exhaustion occurs during live play, **finishing match**, or headless completion, so reload and resume surface the same blocking refresh or **setup** UX. **REFRESH** keeps the **current match** and defers headless completion until the player refreshes; **SETUP** clears the **current match** and restores **setup**.

_Avoid_: “Recovery blob,” “NN persistence JSON”; treating **persisted neural recovery** as part of **history** or **replay envelope**; running headless completion while **REFRESH** is persisted.

### Human player seat

The single seat whose setup role is `human` after seat shuffle, identified by **actor seat id** in **history** (`seat-1`…`seat-4`). Exactly one per **match**; not in `setup.opponents`. dungeon-runner resolves it at **dataset build** for **Human step** / `is_human` (not from `modelId` absent alone).

_Avoid_: Assuming `seat-1`; conflating with **Non-NN history step** or **Randombot** steps without `modelId`.

### Eliminated

A seat with no lives remaining after losing **dungeon runs** as the runner (two failures from the starting two lives); that seat takes no further turns for the rest of the **match**.

_Avoid_: “Out,” “dead,” “removed from play” without tying to lives; treating a single failed **dungeon run** as **eliminated** while lives remain.

### Finishing match

Headless resolution of remaining **opponent** play after the **human player seat** is **eliminated**, before **match over** is recorded; may run with or without live presentation. A brief **finishing match** presentation state may appear while that remainder resolves.

_Avoid_: Treating **finishing match** as **match over**; implying the whole **match** stops when only the human is **eliminated**; conflating with **neural runtime recovery** blocking (recovery can interrupt headless completion).

### Play setup surface

The pre-**match** play UI for seat count, **opponent** roles, validation, and starting a **match**; active while there is no **current match** in play-route state (including after **neural recovery terminal outcome** **SETUP** or **match neural load gate** failure clears the **current match**).

_Avoid_: “Setup screen,” “lobby”; conflating with **setup** (configuration data, not the surface); switching here because a blocking dialog is open while a **current match** still exists (**REFRESH** stays on **live match shell**).

### Live match shell

The in-progress play surface from first turn through **finishing match** (if any): board, human actions, **opponent** turn scheduling, presentation bindings, and mid-**match** dialogs ( **dungeon run** outcome, equipment, Vorpal, deck splay, **finishing match** overlay, **REFRESH** terminal). Active while a **current match** exists in play-route state and **match-over shell** has not taken over—including when blocked by **REFRESH** terminal, **finishing match**, or presentation locks.

_Avoid_: “Game board” alone when meaning the whole live surface; treating **finishing match** as **match over**; conflating with **play setup surface**; using open dialogs alone as the shell switch; hosting **match neural load gate** pre-**match** failure UI here (that belongs on **play setup surface** when no **current match** yet exists).

### Match-over shell

The post-**match over** play surface: outcome dialog, **completed match replay** upload hooks, rematch, and return to **play setup surface**. Replaces the **live match shell** once the engine records **match over**—not during **finishing match**. The bidding/dungeon board is not rendered while this surface is active; **current match** data may remain in memory for upload and rematch until cleared. **Rematch** starts a new **match** with the same **setup** snapshot and enters **live match shell** directly (after **match neural load gate**); **Back to setup** clears the **current match** and restores **play setup surface** with prior **setup** choices. **Completed match replay** and **completed match outcome** upload run once when this surface activates (background, idempotent—not deferred until the player dismisses outcome UX).

_Avoid_: “End screen” without **match over** scope; conflating with **dungeon run** outcome dialogs (mid-**match**); activating during **finishing match**; leaving the live board mounted behind the outcome dialog; routing **Rematch** through **play setup surface** unless gate failure yields **SETUP** terminal; waiting for **Rematch**/**Back to setup** before upload; triggering upload from **live match shell** board wiring.

### Play route chrome

Shared header and controls on the Dungeon Runner play route outside the three shells: title, help, settings (**presentation pace**, memory aid, fullscreen), debug badge, and **play route bootstrap**. Shell-specific actions (e.g. intentional new **match** during live play) wire through the active shell but reuse this chrome frame. **Play route bootstrap** (resume **current match** from storage on first open) is coordinated here via orchestration modules—shells do not re-run gate, terminal recovery, or headless-completion policy.

_Avoid_: Duplicating header/settings per shell; treating **match outcome dashboard** chrome as **play route chrome** (stats uses **portfolio shell**, not play **project** shell); duplicating **SETUP**/**REFRESH** bootstrap branches inside shells.

### Debug replay panel

Maintainer-only replay export/import UI when debug mode is on. Full panel (import, export, NN trace history) lives in **live match shell**; **match-over shell** may expose export-only when debug mode is on; **play setup surface** shows neither.

_Avoid_: “Debug menu” without scope; import on **match-over shell** or **play setup surface**; moving the debug badge out of **play route chrome**.

### Elimination end (human)

The **match** is over for the **human player seat** once that seat is **eliminated**; remaining **opponent** play finishes in **finishing match** before **match over** is recorded. The end dialog uses elimination-focused copy and does not name the winning **opponent**.

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

**Dashboard tile order (desktop):** row 1 — completed **matches**, human win rate, human **eliminated** rate; row 2 — **human win rate over time** chart (full width); row 3 — **match over end variant** breakdown, winner role breakdown, **defeat flavor** breakdown; row 4 — **match length over time** line chart (full width); row 5 — **matches per week** bar chart (full width, up to 52 UTC weeks). Registry order plus span metadata should produce this layout without ad hoc row markup per tile.

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

### Human win rate over time (dashboard)

**Dashboard tile** title: **Human win rate over time** (distinct from the headline **Human win rate** rate tile). Plots every **match** in the loaded **human win series** on **match sequence** (ordinal position, oldest→newest left→right): each point is **win** (100%) or **loss** (0%), with a yellow **trend line** as the moving average over the visitor’s **trend window** (matches). `createdAt` orders the series but is not shown on the axis. The vertical axis is **0–100%**. Trend window default **10**, minimum **2**, maximum **`min(100, series.length)`**; changing the window recomputes client-side without refetch. Semver **model publish** markers use the same rules as **match length over time**. Fewer than **1** **match** in the loaded series is a **dashboard error state** for that tile.

### Human win series fetch cap

The **human win series** query loads at most the **500 most recent** **completed match outcomes** by `createdAt` (field-projected `humanWon` + `createdAt` only). Older archive rows are omitted from the chart without visitor-facing notice.

_Avoid_: “Win/loss stream,” “game history”; treating **`matchIdEpochMs`** as the series sort key; expanding-window averages for early points; recomputing the **human win series** on every slider move when the underlying query is unchanged; unbounded or paginated full-archive scans in v1 of this tile.

### Match id epoch

Optional numeric `matchIdEpochMs` on **completed match outcome**: milliseconds parsed from `match-{digits}` when the id follows that pattern, else `null`. Charting aid only—not a substitute for outcome `createdAt`.

_Avoid_: Treating it as authoritative match start time if id format changes; using it instead of envelope `createdAt` for upload ordering or **human win series** ordering.

### Equipment sacrifice count

On **completed match outcome**, the number of canonical `SACRIFICE` actions in **history** for that **match** (one per piece removed from the table during bidding). Rolled up at **match over**, not stored per step on the outcome doc.

_Avoid_: Counting equipment merely played or discarded in **dungeon runs**; inferring from **scoreboard** alone.

### Sacrifice mode (bidding)

Transient human-player UI during **bidding**, after a **draw** reveals a monster only to the drawer. Entered via **Sacrifice equipment**; highlights only center-table **equipment** that is legally sacrificable right now with a red border and subtle pulse (distinct from dungeon-phase usability glow); tile selection opens the usual **equipment** description with an explicit **Sacrifice** confirmation (no further confirmation dialog). Dismissing that modal via **Continue** without **Sacrifice** leaves sacrifice mode active. Always used for human sacrifice—even when only one piece is legal—replacing name-based sacrifice buttons or dropdowns. While active, the only **bidding** game actions are confirming a sacrifice or **Cancel** (exit sacrifice mode without discarding)—the drawer must exit sacrifice mode before **Add to dungeon** or other turn actions. **Cancel** also closes any open **equipment** description modal. Spent or removed **equipment** tiles stay readable but are not highlighted and cannot be confirmed for sacrifice; tapping them during sacrifice mode still opens the description modal, and dismissing that modal leaves sacrifice mode active. **Play route chrome** affordances (settings, help, and similar system surfaces) stay available. Entering or using sacrifice mode follows the same human gameplay interactability rules as other **bidding** turn actions (e.g. **Draw**, **Add to dungeon**): blocked while presentation locks gameplay input. Human **live match shell** presentation only; **opponent** sacrifice behavior and the legal **SACRIFICE** action space are unchanged.

_Avoid_: “Sacrifice picker,” dropdown-by-name as the primary sacrifice UX; red highlight on tiles that rules do not allow sacrificing; treating sacrifice mode as a separate **match** phase; leaving **Add to dungeon** enabled alongside sacrifice mode; one-tap human sacrifice shortcuts that bypass tile selection and confirmation; changing how **neural opponent** or **Randombot** choose sacrifices; persisting sacrifice mode across reload (ephemeral **live match shell** UI only).

### Vorpal declaration (dungeon)

The pre-reveal **species** choice at **dungeon run** start when the runner has Vorpal **equipment** in play (`W_VORPAL` or `R_VORP`). Mandatory whenever that gear is in play and the dungeon lane is non-empty—no skip or dismiss. The human names one **species** from the fixed roster (`DECLARE_VORPAL`); all eight roster **species** are always legal regardless of dungeon pile contents (hidden-info). If the first revealed **monster** matches that **species**, Vorpal neutralizes it. Human **live match shell** UX: a persistent near-fullscreen blocking panel (same class as **deck splay**) over a dimmed board, showing all eight **monster** card faces (one per **species**) in a vertically scrollable overlapping “hand” (cards slightly stacked; the selected card drawn larger toward center); scroll browses only—tap a card to select (enlarged toward center with a selection outline), then **Confirm** to declare—no **Cancel**, no species pre-selected on open. **Play route chrome** (help, settings, and similar system surfaces) stays usable—including while the picker is open and while presentation locks gameplay input on the board. Card taps and **Confirm** follow the same interactability gate as other human turn actions (disabled when gameplay input is locked). With **memory aid** on, each card may show how many of that **species** the human added to dungeon piles (caption only when count > 0).

_Avoid_: “Vorpal target,” “vorpal weapon target,” or “vorpal blade” without clarifying it is a **species** declaration on Vorpal **equipment** in play, not picking a visible lane card; “equipment pile” when meaning bidding center table or discard piles (use **in play** for the runner’s dungeon kit); filtering the roster by pile composition; treating declaration as “which **monster** is up next” from hidden lane state; pre-selecting a default **species** when the picker opens; one-tap declaration without **Confirm**; a dismiss or **Cancel** affordance that implies the choice is optional; scroll changing the selected **species** without a tap; showing `0` own-pile counts on every card when **memory aid** is on; changing **neural opponent** or **Randombot** declaration interfaces or action spaces.

### Vorpal declaration picker (human)

The human-player card-hand UI for **vorpal declaration (dungeon)** in **live match shell** only. Ephemeral presentation layer over the same `DECLARE_VORPAL` action—**neural opponent** and **Randombot** interfaces unchanged.

_Avoid_: “Vorpal UI,” “vorpal dialog” without **human** scope; any picker or affordance on **opponent** turns; conflating with engine legality or policy encoding; a second “are you sure?” step after **Confirm**; persisting picker or selected **species** on **current match** reload; re-tapping the selected card to deselect or to commit without **Confirm**.

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

Badge colors, glyphs, and concise labels for an **adventurer** class; lives in the **ui** slice of that **adventurer** catalog entry. UI code resolves it via **`getAdventurerIdentity`** on the **game data catalog**—not a separate **hero**-named re-export layer.

_Avoid_: **`getHeroIdentity`** or other **hero**-prefixed UI helpers when meaning **adventurer** class presentation ( **`hero`** remains fine on engine/action payloads).

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

### Omnipotence

**Equipment** (`M_OMNI`) that grants a second way to win a **dungeon run** after the runner would otherwise lose to combat: if every **monster** in the **omnipotence set** has a distinct **species**, the run succeeds instead of failing. A passing check yields immediate **dungeon run** success (same scoring as clearing the lane) with **omnipotence success copy** in the outcome acknowledgment—not a mid-run revive and not a failure outcome that is reversed later.

_Avoid_: Treating Omnipotence like a healing potion (revive and continue fighting); counting bidding-sacrifice discards or never-drawn **monster deck** cards in the uniqueness check; recording a failed **dungeon run** before applying the alternate win; applying Omnipotence after **M_OMNI** was removed from play (e.g. bidding **equipment** sacrifice); gating **Omnipotence** on **adventurer** identity when **M_OMNI** in play is the rule gate.

### Omnipotence success copy

User-facing acknowledgment text in the mid-**match** **dungeon run** outcome acknowledgment—the same dialog beat as ordinary success/failure copy—when the run succeeded via **Omnipotence** rather than by clearing the lane through combat. Distinct wording only there; **equipment** `details` and help describe the rule, not run-specific outcomes.

_Avoid_: Generic success-only copy when Omnipotence caused the win; implying a different score or life outcome than a standard successful **dungeon run**; failure copy or “almost saved” hints when **Omnipotence** was in play but uniqueness failed (**Omnipotence** is a passive alternate win, not a player choice); duplicating run-outcome copy on the **scoreboard** or in replay export metadata in v1.

### Omnipotence set

The **monster** pile as it existed when the **dungeon run** began—every card placed into the dungeon during bidding, frozen before any lane card is revealed. Excludes cards removed by sacrificing **equipment** during bidding and cards never drawn from the **monster deck**. Lane resolution during the run (defeats, **equipment** removals, Polymorph, and so on) does not shrink or alter this set. Uniqueness is judged at **species** level: duplicate **species** in that initial pile (e.g. strengths 1, 1, 3, 4) fail **Omnipotence**; all distinct **species** (e.g. 1, 3, 4) pass.

_Avoid_: “Full dungeon set” without this definition; `discardedMonsterCards` (sacrifice discards); the remaining **monster deck** after bidding ends; rebuilding the set from defeated/current/unrevealed lane state at the moment of defeat; card-instance uniqueness when the **monster deck** allows duplicate **species** in the pile.

### Species

The canonical id string for a **monster** catalog entry (e.g. `goblin`); keys deck composition, rules lookup, and doodle assets.

### Strength

The combat value on a **monster** entry; each strength maps to exactly one **species** (e.g. strength 2 is always skeleton, 3 always orc). Catalog strengths run 1–7 then 9 (dragon)—there is no strength-8 **monster**.

### Monster deck

The standard ordered list of **monster** **species** ids (including duplicates) used to build the dungeon lane at **match** start. Distinct from **policy species order** (unique roster, ascending **strength**).

### Policy species order

The canonical ascending-**strength** ordering of all eight **monster** **species** in the **game data catalog**: goblin (1), skeleton (2), orc (3), vampire (4), golem (5), lich (6), demon (7), dragon (9). Shared roster for `DECLARE_VORPAL` legal actions, **vorpal declaration picker (human)** card-hand layout, and **neural opponent** observation slots—fixed unless models are retrained.

_Avoid_: Confusing with **monster deck** deal order; alphabetical order; assuming contiguous strengths 1–8; re-sorting the roster in human UI only.

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
- **Omnipotence** is gated by **M_OMNI** in play, not by **adventurer** identity—the Mage is the only **adventurer** with **M_OMNI** in the catalog today, but alternate loadouts may add it elsewhere later. Rules: [ADR 0008](../../../docs/adr/0008-dungeon-runner-omnipotence-alternate-win.md).
- **Omnipotence** evaluates **species** uniqueness in the **omnipotence set** (initial pile at **dungeon run** start) only when the runner would lose to combat and **M_OMNI** is still in play; a passing check yields the same successful **dungeon run** outcome as clearing the lane, not a mid-run revive. A healing potion, if present, resolves before **Omnipotence** (revive and continue); the Mage loadout has no healing potion, so that ordering is not player-visible in standard play.
- After a bidding **draw**, the drawer may **Add to dungeon** or enter **sacrifice mode (bidding)** to discard one legally sacrificable center-table **equipment** piece instead; only highlighted tiles accept sacrifice confirmation. While sacrifice mode is active, **Add to dungeon** and other turn actions are unavailable until **Cancel** or a confirmed sacrifice resolves the choice.
- **Sacrifice mode (bidding)** is **human player seat** UX in **live match shell** only; **opponent** sacrifice is unchanged. Ephemeral—clears on reload; not part of **current match** persistence. Bidding help copy describes enter → pick highlighted tile → confirm → **Cancel**.
- **Vorpal declaration (dungeon)** is a hidden-info **species** pick from the full roster, not a choice among visible lane **monsters**; optional memory-aid own-pile counts are supplementary hints only.
- **Vorpal declaration picker (human)** is **human player seat** UX in **live match shell** only; **neural opponent** and **Randombot** `DECLARE_VORPAL` behavior and interfaces are unchanged. Ephemeral—clears on reload; not part of **current match** persistence.
- **Vorpal declaration picker (human)** lists cards in **policy species order** (ascending **strength**), same roster order as `DECLARE_VORPAL` legality and the former dropdown.
- Dungeon-run help copy describes **vorpal declaration picker (human)** flow (mandatory picker → tap card → **Confirm**; memory-aid counts when enabled).
- **Vorpal declaration picker (human)** follows the same presentation-lock interactability rules as **sacrifice mode (bidding)**; **play route chrome** is never blocked by the picker or by gameplay-input locks.
- **Policy species order** is not **monster deck** order—the deck includes duplicates and follows deal composition, not the unique strength ladder.
- A **match** contains one or more **dungeon runs** before **match over**.
- **Elimination end (human)** and **Defeat (human, not eliminated)** use different end-dialog copy; only the latter names the winning seat.
- Headless completion of remaining **opponent** play after human **elimination** uses the same action choosers as live play (not a simplified bot).
- **Play setup surface**, **live match shell**, and **match-over shell** partition the play route; exactly one is active at a time.
- **Play setup surface** ↔ **live match shell** is driven by whether a **current match** exists in play-route state, not by which dialog is open.
- **Live match shell** stays active during **REFRESH** terminal blocking ( **current match** retained).
- **Finishing match** belongs to the **live match shell**, not the **match-over shell**.
- **Match-over shell** activates only after engine **match over**, not when the human is **eliminated** but **opponents** still play.
- While **match-over shell** is active, the **live match shell** board is unmounted (outcome UX only); **current match** may persist in memory until rematch or return to **play setup surface**.
- **Play route chrome** wraps all three shells; **presentation pace** and memory aid settings apply across **play setup surface** and **live match shell** (and rematch inherits them).
- From **match-over shell**, **Rematch** reuses **setup** and enters **live match shell** without visiting **play setup surface**; **Back to setup** returns to **play setup surface** with **setup** restored.
- Mid-**match** dialogs and **finishing match** overlay belong to **live match shell**; **match neural load gate** failure before a **current match** exists is shown on **play setup surface**.
- **Play route bootstrap** maps orchestration outcomes to the active shell: no saved **match** or **SETUP** terminal → **play setup surface**; **REFRESH** terminal or successful resume → **live match shell** (headless completion when applicable).
- **Completed match replay** and **completed match outcome** upload trigger when **match-over shell** activates, not from **live match shell**; not deferred until outcome dismissal.
- **Opponent** turn scheduling, prefetch, **live AI turn pipeline gate** wiring, presentation-orchestrator callbacks during play, and the **neural runtime recovery** subscribe handler belong to **live match shell** (not **play setup surface** or **match-over shell**).
- Debug badge stays on **play route chrome**; full **debug replay panel** on **live match shell**; export-only on **match-over shell** when debug mode is on.
- **Play route bootstrap** with a **current match** already at **match over** enters **match-over shell** (outcome UX again, board unmounted); upload re-runs idempotently. **Persisted neural recovery** **REFRESH** on resume takes precedence over outcome (**live match shell** + refresh dialog)—**REFRESH** and terminal **match over** must not coexist on one saved **current match**.
- Shared play-route state (**setup**, **current match**, orchestration inputs) lives outside the three shells; shells receive it via the page entry/session seam and own shell-local UI only—not a single composable owning the full **match** lifecycle (#176 rejection stands).
- The **current match** holds in-progress **match** state locally until **match over** or clear; optional **persisted neural recovery** may be attached.
- **Match neural load gate** runs before the first turn on new **match** start and on **current match** resume; gate load failure yields **neural recovery terminal outcome** **SETUP** without **neural runtime recovery** retries.
- On **current match** resume, **match neural load gate** must succeed before surfacing **persisted neural recovery** or **finishing match** headless resolution.
- **Live AI turn pipeline gate** decides schedule, prefetch, and run together during live play; distinct from **match neural load gate** and from headless **finishing match** resolution (headless supplies in-flight state as an input only).
- **Neural runtime recovery** coordinates load/infer failures per **neural opponent** `modelId`; non-terminal recovery blocks only the active **neural opponent** seat.
- **Neural recovery terminal outcome** **SETUP** clears the **current match** and restores **setup**; **REFRESH** keeps the **current match** and requires a page refresh.
- **Persisted neural recovery** on the **current match** is written when any path reaches a terminal outcome (live play, **finishing match**, or headless completion); reload and resume surface the same blocking UX; **REFRESH** defers headless completion until refresh.
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

> **Dev:** “NN infer fails during **finishing match** — do we wipe the **current match**?”
> **Domain expert:** “No — that’s **REFRESH**: keep the **current match**, block until the player refreshes. **SETUP** is for load exhaustion — clear the **current match** and restore **setup**, like **match neural load gate** failure at resume.”

> **Dev:** “Player reloads mid-outcome — do we drop them on the board or back to **setup**?”
> **Domain expert:** “**Match-over shell** again — same outcome UX, upload is idempotent. Only **REFRESH** persisted recovery overrides that and keeps **live match shell** blocked.”

> **Dev:** “Omnipotence failed even though three lane cards looked unique — a bot sacrificed a duplicate **species** during bidding. Bug?”
> **Domain expert:** “Check the initial pile, not the lane at defeat. Sacrifice discards never entered the dungeon. Omnipotence only cares about **species** uniqueness in the pile frozen at **dungeon run** start.”

> **Dev:** “Is Omnipotence a revive like a healing potion?”
> **Domain expert:** “No — passive alternate win after combat would defeat the runner. Immediate success with **omnipotence success copy** in the outcome acknowledgment; ordinary failure copy when uniqueness fails.”

## Flagged ambiguities

- **Empty dungeon pile at bidding end** vs **sim empty-pile forfeit**: **web game engine** gives an immediate successful **dungeon run** (see kernel test). **Python training sim** uses **sim empty-pile forfeit** (`EMPTY_DUNGEON_FORFEIT`, no winner)—an anti-pass-farming rule from early training that remains a sim **local minima**; runtime play follows web/table rules. See [`UBIQUITOUS_LANGUAGE.md`](../../../UBIQUITOUS_LANGUAGE.md).
- “Game” in casual speech usually means **match**; “run” usually means **dungeon run**.
- “Catalog” without qualifier may mean the neural **model catalog** or the **game data catalog** — use the full term.
- In-match “history panel” was considered and rejected — **history** stays engine/replay data only.
- Seat “role badges” during play were considered and rejected — **opponent** type belongs in **setup** only.
- Play page shell split (#212) moves wiring only; **presentation motion registry** consolidation stays a separate slice (#216)—shells consume existing orchestrator/registry seams unchanged.
