# Game Manager

Mobile-first portfolio **project** for managing a personal board game **collection**, a persistent **saved player** roster, **play sessions** (scores and optional timer outcomes), and **statistics**. Separate from **Game Timer**, with optional integration.

## Language

### Game Manager

The portfolio **project** for collection management, session recording, and stats—not part of **Game Timer**.

_Avoid_: “App” alone; treating Game Manager as a mode inside **Game Timer**.

### Mobile-first project shell

Game Manager’s initial **project shell**, optimized for phone use at launch.

_Avoid_: Assuming the mobile layout is the only forever surface for manager **capability**.

### Desktop project shell (future)

A later full-width **project shell** for Game Manager—better for large **collections** and **statistics** views. Out of scope for v1.

_Avoid_: Building v1 manager **capability** inside mobile-only assumptions that block a future shell swap.

### Manager capability

What Game Manager does for a signed-in user—**collection**, **saved players**, **play sessions**, **statistics**—independent of which **project shell** presents it.

_Avoid_: “Backend” or “store” in product language; coupling **capability** to one layout.

### Account owner

The signed-in user whose account holds **collection**, **saved players**, **play sessions**, and **statistics**. In v1, one **account owner** is the sole owner of all data they record.

_Avoid_: “Host” when meaning data ownership (conflicts with **Game Timer** **host** role in a **room**).

### Saved player

A persistent person on the **account owner’s** roster—display **name** and **color**, same identity fields **Game Timer** uses for roster entries (excluding live timer totals). The roster acts as a friends list, not a preset group.

_Avoid_: “Group configuration”, “preset”, “party template” for v1; conflating with live **Game Timer** **player** session state (**banked time**, etc.).

### Present players

The subset of **saved players** checked as attending when starting a **play session**—who is at the table tonight, chosen fresh each time.

_Avoid_: Saved roster implying everyone listed must play; named groups that encode attendance rules.

### One-off guest

A person added for a single **play session** only—not on the **saved player** roster unless promoted.

### Persist to roster

Optional choice when adding a person (e.g. checkbox in the add-player dialog): save them immediately as a **saved player** instead of creating a **one-off guest**. Shortcut so the **account owner** need not visit roster management for every new regular.

_Avoid_: Implying roster management is removed; every add silently persists without an explicit choice.

### Saved player management

Dedicated UI for viewing, editing, and removing **saved players** on the roster—separate from the add-player shortcut during session setup.

### Group configuration (future)

Named preset rosters or recurring table setups. Out of scope for v1—attendance varies night to night, so v1 uses **present players** selection instead.

### Recorded player

A **saved player** (or future one-off guest) who appears in **play session** history—whether **unlinked** or **linked** to an authenticated account.

_Avoid_: Reusing **Game Timer** **player** when talking about persisted manager history (timer **players** are live session seats with **banked time**).

### Unlinked recorded player

A **recorded player** with no authenticated account associated yet.

### Linked recorded player (future)

A **recorded player** whose identity has been tied to an authenticated account through **player claim**.

### Player claim (future)

Flow—e.g. QR code—where someone signs in and associates their account with an **unlinked recorded player** on another **account owner’s** device. After claim: prior **play sessions** involving that person become visible in the claimant’s account, and future sessions involving that identity are reachable from both the original **account owner** and the claimant.

_Avoid_: “Merge accounts”; implying v1 supports any of this UX.

### Play session

One board game played once in one sitting—the unit of recording for scores, optional timer outcomes, and **statistics**. A game night with three titles is three **play sessions**.

_Avoid_: “Game night” as the primary record; conflating with a **Game Timer** **room** (live sync session).

### Collection

The **account owner’s** personal library of board games they own or track—entries used when starting **play sessions**.

_Avoid_: “Library” alone (ambiguous with code); the global board game **catalog**.

### Catalog

External board game reference data—titles, box art, player counts, play time, and similar metadata. Not owned by the **account owner**; used when adding to the **collection**. **BoardGameGeek** is the primary source; integration is subject to BGG terms (non-commercial use, attribution, no use of BGG data to train AI systems).

_Avoid_: “Database” in product language; treating the catalog as the **collection** itself; calling the client app the integration (metadata is fetched server-side).

### Catalog entry

