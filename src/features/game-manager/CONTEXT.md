# Game Manager

Signed-in personal history for board game nights: what you own, who you play with, how sessions went, and simple records—optional companion to **Game Timer**, not a replacement for unauthenticated timing.

## Language

### Game Manager

The portfolio **project** where an **account owner** manages their **collection**, **saved players**, **play sessions**, and **v1 statistics**.

_Avoid_: Calling it a mode of **Game Timer**; treating timer-only use as incomplete without it.

### Mobile-first project shell

Game Manager’s initial **project shell**, optimized for phone use. Hosts the **manager surfaces**.

_Avoid_: Assuming the mobile layout is the only forever surface for **manager capability**.

### Desktop project shell

A later full-width **project shell** for Game Manager—better for large **collections** and **statistics** views. Out of scope for v1.

_Avoid_: Building v1 **manager capability** inside mobile-only assumptions that block a future shell swap.

### Manager capability

What Game Manager does for an **account owner**—**collection**, people, **play sessions**, **v1 statistics**—independent of which **project shell** presents it.

_Avoid_: “Backend” or “store” in product language; coupling **capability** to one layout.

### Account owner

The signed-in person whose durable Game Manager data this is; sole reader/writer of their **manager store** in v1. They may facilitate a **play session** without being a **present player**. Firebase Auth via Google or email/password; email need not be verified before use.

_Avoid_: “User” alone (too vague across the portfolio); anonymous Firebase identities as owners; requiring the owner to sit every recorded game; blocking email/password owners on verification in v1.

### Sign-in provider

A Firebase Authentication method the **account owner** uses. V1 exposes Google and email/password; Apple and Facebook are deferred until enabled. Anonymous is not an **account owner** path.

_Avoid_: Custom passphrase accounts; requiring Game Timer users to sign in.

### Manager store

The **account owner**’s durable Game Manager data (roster, **collection**, **play sessions**, and whatever aggregates derive from them).

_Avoid_: Confusing with Game Timer / Movie Vote **room** state in Realtime Database.

### Catalog

The external BoardGameGeek-backed encyclopedia of board games used when adding to a **collection**.

_Avoid_: Owning a full local encyclopedia; equating **catalog** with the owner’s **collection**.

### Catalog entry

A normalized game identity and metadata drawn from the **catalog** (keyed by BoardGameGeek id). Shelf rows care about title, box art, player counts, and play time; **game detail** can show a richer curated set (description, year, weight, ranks, and other facts we normalize), always with **catalog attribution**.

_Avoid_: Treating raw BGG XML as the product language; skipping **catalog attribution** where BGG metadata is shown; dumping every upstream field whether or not we normalize it.

### Catalog attribution

Visible credit owed when BoardGameGeek **catalog** metadata is shown, per BGG terms.

### Collection

The **account owner**’s shelf of games they treat as owned—each item either references a **catalog entry** or is a **custom collection entry**. At most one item per **catalog entry** id; adding a game already on the shelf is a no-op / “already owned” path, not a second copy. Every **play session** is started from a shelf item—ownership is required to record a sitting.

_Avoid_: “Library” (ambiguous); preset **group configurations** (out of scope for v1); multiple shelf rows for the same BGG id; recording plays of titles not on the shelf.

### Game detail

A full-screen detail view opened from a **collection** shelf item. Opens immediately on shelf-known facts (title, art, basic counts); for catalog-backed items it then refreshes fuller **catalog** metadata into a rich curated view, with retry if that refresh fails. **Custom collection entries** use stored custom fields only. Bottom action starts a **play session** (“Start new session”), which continues in the same full-screen session flow (`setup` → `playing` via linked Timer → `scoring`). A failed catalog refresh does not block starting a sitting—the shelf identity is enough.

Content is grouped for titles with at least one **play session**: expansion sections **Details** (catalog / shelf facts), **Stats** (this title’s play history—sittings, **play time**, **win share**, expandable per-person-at-this-game figures such as sittings, **banked time**, **session win**s, **win percentage**, and—when **points** history exists—**personal best**, average score, and **points per minute**), and **History** (that title’s **play sessions**, newest first—default collapsed; opens a sitting like **Sessions**). **Stats** opens by default; **Details** and **History** stay collapsed until opened. Visualization-first inside **Stats**. Until the first **play session** for this title, omit the **Stats** and **History** expansions and show the catalog / shelf body flat (no lone **Details** expansion chrome).

