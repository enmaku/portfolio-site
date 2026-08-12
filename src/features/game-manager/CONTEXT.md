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

_Avoid_: Treating the shelf row itself as the only place game facts appear; starting sessions from the **Sessions** surface’s add control; requiring a successful catalog fetch before “Start new session”; nesting **game detail** as a small dialog over the shelf while the rest of the sitting is full-screen.

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

Someone included in a specific **play session**—usually drawn from **saved players**, plus any **one-off guests**. The people picker in `setup` lists **saved players** (none pre-checked) with selection controls and an add-person path (guest / **persist to roster**). At least one **present player** is required before leaving `setup` into `playing`. That `setup` list seeds the **manager-linked timer**. Once wired, leaving `setup` launches Timer immediately (no GM playing hub); until that handoff exists, the `playing` interstitial holds the table (no roster editor there). When a real **game end** export arrives, its roster (stable ids on seats that still carry them) becomes the starting **present players** for `scoring`. On the scoring step the owner may still add people or **drop out** before Save. A session cannot enter `complete` with zero **present players**.

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

A **play session** in `complete` with a chosen **score entry mode** and full **session score** for that mode. Viewing or fixing scores uses the scoring UI without leaving `complete`; Save while already complete updates the **session score** and stays `complete`.

### Play session state

Lifecycle position of a **play session**: `setup`, `playing`, `scoring`, or `complete`. The owned-game creation path is forward along that order without skipping **playing**: people pick in `setup`, always launch the **manager-linked timer** in `playing`, **game end** attaches a **timer export** and **continues to scoring**, then `complete` on Save. Entering `complete` requires a chosen **score entry mode** and a full **session score** for that mode (every **present player** scored for **points**, or marked for **outcomes**). Once `complete`, viewing or editing scores does not move the sitting back to `scoring`. Early stops remain **partial play sessions** until **session deletion**.

_Avoid_: Treating states as freely jumbleable labels; making `complete` immutable except by delete-and-recreate; marking `complete` with half-filled scores; reaching **scoring** without **game end** / **timer export** once wired; demoting `complete` to `scoring` just to show the score editor.

### Session score

The outcome recording for a **play session**, interpreted according to its **score entry mode**.

### Score entry mode

How a **session score** is shaped for that sitting. Defaults to **points** on the scoring step. V1 modes offered in UI:

- **Points** — each **present player** has a numeric score (competitive totals).
- **Outcomes** — each **present player** is marked win, loss, or draw (no points required).

Shared / cooperative group totals are deferred for a later coop-oriented UI.

_Avoid_: A game-rules engine; forcing every game into points-only entry; a shared-score mode in the current scoring UI.

### Session deletion

Permanently removing a **play session** from the **manager store** (and its contribution to aggregates) when the record was a mistake or unwanted. No soft-archive in v1. The main abandon path for unwanted partial sittings created from **game detail**.

_Avoid_: Soft-delete/restore flows in v1.

### Points per minute

An **individual** **v1 statistics** rate for a **recorded player** at a game—not a single table-wide figure. Each person’s **points** are divided by **that person’s banked time** from a **manager-linked timer** export (time they spent on their own turns), so slow deliberate play can be compared with fast-and-loose play. No manual duration in v1. Until that handoff exists—or a seat lacks usable **banked time** (> 0 after banking any open turn at **game end**)—PPM simply does not appear for that person. Sitting wall-clock **total game elapsed** may still ride along on the export as session context; it is not the PPM denominator.

_Avoid_: Manual duration entry in v1; inventing duration from wall-clock guesses; presenting PPM as one group metric for the whole table; using shared sitting `durationMs` as the PPM denominator; treating summed table banked time as a substitute for per-person banked time.

### Personal best

For **points**, the highest numeric score that person has recorded at a given game. V1 treats higher as better; lower-is-better games are out of scope.

_Avoid_: Golf-style inversions in v1; picking “best” manually per sitting.

### V1 statistics

Simple derived summaries over stored **play sessions**, primarily **per person per collection game** (how that **recorded player** did at a given title). Includes **play count** (counts **partial play sessions** regardless of **score entry mode**). **Personal best** and **average score** use only sittings scored with **points**; **points per minute** additionally requires timer-exported duration. **Outcomes** contribute to **play count** only. Personal-stats browsing lists every **recorded player** who has history under this **account owner**, whether or not they are pinned as a **saved player**.