One game in the **catalog**, identified by a BoardGameGeek id, with metadata the integration provides.

### Catalog attribution

Required credit to BoardGameGeek wherever **catalog** metadata is shown—name, link back, and “Powered by BGG” branding per BGG API terms.

### Custom collection entry

A **collection** item the **account owner** creates without a **catalog** match—at minimum a display name; optional catalog link later.

_Avoid_: “Manual game”; implying custom entries are second-class for **play sessions** (they record the same way).

### Session score

Final numeric result for each **present player** at the end of a **play session**—entered manually by the **account owner**.

_Avoid_: Game-specific scoring rules or automatic score calculation in v1.

### Score entry mode

Manual choices at the end of a **play session** describing how results should be interpreted—e.g. competitive totals, cooperative shared scoring, or win/loss without points. Configured when entering scores, not baked into the **collection** item.

_Avoid_: “Scoring system”, “rules engine”; implying the app knows how each board game is scored.

### Timer leg

Optional phase of a **play session** where the **account owner** runs **Game Timer** with **present players** pre-filled, then returns to Game Manager to enter **session score**.

_Avoid_: Requiring a timer for every **play session**; treating the timer **room** as the **play session** record.

### Game end (timer export)

Explicit action in **Game Timer** when the session was launched from Game Manager—finalizes the timer **snapshot** and hands timing data back to the awaiting **play session**. Exact control placement is an implementation detail; timer-only sessions do not need this action.

_Avoid_: “Finish game” for **new game with same players** (timer reset, not export); auto-export on **room exit**.

### Manager-linked timer

A **Game Timer** session started from an in-progress **play session** in Game Manager—roster and colors come from **present players**; **game end** export returns to that **play session**.

### Statistics

Derived views over completed **play sessions**—counts, bests, rates, and averages. v1 (**mobile-first project shell**) covers a minimal set; richer analytics expected with a future **desktop project shell**.

_Avoid_: “Analytics dashboard” for v1 scope; stats that require rules beyond recorded **session score** and optional timer duration.

### v1 statistics

The initial **statistics** set on mobile: **play count**, **personal best** **session score** per game, **points per minute** when a **timer leg** supplied duration, and simple **average score** per game per player.

_Avoid_: Win rate, head-to-head, trends, group leaderboards, and cross-player comparisons in v1.

### Sign-in provider

Third-party OAuth used to establish an **account owner** session—v1 supports Google, Apple, and Facebook.

_Avoid_: “Social login” alone; implying providers beyond the three above are in v1.

### Passphrase account

An **account owner** who authenticates with a BIP39-style recovery **passphrase** instead of a **sign-in provider**—for users who will not use OAuth. The **passphrase** is the sole credential; losing it means losing access to that account’s data with no server-side recovery.

_Avoid_: “Seed phrase” in user-facing copy unless clearly explained; “password” (implies reset flow).

### Passphrase backup prompt

Strong onboarding step requiring the **account owner** to acknowledge they have written down or otherwise secured their **passphrase** before use—because it is the only key to their Game Manager data.

### Passphrase setup

Onboarding for a **passphrase account**: by default the app **generates** a new BIP39-style **passphrase** (with **passphrase backup prompt**); alternatively the user may **restore** an existing **passphrase** they already saved—to access the same data on a new device or after storage loss.

_Avoid_: Implying passphrases can be reset or recovered server-side.

### Online-first (v1)

Game Manager v1 requires network connectivity for sign-in, **catalog** search, **manager store** sync, and **manager-linked timer** coordination. No offline collection browsing or queued sync in v1.

_Avoid_: “Offline mode”, “works without internet” for v1 scope.

### Passphrase restore

Entering an existing **passphrase** to open a **passphrase account** on a device—same phrase, same **account owner** data.

### Device session (passphrase)

After a successful **passphrase account** sign-in, the credential is remembered on that device so the user is not prompted again until browser storage is cleared.

_Avoid_: “Remember me” toggle that implies optional low-security mode—the default for **passphrase account** is persistent device access.

### Manager store

Durable Game Manager data for an **account owner**—**collection**, **saved players**, **play sessions**, and materialized **statistics**—held in **Firestore**, distinct from live **Game Timer** **room** sync in **Realtime Database**.