_Avoid_: Treating the shelf row itself as the only place game facts appear; starting sessions from the **Sessions** surface’s add control; requiring a successful catalog fetch before “Start new session”; nesting **game detail** as a small dialog over the shelf while the rest of the sitting is full-screen; dumping a long per-game list onto the **Stats** tab; showing an empty **Stats** or **History** expansion for never-played titles; wrapping never-played detail in a single orphan **Details** expansion.

### Play session

One game, one sitting: a chosen **collection** item (**catalog entry** or **custom collection entry** reference), its **present players**, **timer export** (once past **game end** into **scoring**), **session score** (when entered), and a **play session state**. Creation begins from **game detail** (“Start new session”); the durable record appears then (typically in `setup`) so incomplete sittings can be resumed. An **account owner** may keep many incomplete sessions at once and resume any of them. “Save” on the scoring step means enter `complete` with a full **session score**, not first creation of the row.

_Avoid_: Multi-game nights as a single session; preset groups as the attendance model; play sessions for titles not on the **collection** shelf; creating sittings from a Sessions-page + control; delaying durability until final Save.

### Custom collection entry

A non-catalog game identity (homebrew, obscure titles) used when **catalog** search has no acceptable match. V1 requires only a title. Must be on the **collection** shelf before it can be played on a **play session**.

_Avoid_: Forcing every title through BGG when search fails; requiring manual player-count/time metadata in v1; recording a custom title without first shelving it.

### Add to collection

The action that pins a game onto the **collection** shelf (from catalog search or custom title entry)—ownership gate before any **play session** can start for that title.

_Avoid_: Optional shelf membership during session setup; café / friends’-shelf plays without first adding the title.

### Saved player

A reusable roster person with a stable id, display name, and color, aligned with Game Timer player identity fields (not live **banked time**). Color is always present; if the owner doesn’t pick one, Game Manager assigns a default.

_Avoid_: “Group preset”; equating with a Firebase Auth identity (that is future **player claim**); colorless roster identities.

### Saved player management

Dedicated UI for viewing, editing, pinning, and unpinning **saved players**—separate from the add-person shortcut during session setup.

### Group configuration

Named preset rosters or recurring table setups. Out of scope for v1—attendance varies night to night, so v1 uses **present players** selection instead.

### Recorded player

A durable person identity under an **account owner**’s history (stable id + display name + color), as captured across **play sessions**. Distinct from Firebase Auth until **player claim** links them. Color is always present (defaulted when needed). Display name and color are live on the identity—edits in People / roster management apply when viewing past sessions too (sessions reference the person; they don’t freeze the label). Mid-timer rename/recolor on a **manager-linked timer** is session-local via the **timer export**, not an automatic identity write-through.

_Avoid_: Equating with a live **saved player** row only; discarding history because someone was added as a **one-off guest**; treating each night’s name string as an immutable historical artifact.

### Present player

Someone included in a specific **play session**—usually drawn from **saved players**, plus any **one-off guests**. The people picker in `setup` lists **saved players** (none pre-checked) with selection controls and an add-person path (guest / **persist to roster**). At least one **present player** is required before leaving `setup` into `playing`. That `setup` list seeds the **manager-linked timer**. Once wired, leaving `setup` launches Timer immediately (no GM playing hub); until that handoff exists, the `playing` interstitial holds the table (no roster editor there). When a real **game end** export arrives, its roster (stable ids on seats that still carry them) becomes the **present players** for `scoring`. Scoring enters scores for that fixed table—no add-person or **drop out** there. A session cannot enter `complete` with zero **present players**.

_Avoid_: Requiring final attendance before the night starts; a second full roster editor on the timer interstitial; dumping every unpinned **recorded player** onto the picker by default; advancing into `playing` with nobody selected.

### Drop out

Removing a **present player** from this **play session** (and any in-progress score row for them) because they left or never actually played—does not erase their history on other sessions.

_Avoid_: A separate “dropped” outcome mark in v1; deleting the **recorded player** identity when they leave one night.

### One-off guest

A person added for tonight without pinning them on the **saved player** management list. They still receive a durable **recorded player** identity under this **account owner** (name is part of that identity) so scores can accumulate and later support **player claim**.

_Avoid_: Treating one-off as “throw away the person after the night”; skipping a name.

### Persist to roster

The choice, while adding someone, to also pin them as a **saved player** for quick re-selection—same **recorded player** identity, not a second person. Unpinning later only removes the roster pin; history stays until an explicit **person deletion**.

