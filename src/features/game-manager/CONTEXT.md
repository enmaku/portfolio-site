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

A normalized game identity and metadata drawn from the **catalog** (keyed by BoardGameGeek id). Product display cares about title, box art, player counts, play time, and **catalog attribution**; description may appear on a detail view.

_Avoid_: Treating raw BGG XML as the product language; skipping **catalog attribution** where BGG metadata is shown; requiring weight/rank/etc. in v1 UI.

### Catalog attribution

Visible credit owed when BoardGameGeek **catalog** metadata is shown, per BGG terms.

### Collection

The **account owner**’s shelf of games they treat as owned—each item either references a **catalog entry** or is a **custom collection entry**. At most one item per **catalog entry** id; adding a game already on the shelf is a no-op / “already owned” path, not a second copy. Distinct from games merely played on **play sessions** (cafés, friends’ shelves).

_Avoid_: “Library” (ambiguous); preset **group configurations** (out of scope for v1); multiple shelf rows for the same BGG id; requiring ownership for every recorded play.

### Play session

One game, one sitting: a chosen game (**catalog entry** or **custom collection entry** reference), its **present players**, optional timing export, **session score** (when entered), and a **play session state**. The game need not already be on the **collection** shelf (board game café / someone else’s copy). Setup may offer **add to collection**, defaulting on, as a separate choice from recording the sitting. An **account owner** may keep many incomplete sessions at once and resume any of them.

_Avoid_: Multi-game nights as a single session; preset groups as the attendance model; forcing every played title onto the shelf; forcing a single in-flight session.

### Custom collection entry

A non-catalog game identity (homebrew, obscure titles) used when **catalog** search has no acceptable match. V1 requires only a title. May be played on a **play session** and/or pinned onto the **collection** shelf.

_Avoid_: Forcing every title through BGG when search fails; requiring manual player-count/time metadata in v1; assuming every custom title is owned.

### Add to collection

Optional choice while setting up a **play session** (or after playing) to pin the chosen game onto the **collection** shelf. Defaults on when the title is not already owned; may be unchecked for café / friends’-shelf plays.

_Avoid_: Silently forcing shelf membership for every recorded play.

### Saved player

A reusable roster person with a stable id, display name, and color, aligned with Game Timer player identity fields (not live **banked time**). Color is always present; if the owner doesn’t pick one, Game Manager assigns a default.

_Avoid_: “Group preset”; equating with a Firebase Auth identity (that is future **player claim**); colorless roster identities.

### Saved player management

Dedicated UI for viewing, editing, pinning, and unpinning **saved players**—separate from the add-person shortcut during session setup.

### Group configuration

Named preset rosters or recurring table setups. Out of scope for v1—attendance varies night to night, so v1 uses **present players** selection instead.

### Recorded player

A durable person identity under an **account owner**’s history (stable id + display name + color), as captured across **play sessions**. Distinct from Firebase Auth until **player claim** links them. Color is always present (defaulted when needed). Display name and color are live on the identity—edits apply when viewing past sessions too (sessions reference the person; they don’t freeze the label).

_Avoid_: Equating with a live **saved player** row only; discarding history because someone was added as a **one-off guest**; treating each night’s name string as an immutable historical artifact.

### Present player

Someone included in a specific **play session**—usually drawn from **saved players**, plus any **one-off guests**. The list may start empty in `setup` (attendance unknown) and may change through `playing` / `scoring` when people arrive late or **drop out**. A session cannot enter `complete` with zero **present players**.

_Avoid_: Requiring final attendance before the night starts; locking the roster once play begins.

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

A tombstone seat on a past **play session** after **person deletion**—marks that someone was there without retaining their former identity for stats or **player claim**.

_Avoid_: Pretending the seat never existed; keeping claimable history after the owner chose deletion.

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

A **play session** in `complete` with a chosen **score entry mode** and full **session score** for that mode.

### Play session state

Lifecycle position of a **play session**: `setup`, `playing`, `scoring`, or `complete`. Happy path is forward along that order; **playing** may be skipped for manual score entry (`setup` → `scoring`). Entering `complete` requires a chosen **score entry mode** and a full **session score** for that mode (every **present player** marked for per-player modes; **shared score** filled). A `complete` session may be reopened to `scoring` to fix mistakes. Early stops remain **partial play sessions** until **session deletion**.

_Avoid_: Treating states as freely jumbleable labels; making `complete` immutable except by delete-and-recreate; marking `complete` with half-filled scores.

### Session score

The outcome recording for a **play session**, interpreted according to its **score entry mode**.

### Score entry mode

How a **session score** is shaped for that sitting. V1 modes:

- **Per-player scores** — each **present player** has a numeric score (competitive point totals).
- **Shared score** — one numeric score for the whole group (cooperative totals).
- **Outcome marks** — each **present player** is marked win, loss, or draw (no points required).

_Avoid_: A game-rules engine; forcing every game into points-only entry.

### Session deletion

Permanently removing a **play session** from the **manager store** (and its contribution to aggregates) when the record was a mistake or unwanted. No soft-archive in v1.

_Avoid_: Soft-delete/restore flows in v1.

### Points per minute

A **v1 statistics** rate for a person at a game: their **per-player score** divided by session duration. Duration comes only from a **manager-linked timer** export; no manual duration in v1. Until that handoff exists, PPM simply does not appear.

_Avoid_: Manual duration entry in v1; inventing duration from wall-clock guesses.

### Personal best

For **per-player scores**, the highest numeric score that person has recorded at a given game. V1 treats higher as better; lower-is-better games are out of scope.

_Avoid_: Golf-style inversions in v1; picking “best” manually per sitting.

### V1 statistics

Simple derived summaries over stored **play sessions**, primarily **per person per collection game** (how that **recorded player** did at a given title). Includes **play count** (counts **partial play sessions** regardless of **score entry mode**). **Personal best** and **average score** use only sittings scored with **per-player scores**; **points per minute** additionally requires timer-exported duration. **Shared score** and **outcome marks** contribute to **play count** only. Personal-stats browsing lists every **recorded player** who has history under this **account owner**, whether or not they are pinned as a **saved player**.

_Avoid_: Win rate, head-to-head, trends, and group leaderboards in v1; a single shelf-wide personal best that mixes unrelated titles; inventing per-person points from **shared score** or **outcome marks**; hiding guest history from stats because they were never pinned to the roster.

### Timer leg

The optional stretch of a **play session** spent in **Game Timer** as a **manager-linked timer**, begun from Game Manager and finished via **game end**.

### Manager-linked timer

A **Game Timer** sitting started from a **play session** so roster identity can flow over and **game end** can return timing data. Standalone timer use remains auth-free and unchanged.

_Avoid_: Requiring Game Manager for ordinary timing. (Launch/return transport deferred.)

### Game end

The manager-aware timer action that finishes a **manager-linked timer** and exports a final **snapshot** for the awaiting **play session**—distinct from starting a **new game with same players** inside the timer.

### Online-first

Game Manager expects connectivity for auth, **manager store**, and **catalog** access in v1—no offline sync or queued browsing.

### Manager surfaces

Primary mobile areas of Game Manager: **Collection**, **People** (**saved players** and **recorded players** with history), **Sessions** (**play sessions**), and **Stats**, plus account/sign-in. Desktop shell remains out of scope for v1.

_Avoid_: Burying people management only inside session flows; a desktop-first dashboard layout for v1.

## Flagged ambiguities

- **Manager-linked timer** launch/return transport — deferred intentionally.
- Apple / Facebook sign-in — deferred until those providers are enabled.