_Avoid_: Win rate, head-to-head, trends, and group leaderboards in v1; a single shelf-wide personal best that mixes unrelated titles; inventing per-person points from **outcomes**; hiding guest history from stats because they were never pinned to the roster.

### Timer leg

The stretch of a **play session** spent in **Game Timer** as a **manager-linked timer**, begun from Game Manager after `setup` by always launching the Game Timer surface in linked mode, and finished only via **game end** (which **continues to scoring** with a **timer export**). There is no Manager-side “continue to scoring without timing” once wired. Leaving the timer without **game end** keeps the sitting in `playing` as a **partial play session**—no export, no auto-advance to **scoring**. Re-opening while still `playing` resumes surviving linked timer state; if that state is gone, re-seed from **present players** as a new attempt (clean times)—never two parallel timer legs on one sitting. At most one active linked binding across all sittings; starting another requires confirmed takeover (prior sitting stays `playing` partial; prior **room** ends if it was hosting). After **game end**, the **timer leg** is finished for that sitting—no re-entry from **scoring** in v1; the Game Timer surface’s linked binding clears so later timer-only opens are standalone. Add/clear remain available as host escape hatches in **more options** (no extra linked-only hard locks). Until that handoff exists, `playing` is a placeholder interstitial with Finish game (stands in for **game end**). Once wired, there is no lasting GM playing hub—setup launches Timer directly.

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

Compact timing artifact attached to a **play session** after **game end**, derived from the final Game Timer **snapshot** but not the live **snapshot** itself. Includes final roster (stable person ids where known, name, color as shown on the timer—session-local labels), per-player **banked time**, and sitting `durationMs` (**total game elapsed**). Export labels seed this sitting’s scoring table; they do not by themselves rewrite **recorded player** identities.

_Avoid_: Persisting P2P / turn-runtime **snapshot** fields in the **manager store**; calling the stored artifact a **snapshot**; treating mid-timer rename as People-management identity edit.

### Game end

The manager-aware timer action that finishes a **manager-linked timer** and attaches a compact **timer export** (derived from the final **snapshot**: timing plus roster) for the awaiting **play session**—distinct from starting a **new game with same players** inside the timer. In the linked chrome it lives in the top-right **more options** menu below a separator under clear users / add user / settings / **new game with same players**, and is available to the **host** only (not **guests**). Confirmed before commit (include ending the shared **room** when hosting; omit that clause when local-only); the **host** **continues to scoring** only after the export is durably attached (retry on failure; prefer ending the **room** only after attach succeeds). **Guests** get ordinary host-ended **room** treatment when the **room** does end—not Game Manager scoring. Until the real timer is wired, Finish game on the interstitial stands in for **game end** (advances to scoring using the `setup` **present players**).

_Avoid_: Saying the owner “returns” to scoring after the timer leg; reopening a **manager-linked timer** for the same sitting after **game end** in v1; **continuing to scoring** without a durable **timer export** once wired; completing launch/**game end**/scoring handoff from a non-owner browser; **continuing to scoring** while signed out.

### Online-first

Game Manager expects connectivity for auth, **manager store**, and **catalog** access in v1—no offline sync or queued browsing.

### Manager surfaces

Primary mobile areas of Game Manager: **Collection** (shelf browse and **game detail**), **People** (**saved players** and **recorded players** with history), **Sessions** (**play sessions**—resume incomplete, review complete; not a creation entry), and **Stats**, plus account/sign-in. Desktop shell remains out of scope for v1.

_Avoid_: Burying people management only inside session flows; a desktop-first dashboard layout for v1; a Sessions-page + control as the way to start sittings.

## Flagged ambiguities

- Per-**collection** game remembered timer session options (hard pass, pass-order, …) — future; v1 keeps ordinary Game Timer prefs on linked launch and must not foreclose inbound overrides via **launch config**.
- **Game end** vs **stable host suffix preference** — ending the linked **room** must not strand reclaim of the usual Game Timer **room code**; transport/data details deferred but product requires last week’s **join link** to keep working.
- **Manager-linked timer** launch/return transport mechanics — deferred; product boundary fixed: **account owner** same-browser handoff; **guests** are Timer-**room** only.
- Apple / Facebook sign-in — deferred until those providers are enabled.

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