### Person deletion

An explicit action that removes a **recorded player** identity from the **account owner**’s usable people. Past **play sessions** keep a seat via a **removed player** placeholder (not a silent scrub of history, and not a cascade delete of those nights). Distinct from unpinning a **saved player**.

_Avoid_: Equating roster remove with erasing history; deleting every session the person touched; leaving broken references with no placeholder.

### Removed player

A tombstone seat on a past **play session** after **person deletion**—marks that someone was there without retaining their former identity for stats or **player claim**. Excluded from **win share**, per-person expandables, and person-scoped stats; the sitting still counts toward session counts and **play time**.

_Avoid_: Pretending the seat never existed; keeping claimable history after the owner chose deletion; an “Unknown” / Removed slice on **win share** pies.

### Person match prompt

When the **account owner** types a name that matches an existing **recorded player** or **saved player**, Game Manager suggests that identity for confirmation (or lets them create a new person)—no silent merge.

_Avoid_: Auto-merging on normalized name alone; making free-typed names always brand-new without offering a match.

### Unlinked recorded player

A **recorded player** not yet tied to an authenticated identity via **player claim**.

### Linked recorded player

A **recorded player** whose identity has been tied to an authenticated account through **player claim**. Future; not built in v1.

### Player claim

A future, cooperative handoff where an **unlinked recorded player**’s history under one **account owner** becomes linked to another person’s Firebase Auth identity so those records (and later nights logged for that person) can surface in the claimant’s Game Manager. Not built in v1; ids and history must not foreclose it.

_Avoid_: Implementing cross-account sync in v1; requiring the guest to have the app on the night they first play.

### Partial play session

A **play session** retained without a finished **session score**—left before `complete`, or never scored—still counted in **play count**.

### Complete play session

A **play session** in `complete` with a chosen **score entry mode** and full **session score** for that mode. The default view is **session statistics**; a small edit control opens score entry without leaving `complete`. Saving score changes updates the **session score**, stays `complete`, and returns to **session statistics**.

### Play session state

Lifecycle position of a **play session**: `setup`, `playing`, `scoring`, or `complete`. The owned-game creation path is forward along that order without skipping **playing**: people pick in `setup`, always launch the **manager-linked timer** in `playing`, **game end** attaches a **timer export** and **continues to scoring**, then `complete` on Save. From score entry (`scoring`, or editing a `complete` sitting) the owner may step back to `playing` to reopen the **timer leg** (hydrated from the **timer export**). Entering `complete` requires a chosen **score entry mode** and a full **session score** for that mode (every **present player** scored for **points**, or marked for **outcomes**). Once `complete`, the owner reviews **session statistics** by default; editing scores is an explicit side path that does not demote the sitting to `scoring` as the lasting state—but returning to the timer from that edit path does demote to `playing`. Early stops remain **partial play sessions** until **session deletion**.

_Avoid_: Treating states as freely jumbleable labels; making `complete` immutable except by delete-and-recreate; marking `complete` with half-filled scores; reaching **scoring** without **game end** / **timer export** once wired; treating score entry as the default reopen view for `complete`.

### Session statistics

The post-save / reopen view for one **complete play session**: that sitting’s **session score** (mode-honest), **play time** (sitting wall-clock), per-person **banked time**, and callouts when they apply. Shown after Save and when opening a `complete` sitting from **Sessions**. Incomplete sittings (`setup` / `playing` / `scoring`) open the ordinary flow panel for that state—not **session statistics**. Edit opens score entry; it is not the default. No table-wide house-record or badge gallery in v1. Prefer charts and visual callouts over a plain score table when they clarify the sitting (e.g. score comparison, time breakdown).

- **Points** sittings: each **present player**’s score (no table-wide sum of everyone’s points), **points per minute**, **personal best** and **first play** callouts.
- **Outcomes** sittings: win/loss/draw marks and **session win**s, **play time**, **banked time**, **first play** callouts—no points totals, **points per minute**, or **personal best**.

_Avoid_: Opening `complete` sittings straight into score entry; opening incomplete sittings into **session statistics**; treating **session statistics** as a substitute for **aggregate statistics**; using **banked time** as the sitting’s total duration; showing empty points/PPM/PB rows for **outcomes** sittings; presenting Σ of competing scores as a sitting “total”; baking layout assumptions that forbid a later shareable results graphic.