_Avoid_: “Database” when meaning the whole Firebase project; storing manager artifacts in RTDB.

### Play session state

Rough lifecycle of a **play session**: `setup` (game and **present players** chosen), `playing` (optional **timer leg** or table time in progress), `scoring` (play winding down; **session score** not yet saved), `complete` (**session score** saved). Sessions may stop in any state—real nights get interrupted.

_Avoid_: **Phase** (reserved in other **projects** for different meanings); requiring a single uninterrupted flow.

### Partial play session

A **play session** saved without reaching `complete`—no final scores, abandoned mid-game, or forgotten score entry. Still retained with whatever data exists (game, **present players**, partial timer export, notes, etc.).

_Avoid_: Deleting or hiding incomplete records; treating partial as an error state only.

### Complete play session

A **play session** in `complete` state with **session score** saved—required for score-based **v1 statistics** (**personal best**, **average score**, **points per minute**).

_Avoid_: Implying only **complete play sessions** appear in history.

### Session deletion

Removing a **play session** from the **account owner’s** records so it no longer appears in history or **statistics**—for mistakes, cancelled nights, or records the user does not want in aggregates.

## Relationships

- Game Manager is a first-class **project** alongside **Game Timer**, **Movie Vote**, and **Dungeon Runner**.
- **Manager capability** requires authentication and is **online-first** in v1—no anonymous collection or session recording.
- **Account owner** may sign in via a **sign-in provider** (Google, Apple, Facebook) or a **passphrase account** (**passphrase setup** or **passphrase restore**).
- **Manager capability** must remain usable when a future **desktop project shell** replaces or supplements the **mobile-first project shell**.
- **Game Timer** remains a standalone **project**; Game Manager integration is optional and must not require auth for timer-only use.
- In v1, the **account owner** owns all manager data; **saved players** are the canonical roster; starting a **play session** means selecting **present players** from that roster and/or **one-off guests**, then choosing a game from the **collection**.
- Each **play session** records one game in one sitting; multiple games in an evening are multiple **play sessions**.
- **Collection** is **catalog-first** via the **BoardGameGeek** **catalog** (with **catalog attribution**); **custom collection entries** allowed when no match suffices.
- **Play session** outcomes use **session score** per **present player** with a manual **score entry mode** (competitive, cooperative, win/loss-only, etc.) chosen at entry time—not per-game rules in v1.
- A **play session** may include an optional **timer leg** via a **manager-linked timer**; otherwise scores are entered without timer data.
- **Game end** in a **manager-linked timer** exports the final **snapshot** back to the **play session**; handoff mechanics are implementation detail.
- v1 **statistics** are **session-derived basics** only; deeper **statistics** deferred to a future **desktop project shell**.
- **Manager store** (**Firestore**) holds durable manager artifacts; **Game Timer** live sync stays in **Realtime Database**; **manager-linked timer** exports from RTDB **snapshot** into the **play session** in **Firestore**.
- **Play sessions** may remain **partial**; retain all captured data regardless of **play session state**.
- **Play count** includes **partial play sessions**; score-based **v1 statistics** require saved **session score** (typically **complete play sessions**). **Session deletion** removes a record from history and aggregates.
- **One-off guests** may be promoted to **saved players** via **persist to roster** at add time or through **saved player management** later.
- **Saved player** identity (name, color, stable id) aligns with **Game Timer** roster fields so integration can reuse the same people across projects.
- v1 data and permissions must not foreclose **player claim**: a **saved player** / **recorded player** should remain a distinct identity that can later become **linked** without rewriting history.
- **Player claim** is out of scope for v1 implementation but is a committed future **capability**.

## Flagged ambiguities

- After **player claim**, whether shared **play sessions** are referenced from multiple accounts, copied, or synchronized—implementation TBD; product intent is bidirectional visibility (claimant sees backfill; either party can record future shared history).
- **Game end** control UX and handoff transport for **manager-linked timer** sessions—implementation TBD.
- Whether an **account owner** may link a **passphrase account** to a **sign-in provider** account (or vice versa)—out of scope for v1; treat as separate identities unless decided later.
- Exact **passphrase account** cryptography and Firebase Auth integration—implementation TBD; product intent is BIP39-style phrase, device persistence, no recovery without the phrase.
