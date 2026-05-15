# Game Timer

Multiplayer tabletop-style timer: rotating **players**, per-**round** ordering, accumulating **banked** time, synced between a **host** and **guests** inside one **room**.

## Language

### Player

Someone participating in timed turns, with name, colour, accrued time totals, and per-round breakdown as modeled in state.

### Active player

The **player** whose countdown is currently running between **turn** selections.

### Turn

A span from selecting an **active player** until the next selection switches attention (time accrues to that **player’s** totals).

### Round

Indexed segment of play with its own ordering of **players**; navigating rounds does not inherently reset accrued totals unless a “new game” action does.

### Banked time

Time accumulated by a **player**, including totals split by **round** where applicable.

### Lifetime banked time

All-**rounds** cumulative milliseconds stored on each **player**, distinct from **round-local banked time**.

### Round-local banked time

**Banked time** attributed to a single **round** via keyed per-round totals.

### Hard pass

Optional rule: skipping or removing a **player** from the current **round’s** eligibility when turns advance.

### Pass order determines round order

Optional coupling where the sequence from **hard pass** events informs who goes first next **round**.

### Snapshot

Exchangeable authoritative slice of timer state (**players**, **active player**, **round**, timings, toggles such as hard-pass flags) synced across peers.

### Guest intent

Facilitator gesture bundled with a **guest** update (player selection or hard-pass registration) so the **host** can collapse duplicate rapid sends while merging **snapshots**.

### Session phase

High-level connection posture for multiplayer control UI (idle, connecting, reconnecting, hosting, guest_connected).

### Host / Guest

Same meanings as [**Star-room P2P**](../p2p/CONTEXT.md): **host** owns authoritative timer evolution; **guests** replicate and propose updates.

### Timing strip

Compact session summary UI showing aggregate elapsed/session timing separate from round controls, anchored from the first **turn** selection once play has started.

### New game with same players

Reset that wipes timer progress while keeping roster and select session options intact.

### Keep display on

While any **player** remains on the roster, the app requests that the device avoid sleeping (long tabletop sessions).

_Avoid_: Implying a guarantee on every OS or browser—best-effort only.

## Relationships

- Exactly one **player** may be **active player** at once for turn timing.
- **Lifetime banked time** plus optional **round-local banked time** together explain everything displayed beyond the live ticking segment.
- **Guest intents** annotate wire updates when facilitators click faster than round-trip latency.
- **Rounds** own **player** order mappings; totals track both overall **banked** time and optionally per-round portions.
- **Hard pass** interacts only with intra-**round** participation unless **pass order determines round order** binds outcomes to subsequent **round** ordering.
- **Host** merges **guest** intents into authoritative **snapshot** timelines.
- **Keep display on** engages whenever the roster is non-empty so facilitators are less likely to lose the **room** mid-game.

## Example dialogue

> **Facilitator:** “Amy passed her turn entirely—did we drop her from scoring?”  
> **Designer:** “If **hard pass** is on, yes for this **round’s** eligibility; accrued **banked** time still sticks unless someone hits **new game with same players**.”

> **Dev:** “Tablet reloaded mid-round.”  
> **Maintainer:** “**Guest** reconnect should replay the latest authoritative **snapshot** so **banked time** matches **host**.”

> **Dev:** “Someone double-tapped next player while offline patches queued.”  
> **Maintainer:** “**Guest intent** metadata lets **host** dedupe the redundant selects instead of applying two competing timelines.”

## Flagged ambiguities

- “Turn order” versus “Round order”: Resolved — ordering is parameterized per **round**; **hard pass** can reshape current **round** participation and optionally seed later **round** starts.