### Session score

The outcome recording for a **play session**, interpreted according to its **score entry mode**.

### Score entry mode

How a **session score** is shaped for that sitting. Defaults to **points** on the scoring step. V1 modes offered in UI:

- **Points** — each **present player** has a numeric score (competitive totals).
- **Outcomes** — each **present player** is marked win, loss, or draw (no points required).

Shared / cooperative group totals are deferred for a later coop-oriented UI.

_Avoid_: A game-rules engine; forcing every game into points-only entry; a shared-score mode in the current scoring UI.

### Session win

Who won a **complete play session**, for **aggregate statistics** and winner callouts. Under **outcomes**, each **present player** marked win counts (draw is not a win). Under **points**, each **present player** tied for the highest numeric score counts as a **session win** (shared wins when tied). No separate winner field in v1. Feeds **win share**, not a pie labeled “win rate.”

_Avoid_: Inferring winners from **partial play sessions**; requiring an explicit winner mark on top of **points**; counting draws as wins; golf-style lowest-score wins in v1.

### Session deletion

Permanently removing a **play session** from the **manager store** (and its contribution to aggregates) when the record was a mistake or unwanted. No soft-archive in v1. The main abandon path for unwanted partial sittings created from **game detail**.

_Avoid_: Soft-delete/restore flows in v1.

### Points per minute

An **individual** **v1 statistics** rate for a **recorded player** at a game—not a single table-wide figure. Each person’s **points** are divided by **that person’s banked time** from a **manager-linked timer** export (time they spent on their own turns), so slow deliberate play can be compared with fast-and-loose play. A zero or negative score counts as **0** PPM for that sitting (no negative rates). No manual duration in v1. Until that handoff exists—or a seat with a positive score lacks usable **banked time** (> 0 after banking any open turn at **game end**)—PPM simply does not appear for that person. Sitting **play time** (wall-clock) may still show as session context; it is never the PPM denominator.

_Avoid_: Manual duration entry in v1; inventing duration from wall-clock guesses; presenting PPM as one group metric for the whole table; using **play time** as the PPM denominator; treating summed table banked time as a substitute for per-person banked time.

### Personal best

For **points**, the highest numeric score that **recorded player** has recorded at a given game. V1 treats higher as better; lower-is-better games are out of scope. On **session statistics**, call out when this sitting sets a new **personal best** for that person at that game. A **first play** is never also called out as a **personal best**—the debut score establishes the baseline without a PB callout.

_Avoid_: Golf-style inversions in v1; picking “best” manually per sitting; a single shelf-wide best that mixes unrelated titles; treating a debut sitting as a **personal best** callout.

### First play

A **recorded player**’s first **play session** at a given game under this **account owner** (partials count, same as **play count**). On **session statistics**, call out when this sitting is that person’s **first play** at the title.

_Avoid_: Requiring `complete` before counting a first; Me-only firsts that ignore other **recorded players**; a separate badge collection product in v1.

### Aggregate statistics

The **Stats** tab’s primary content: table-wide summaries across this **account owner**’s history (all **recorded players**, all games)—**sessions recorded**, **games played**, **games in collection**, total **play time**, overall **win share**, **H-index**, and expandable per-person breakdowns. Per-title play charts live on **game detail** (**Stats** expansion), not as a long game list on this tab. Presentation is **visualization-first**: charts carry the story; dense tables are secondary (e.g. inside expandables), not the default reading experience.

**Sessions recorded** counts every **play session** (including partials). **Games played** is distinct titles with at least one **play session** (partials count). **Games in collection** is shelf size, independent of plays. **Session win** / **win share** charts use **complete play sessions** only. Total **play time** sums sitting wall-clock from usable **timer export**s (`durationMs`)—no export, no credited time. Per-person time breakdowns use that person’s **banked time**.

Expandable per-person rows (for **recorded players** with history) include: sittings played, distinct **games played**, total **banked time**, **session win** count, **win percentage**, and personal **H-index**. Not cross-game average score or **points per minute** (those stay per-game on **game detail** / **session statistics**).

V1 ships those aggregates (including table-level and per-person **H-index** with a short explainer). Deferred: period filters, location / player-count pies, score timelines, heat maps, cost-per-play, head-to-head, badge collections, and share/export of stats images (eventual goal—v1 must not paint into a corner that blocks a later shareable results or Stats graphic). With no **play sessions** yet, the tab still shows headline metrics (zeros / empty chart states) and **games in collection**; chart blocks may explain that there is no play history yet—do not replace the whole tab with a single placeholder.

