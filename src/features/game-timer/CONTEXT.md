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

Exchangeable authoritative slice of timer state (**players**, **active player**, **round**, timings, toggles such as hard-pass flags) kept in one **room**-level copy the **host** owns and **guests** mirror. Each **host** broadcast uses **monotonic authority broadcast** **seq**; **guests** never apply a regressive **snapshot**. Progress bars, formatted durations, and timing-strip totals are derived locally from the **snapshot** plus wall clock—not separately synced.

_Avoid_: Treating on-screen bar fill or `m:ss` labels as fields collaborators must agree on beyond the underlying **banked time** and live-turn fields in the **snapshot**.

### Guest intent

Action tag bundled with a **guest** update (turn control, hard pass, round navigation) so the **host** can classify scoped changes and apply a brief **scoped-action cooldown** after honoring one—rejecting competing scoped merges from other facilitators while non-scoped edits still land immediately.

### Guest reconnect coherence (Game Timer)

On **guest** refresh or reattach, **stable client identity** on hello maps to the same logical **guest** slot; the **host** rebroadcasts the authoritative **snapshot** timeline. The **guest** mirrors that **snapshot**—local timer state is provisional until acknowledged.

_Avoid_: Promoting local **banked time** or **active player** as truth before the next **host** broadcast.

### Session phase

High-level **connection posture** for multiplayer control UI (`idle`, `connecting`, `reconnecting`, `hosting`, `guest_connected`)—the same shell contract Movie Vote calls **connection status**; not collaborative play state (**snapshot**, **round**, **banked time**).

_Avoid_: **Phase** when you mean connectivity; Movie Vote reserves **phase** for **suggest** / **voting** / **results**.

### Host / Guest

Same role meanings as [**Star-room P2P**](../p2p/CONTEXT.md) and [**Movie Vote**](../movie-vote/CONTEXT.md): **host** owns authoritative **snapshot** evolution; **guests** mirror and propose updates inside one **room**. No **participant** seats—only **stable client identity** for reconnect and **scoped-action cooldown** on the **host** for turn-control settling.

### Timing strip

Compact session summary UI showing aggregate elapsed/session timing separate from round controls, anchored from the first **turn** selection once play has started.

### Room exit survival

After **room exit**, the **player** roster and timer session options stay; only persisted **room** join role and **room suffix** clear. Facilitators can **Host room** again without re-entering names.

_Avoid_: Wiping the roster when the wire ends unless the user explicitly resets the game.

### New game with same players

Reset that wipes timer progress while keeping roster and select session options intact. On a **manager-linked timer**, this lives in **more options** (above the separator), not as a top-bar icon—distinct from **game end**, which finishes the sitting and **continues to scoring** in Game Manager.

### Keep display on

While any **player** remains on the roster, the app requests that the device avoid sleeping (long tabletop sessions).

_Avoid_: Implying a guarantee on every OS or browser—best-effort only.

### Game end (Game Manager export)

When **Game Timer** is a **manager-linked timer**, an explicit **game end** action finalizes the **snapshot**, derives a compact **timer export** (roster with stable ids where known, per-player **banked time** including any open segment, sitting **total game elapsed**), and hands that to the awaiting **play session** in **Game Manager** (roster becomes the starting **present players** for scoring; **banked time** feeds individual **points per minute**). Confirmed before commit (note guest **room** end when hosting); the **host** **continues to scoring** only after durable attach (retry on failure; prefer ending the **room** after attach succeeds). **Host**-only—same authority gate as roster edits and **new game with same players**; **guests** do not commit the export. After successful attach, the **room** ends for everyone (deliberate host-ended posture). Timer-only use is unchanged—no export action required.