_Avoid_: Making the Stats tab primarily a browsable person×game list, spreadsheet of numbers, or long per-game catalog; Me-only Insights that hide other **recorded players**; counting **partial play sessions** toward **session win**; inventing **play time** without a **timer export**; treating summed **banked time** as total **play time**; labeling **win share** pies as “win rate”; cross-game blended average score or PPM on the Stats tab; a full-tab empty state that hides **games in collection** until the first play.

### Sessions recorded

Headline count of **play sessions** under this **account owner**, including **partial play sessions**.

### Games played

Headline count of distinct games (**collection** titles) with at least one **play session**, including partials.

_Avoid_: Requiring `complete` before a title counts; conflating with **games in collection**.

### Games in collection

Headline count of items on the **collection** shelf—ownership size, not play activity.

_Avoid_: Using shelf size as a proxy for **games played**.

### Win share

How **session win** awards are distributed across **recorded players**—for the whole history or for one game (on **game detail** **Stats**). Pie slices are each person’s fraction of all **session win** credits on **complete play sessions** (shared ties each count; slices sum to the whole). **Removed player** seats contribute no slice and no credit. Distinct from a person’s **win percentage** (their **session win**s ÷ their **complete play sessions**), which appears in expandable per-person detail.

_Avoid_: Calling this “win rate” in primary UI; sizing pie slices by personal win percentage; an “Unknown” pie slice for tombstones.

### Win percentage

For one **recorded player**, **session win**s divided by that person’s **complete play sessions** (optionally scoped to one game in per-game breakdowns). Not what the **win share** pie slices represent.

_Avoid_: Using “win percentage” and “win share” interchangeably in UI copy.

### H-index

A breadth-and-depth play metric: the largest N such that there are N distinct games each with at least N **play sessions** (partials count). On **aggregate statistics**, show the **account owner**’s table-level **H-index** (games under this history) with a brief explainer. Expandable per-person detail may also show each **recorded player**’s personal **H-index** (games where that person was a **present player**, same N-of-N rule).

_Avoid_: Treating **H-index** as a win-skill rating; requiring `complete` before a sitting counts toward it; building an achievement-level / fives-dimes-centuries system around it in v1.

### Play time

Wall-clock duration of a sitting (**total game elapsed** / `durationMs` on the **timer export**). Used whenever stats speak of total time, time on a game, or session length “by all players.”

_Avoid_: Using per-person **banked time** (or the sum of banked times) as **play time**.

### Banked time

Time a **present player** spent on their own turns, from the **timer export**. Used for per-person breakdowns and as the denominator for **points per minute**.

_Avoid_: Presenting **banked time** as the sitting’s total duration.

### V1 statistics

Derived summaries over stored **play sessions**. The **Stats** surface leads with visualization-first **aggregate statistics** (table-wide only). Per-title play history lives on **game detail** (**Stats** expansion). **People** keeps person-centric history (that **recorded player**’s sittings and per-game figures)—roster + “how did Sam do?”, not a second copy of the Stats charts. **Session statistics** covers one finished sitting. Per-person-per-game figures (**play count**, **personal best**, **average score**, **points per minute**) support **People**, **game detail**, and session callouts. **Play count** counts **partial play sessions** regardless of **score entry mode**. **Personal best** and **average score** use only sittings scored with **points**; **points per minute** additionally requires per-person **banked time**. **Outcomes** contribute to **play count** and to **session win** tallies where marked, but invent no points. **Win share** charts use **session win** over **complete play sessions** only; credited **play time** requires a **timer export** wall-clock.

_Avoid_: A single shelf-wide personal best that mixes unrelated titles; inventing per-person points from **outcomes**; hiding guest history from stats because they were never pinned to the roster; head-to-head ladders and long trend dashboards as v1 Stats tab centerpiece; calling **win share** “win rate” in primary copy; duplicating the same **aggregate statistics** charts on **People**; listing every played title as a block on the **Stats** tab.

### Timer leg

The stretch of a **play session** spent in **Game Timer** as a **manager-linked timer**, begun from Game Manager after `setup` by always launching the Game Timer surface in linked mode, and finished via **game end** (which **continues to scoring** with a **timer export**). There is no Manager-side “continue to scoring without timing” once wired. Leaving the timer without **game end** keeps the sitting in `playing` as a **partial play session**—no export, no auto-advance to **scoring**. Re-opening while still `playing` resumes surviving linked timer state; if that state is gone, re-seed from **present players** as a new attempt (clean times)—never two parallel timer legs on one sitting. At most one active linked binding across all sittings; starting another requires confirmed takeover (prior sitting stays `playing` partial; prior **room** ends if it was hosting). From **scoring** (including score entry while editing a **complete** sitting), the owner may step back into the **timer leg** for that sitting; Game Manager demotes the session to `playing` and re-opens the linked timer hydrated from the attached **timer export** (roster, **banked time**, and **play time**). A later **game end** replaces that export and returns to **scoring**. After a successful **game end** handoff the prior linked binding clears so later timer-only opens are standalone until the owner re-enters from scoring or starts another sitting. Add/clear remain available as host escape hatches in **more options** (no extra linked-only hard locks). Until that handoff exists, `playing` is a placeholder interstitial with Finish game (stands in for **game end**). Once wired, there is no lasting GM playing hub—setup launches Timer directly.

### Last sync posture

Remembered **host** vs local (non-host) preference for opening a **manager-linked timer** under Game Manager. Cold start with no memory stays local until the owner hosts; afterward, new **timer leg** launches restore that last Game Manager timer posture across sittings/games. Survives **game end** (stickier than in-progress **room** refresh resume alone). When that posture is **host**, launch uses the same Game Timer **stable host suffix preference** / host-start path as standalone so the usual **room code** and **join link** keep working week to week—the same code space as standalone Game Timer on that browser, not a separate Game Manager hub id.

_Avoid_: Assuming standalone leave-cleared room persistence already provides cross-sitting host memory; treating guest-join as the usual owner launch posture; inventing a separate random room-code scheme for linked launches that breaks last week’s links.

### Launch config

Inbound data that seeds a **manager-linked timer** from a **play session**. V1 requires ordered seats of stable person id + name + color (and any minimal timer fields needed). Must remain open to later carrying per-game timer session options (hard pass, pass-order, etc.) without a breaking product story—those per-game defaults are out of scope for now.

_Avoid_: Defining launch config as “roster only forever”; resetting facilitator timer prefs on every linked launch in a way that blocks future inbound overrides.

### Manager-linked timer

A **Game Timer** sitting started from a **play session** so **present players** seed the timer roster (stable person id + name + color per seat) and **game end** can hand timing data plus the timer’s final roster—ids preserved on survivors—as the starting **present players** for scoring. The **account owner** runs it on the Game Timer project surface in linked mode (not a long-term embedded timer shell inside Game Manager); leaving `setup` launches that surface immediately; the sitting waits in `playing` until **game end** **continues to scoring**. Launch replaces any leftover local timer roster with the seeded **present players**; v1 leaves Hard pass / fullscreen / timing-strip prefs as ordinary timer preferences (future **launch config** may override per game). Linked chrome demotes add/clear/settings/**new game with same players** into **more options** because the roster is expected to arrive already configured. Standalone timer use remains auth-free and unchanged (including its usual chrome).

_Avoid_: Requiring Game Manager for ordinary timing; rewriting standalone timer chrome to match the linked kebab; matching export seats to scoring by name/order alone when ids were known; forcing the **timer leg** to be single-device; always auto-hosting or always forcing local on every **timer leg** launch; permanently replacing the Game Timer project UI with a Manager-only timer fork for the host; embedding Game Manager **persist to roster** UI inside Timer for escape-hatch adds. (Launch/return *mechanics* deferred; owner same-browser handoff is required.)

### Timer export

Compact timing artifact attached to a **play session** after **game end**, derived from the final Game Timer **snapshot** but not the live **snapshot** itself. Includes final roster (stable person ids where known, name, color as shown on the timer—session-local labels), per-player **banked time**, and sitting `durationMs` (**play time** / **total game elapsed**). Export labels seed this sitting’s scoring table; they do not by themselves rewrite **recorded player** identities.

_Avoid_: Persisting P2P / turn-runtime **snapshot** fields in the **manager store**; calling the stored artifact a **snapshot**; treating mid-timer rename as People-management identity edit.

### Game end

The manager-aware timer action that finishes a **manager-linked timer** and attaches a compact **timer export** (derived from the final **snapshot**: timing plus roster) for the awaiting **play session**—distinct from starting a **new game with same players** inside the timer. In the linked chrome it lives in the top-right **more options** menu below a separator under clear users / add user / settings / **new game with same players**, and is available to the **host** only (not **guests**). Confirmed before commit (include ending the shared **room** when hosting; omit that clause when local-only); the **host** **continues to scoring** only after the export is durably attached (retry on failure; prefer ending the **room** only after attach succeeds). **Guests** get ordinary host-ended **room** treatment when the **room** does end—not Game Manager scoring. Until the real timer is wired, Finish game on the interstitial stands in for **game end** (advances to scoring using the `setup` **present players**).

_Avoid_: Saying the owner “returns” to scoring after the timer leg; **continuing to scoring** without a durable **timer export** once wired; completing launch/**game end**/scoring handoff from a non-owner browser; **continuing to scoring** while signed out.