_Avoid_: Conflating with **new game with same players**; auto-export on **room exit**; treating abandon/**room exit** as **continue to scoring**; offering a path to Game Manager **scoring** without **game end** once wired; **continuing to scoring** before the **timer export** is attached; offering a linked-timer skip-without-export beside **game end** in v1; letting **guest** devices finalize the Game Manager handoff; completing Manager handoff off the **account owner**’s browser; leaving guests in a live **manager-linked timer** after **game end**; inventing a Game Manager scoring path for **guests**; framing **game end** as “returning” to scoring rather than continuing into it; persisting the live **snapshot** in Game Manager instead of a compact **timer export**.

### More options (manager-linked chrome)

Top-right kebab menu used **only** on a **manager-linked timer**, and **only for the host**. Holds secondary actions as text items: clear users, add user (ordinary Timer name/color dialog—not Manager roster UI), settings (opens the usual toggles panel—not inlined in the kebab), and **new game with same players** (same behaviors as the standalone controls), then a separator, then **game end**. Roster edits and timer resets are demoted because the table is pre-filled from Game Manager **present players**, and a prominent restart control would compete with **game end**. Eligible player-order shuffle stays on the top bar (not demoted). Bottom-bar add/clear FABs are hidden while linked; the bottom bar remains for turn controls (next turn / play-pause). **Guests** on a linked sitting keep the ordinary settings cog (no linked kebab). Standalone Game Timer keeps its usual chrome (bottom add/clear FABs, top-bar restart/shuffle, and settings cog).

_Avoid_: Applying this chrome to timer-only sessions; giving **guests** a linked kebab; adding a persistent linked-mode banner in v1; treating **game end** as peer to roster edits or **new game with same players** without separation; burying **game end** behind the settings toggles panel; inlining settings toggles into the kebab above the separator; hiding **new game with same players** entirely while linked; demoting or hiding eligible shuffle just because the sitting is linked; removing the bottom turn-control bar while linked; leaving add/clear FABs visible alongside the kebab.

### Manager-linked timer

A timer session started from an in-progress **play session** in **Game Manager**—**player** roster pre-filled from **present players** with stable person ids carried on seats; ends via **game end** export back to Game Manager (ids preserved on surviving seats; escape-hatch adds may lack ids). Runs on the Game Timer project surface in linked mode; launch replaces leftover local roster/times with the seeded table but does not wipe ordinary session-option prefs in v1 (inbound overrides via **launch config** remain possible later). Full **host**/**guest** **room** sync remains available; linked chrome and host-only **game end** layer on top. Linked binding lasts while the awaiting sitting stays `playing` without an export; **game end** clears it. Launch restores Game Manager **last sync posture** (host vs local) when one exists; otherwise starts local like a cold standalone timer. Hosting—manual or restored—must preserve **stable host suffix preference** so existing **join links** keep working, in the same Game Timer **room** namespace as standalone (not a GM-only code).

## Relationships

- Exactly one **player** may be **active player** at once for turn timing.
- **Lifetime banked time** plus optional **round-local banked time** together explain everything displayed beyond the live ticking segment.
- **Guest intents** annotate scoped **guest** updates so the **host** can settle cross-facilitator turn-control races without blocking roster or settings edits.
- What collaborators must agree on in a **room** has a single authoritative **snapshot**; each browser mirrors it locally rather than treating local timer state as competing truth.
- **Rounds** own **player** order mappings; totals track both overall **banked** time and optionally per-round portions.
- **Hard pass** interacts only with intra-**round** participation unless **pass order determines round order** binds outcomes to subsequent **round** ordering.
- **Host** merges **guest** intents into authoritative **snapshot** timelines.
- **Host** presence in a **room** is separate from the **room** itself; **host abrupt disconnect** does not end the **room** for **guests**—**connection posture** stays `guest_connected`, last **snapshot** stays authoritative, `remoteHostPresent` / `remoteHostTabVisible` may flicker informationally until **host reclaim** resumes broadcast (**loose guest attachment**).
- **Keep display on** engages whenever the roster is non-empty so facilitators are less likely to lose the **room** mid-game.
- **Manager-linked timer** sessions add **game end** export to **Game Manager** and end the **room** when that export commits; standalone timer behavior is otherwise unchanged.

## Example dialogue

> **Facilitator:** “Amy passed her turn entirely—did we drop her from scoring?”  
> **Designer:** “If **hard pass** is on, yes for this **round’s** eligibility; accrued **banked** time still sticks unless someone hits **new game with same players**.”

> **Dev:** “Tablet reloaded mid-round.”  
> **Maintainer:** “**Guest** reconnect should replay the latest authoritative **snapshot** so **banked time** matches **host**.”

> **Dev:** “Two phones tapped different players within half a second.”  
> **Maintainer:** “**Scoped-action cooldown** on the **host** honors the first turn change, rejects the second scoped merge, and rebroadcasts authoritative truth so the losing device snaps back quietly.”

## Flagged ambiguities

- “Turn order” versus “Round order”: Resolved — ordering is parameterized per **round**; **hard pass** can reshape current **round** participation and optionally seed later **round** starts.