### Online-first

Game Manager expects connectivity for auth, **manager store**, and **catalog** access in v1—no offline sync or queued browsing.

### Manager surfaces

Primary mobile areas of Game Manager: **Collection** (shelf browse and **game detail**), **People** (**saved players**, **recorded players**, and person-centric play history), **Sessions** (**play sessions**—resume incomplete, open **session statistics** for complete; not a creation entry), and **Stats** (**aggregate statistics**), plus account/sign-in. Desktop shell remains out of scope for v1.

_Avoid_: Burying people management only inside session flows; a desktop-first dashboard layout for v1; a Sessions-page + control as the way to start sittings; making **People** a second Stats dashboard.

## Flagged ambiguities

- Per-**collection** game remembered timer session options (hard pass, pass-order, …) — future; v1 keeps ordinary Game Timer prefs on linked launch and must not foreclose inbound overrides via **launch config**.
- **Game end** vs **stable host suffix preference** — ending the linked **room** must not strand reclaim of the usual Game Timer **room code**; transport/data details deferred but product requires last week’s **join link** to keep working.
- **Manager-linked timer** launch/return transport mechanics — deferred; product boundary fixed: **account owner** same-browser handoff; **guests** are Timer-**room** only.
- Apple / Facebook sign-in — deferred until those providers are enabled.
- Share/export of **session statistics** or **aggregate statistics** graphics — deferred; keep v1 presentation share-friendly later without shipping share now.

## Example dialogue

> **Owner:** “I want to log tonight’s Wingspan.”  
> **Designer:** “Open it from **Collection** into **game detail**, then **Start new session**—that creates a **play session** in `setup`. Sessions doesn’t offer a + create path.”

> **Owner:** “Nobody’s pre-checked and Sam isn’t on the roster.”  
> **Designer:** “Pick **saved players**, add Sam as a **one-off guest** or **persist to roster**, then **Start game** once at least one **present player** is selected.”

> **Owner:** “The timer isn’t built yet.”  
> **Designer:** “`playing` is a placeholder; **Finish game** stands in for **game end**. Wired path always launches Timer; only **game end** **continues to scoring** with a **timer export**.”

> **Owner:** “Will my usual timer join link still work?”  
> **Designer:** “Yes—same Game Timer **room code** space and **stable host suffix preference**; linked chrome doesn’t invent a second hub id.”

> **Owner:** “I backed out before Save.”  
> **Designer:** “That’s a **partial play session**—resume from **Sessions** at the same step, or **session deletion** if it was a mistake.”

> **Owner:** “We just saved Wingspan—what do I see?”  
> **Designer:** “**Session statistics**: scores, **play time**, each person’s **banked time** / PPM, and **personal best** or **first play** callouts. Edit if you need to fix scores.”

> **Owner:** “Total points for the table?”  
> **Designer:** “No—each person’s score only. We don’t sum competing totals.”

> **Owner:** “I want charts, not spreadsheets.”  
> **Designer:** “**Aggregate statistics** and **session statistics** are visualization-first; tables are secondary detail.”

> **Owner:** “I tapped an unfinished session.”  
> **Designer:** “You go back into setup, playing, or scoring—**session statistics** is only for `complete`.”

> **Owner:** “Can I share tonight’s results?”  
> **Designer:** “Not in this pass—but we won’t design **session statistics** in a way that blocks a later share graphic.”

> **Owner:** “Show me our Wingspan history from the box page.”  
> **Designer:** “After you’ve played it, **game detail** opens with **Stats** expanded and **Details** collapsed. Never played: flat catalog body, no **Stats** section. The **Stats** tab stays table-wide.”
