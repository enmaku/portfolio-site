# Star-room P2P

Shared multiplayer connection pattern for lightweight browser rooms: clear **host** vs **guest** roles, deterministic recovery when links drop, and feature-specific payloads layered on Firebase RTDB.

## Language

### Room

One shared session identified so **guest** browsers can attach to **host**.

_Avoid_: “Lobby” unless the feature explicitly distinguishes waiting areas from play.

### Host

The collaborator role that owns authoritative **room** lifecycle for that **room**’s lifetime; the **host** is never reassigned to another **participant**.

The **host** browser/tab writes authoritative state under the **room** path; **guest** **participants** are not coupled to whether the **host**’s browser is online at a given moment—**host**-only actions wait until that **host** **principal** acts again.

### Guest

A browser/tab that joins **host**, sends updates upward, and follows **host**-issued snapshots or messages.

With a valid **join link** and an existing **room**, attachment is immediate: the shared **room code** is the admission signal—no separate **host** approval step unless a product explicitly adds one.

### Loose guest attachment

Star-room **project** posture where **guests** may drop in and out without the **host** treating brief wire loss as **room** end—the **host** keeps broadcasting authoritative state and **guests** reattach when they can (Game Timer).

### Strict guest presence

Star-room **project** posture where the **host** must know which **guest** principals are live right now—brief loss of **host** presence or **guest** online signals can end or stall quorum-style flows (Movie Vote readiness and voting).

### Guest online signal

Under **strict guest presence**, an RTDB flag keyed by **stable client identity** showing whether that **guest** browser is connected now—the **host** uses it for live counts; the **star-room session core** maintains it, while **participant id** mapping stays in the **project**.

_Avoid_: Assuming one guest wire policy fits all star-room **projects**.

### Star-room shell

Cross-feature wiring for backoff-based reconnect loops; individual products supply how to establish **host**/ **guest**, notify users, and clear persistence—including shared persisted **room** artifacts when a product ends a **room** on the same user-visible teardown moments as today. Products may also define retention or automated cleanup for **rooms** that never receive a clean teardown.

**Presence-mode-agnostic** — one shared reconnect orchestration for all star-room **projects**; **loose guest attachment**, **strict guest presence**, and future per-**project** quorum rules live in establish/wire hooks and the **star-room session core**, not forked shell loops.

On reconnect exhaustion (**fatal session error**), the shell invokes role-specific failure hooks—**guest** recovery affordance category steers toward **Join room** / **Host room**; **host** category steers toward starting a new **room**. Same fatal outcome, different guidance category; not one neutral path for both roles. Exact **user-visible session messaging** is facade-owned.

**Host** and **guest** share one reconnect budget—same initial pause, attempt count, and backoff curve; no role-specific longer or shorter recovery window.

During **non-fatal disconnect** recovery, attempt 1 is silent after the initial pause; attempt-progress **user-visible session messaging** at **warning** severity starts at **attempt 2** onward so brief blips that recover immediately never flash UI. That pacing rule is behavioral; exact strings are not.

A superseded in-flight loop that momentarily succeeds on the wire must unwind with **wire-only teardown** only—never **leaveSession** on the **host** path, which would broadcast **room** end to **guests** while a newer recovery owns the session.

### Structured session event

Machine-facing signal from the **star-room session core** to a feature facade (`host_ended_room`, `connectivity_offline`, `host_ping_present`, `host_tab_visible`, …)—part of the behavioral contract alongside **connection posture** outcomes.

_Avoid_: Branching logic on toast strings; treating Notify copy as API.

### User-visible session messaging

Toast and banner copy a feature facade renders from **structured session events** and **star-room shell** hooks—outside the behavioral contract; wording may change without semantic regression.

_Avoid_: Locking exact strings in logic, tests, or architecture decisions.

### Star-room session core

Shared implementation-layer wiring for **room** claim, RTDB listeners, host ping, guest hello, and visibility broadcast—sitting above the **star-room shell** reconnect loops (`createStarRoomSession` in this package). Star-room **projects** inject domain messages and **user-visible session messaging**; the core emits **structured session events** only. Guest observers follow a **guest presence mode** (**loose guest attachment** vs **strict guest presence**) so wire policy is explicit, not inferred from the **project**.

### Room code

Short alphanumeric token users exchange or paste to join the same **room**—the human-facing join secret distinct from full RTDB paths.

### Unambiguous room alphabet

Characters allowed in generated **room suffix** values: uppercase letters and digits with **I**, **O**, and **L** omitted so spoken and handwritten **room codes** stay distinct.

### Room suffix

The normalized alphanumeric tail users mean when they say **room code**; it is the canonical **room** key under an app-scoped RTDB path so **join links** stay aligned with stored sessions.

### App-scoped room path

Product-specific RTDB namespace (`gameTimerRooms/`, `movieVoteRooms/`) so **rooms** from different products cannot collide.

### Join link

Canonical `/projects/…` URL carrying a `room` query parameter whose value is the **room suffix** guests paste after hosts share it.

### Hub (host)

Star-topology center for a **room**—the same collaborator role as **host**; **guest** browsers attach to the **host**’s RTDB subtree.

### Stable host suffix preference

Deterministic **room suffix** derived from **stable client identity** plus an app tag so returning hosts usually reclaim the same join code unless the **room** is already claimed.

When the preferred suffix is held by a different **host** principal, **Host room** silently tries the next candidate (saved suffix, then random)—no warning that the usual code was taken; auto-resolution beats alarming the **host** on a recoverable contest.

### Host reclaim

When the same **host** principal (**stable client identity** matches the **room**’s recorded host id) resumes an un-**ended** **room**, collaborators keep the existing **room** payload—claim does not clear stored play state. A fresh claim by a different principal still resets stale RTDB children per product rules.

### Host occupancy guard

Before a browser finishes becoming **host** (create, resume, or reconnect), it must pass a shared occupancy check—another live **host** principal still holding the suffix blocks attach with a user-visible “in use” outcome.

_Avoid_: “Resume session” in user-facing copy—say the **host** rejoined the **room** or the **room code** still works.

### Stable client identity

Opaque per-browser identifier that lets a **host** treat a returning **guest** as the same collaborator after refresh or reconnect (so counts and submissions stay coherent).

**Site-wide** — one persisted principal per browser across all star-room **projects** (Game Timer, Movie Vote); not a separate id per **project**. **Stable host suffix preference** still namespaces preferred **room codes** per app via an app tag.

The shell picks that single persisted principal as canonical for remapping; feature stores may mirror it for convenience, not hold a second competing browser-level id.

When browser storage cannot persist the id (private mode, blocked `localStorage`), the tab still gets an in-memory principal for the current session; refresh or a new tab mints a new id with no hard gate—multiplayer remains usable at the cost of weaker reconnect remapping until storage works again.

When a persisted id fails validation (malformed charset or length), the client silently mints and stores a fresh principal—no user-visible reset warning; same practical effect as a first visit with a new id.

### Reconnect generation

Logical counter incremented when a fatal session error clears the **room**, used to invalidate in-flight retries.

### Host abrupt disconnect

When the **host** browser loses connection without a deliberate leave—refresh, network blip, sleep—the **host** clears **hostPing** on the wire. This is **not** **room exit**: **guests** stay in the **room** with **connection posture** `guest_connected` and keep the last authoritative **project** state until the **host** returns or explicitly ends the **room**.

Each star-room **project** may differ in what stalls or flickers while the **host** is away (**loose guest attachment** vs **strict guest presence**); shared rule is never treating **host** absence alone as **fatal session error** for **guests**.

_Avoid_: Ending the **room** for **guests** when **hostPing** clears; forcing **guests** to `idle` on **host** refresh.

### Connection posture

Star-room transport and listener state (`idle`, `connecting`, `reconnecting`, `hosting`, `guest_connected`)—independent from any star-room **project**’s collaborative flow (Movie Vote **phase**, Game Timer **snapshot** play).

_Avoid_: **Phase** for this concept in Movie Vote contexts; **session phase** in Game Timer names the same posture.

### Fatal session error

An error class that terminates the **room**, clears persisted join info, and stops the session until the user starts again.

Includes **star-room shell** reconnect exhaustion (all backoff attempts failed): same outcome—persisted join info cleared, user must explicitly **Host room** or **Join room** again; not a soft retry that keeps a stale **join link** alive.

### Non-fatal disconnect

Treatable interruption where **guest** reconnect logic may run while **host** remains up.

### Transient disconnect

Failure bucket treated like other non-fatal signals—eligible for **star-room shell** reconnect orchestration rather than immediate session teardown.

### Monotonic authority broadcast

Every **host** authority rebroadcast carries a strictly increasing **seq**; **guests** apply a message only when its **seq** exceeds the last applied value—duplicates and out-of-order arrivals are dropped. Authority never rolls backward on the wire.

_Avoid_: Last-write-wins or regressive **snapshot** / **room** state after reconnect races.

### Guest reconnect coherence

When a **guest** refreshes or reattaches, the **host** stays authoritative—the **guest** tab never promotes local state as truth until the **host** acknowledges it on the wire. Each star-room **project** defines merge rules on **guest hello**; reconnect replays identity and mirrors the latest **host** broadcast rather than elevating the **guest** copy.

_Avoid_: **Guest** self-authorizing collaborative state after reconnect.

### Deliberate host end

The **host** explicitly ends the **room**—sets the RTDB `ended` marker and clears **hostPing**. Every still-connected **guest** receives `host_ended_room` and undergoes **room exit**. **Room**-wide, not tab-local.

### Fatal session error (tab-local)

This browser tab exhausts reconnect or hits an unrecoverable attach failure—**connection posture** → `idle`, join persistence cleared, **room exit** survival rules apply on this tab only. The RTDB **room** may remain live for other **participants** who did not fail.

_Avoid_: Treating tab-local fatal give-up as **deliberate host end** for the whole **room**.

### Room exit

**Connection posture** returning to `idle` because the user left, **deliberate host end** was received, or a **fatal session error** fired on this tab—not a **non-fatal disconnect** still in reconnect.

Each star-room **project** defines what local state survives **room exit** on the affected tab; persisted **room** join role/suffix always clears there.

**Deliberate host end** and **fatal session error** share the same tab-local **room exit** outcome but differ in **room**-wide scope—only **deliberate host end** ends the collaboration for everyone still connected.

### Wire-only teardown

Stopping live RTDB listeners and writes without discarding persisted **room** identity (narrow cleanup during reconnect orchestration).

### Path-scoped RTDB access

Clients may read and write only under known **app-scoped room paths** and the portfolio **completed match replay** archive root—not at the database root. No Firebase sign-in is required; **stable client identity** remains the in-room principal.

Star-room **projects** (Game Timer, Movie Vote) share one write-sanitization path for payloads bound for those **app-scoped room paths**; the **completed match replay** archive uses the same Firebase project but a separate write path.

_Avoid_: “Anonymous Firebase auth” when meaning this model (Firebase Auth is not used); “secured database” implying account login.

### Room suffix gate

Admission to an RTDB **room** subtree is keyed only by knowing the **room suffix**; rules do not further restrict suffix shape beyond living under the correct **app-scoped room path**.

_Avoid_: “Firebase secured the room” (suffix secrecy is the gate, not account login).

## Relationships

- The **host** role is fixed for a **room**’s lifetime—never migrated to another **participant**.
- Every **guest** attaches to exactly one **host** in a running **star-room shell** pairing (star **hub**).
- **Guests** enter using **join links**; the shared **room code** admits them without a **host** approval gate unless a product deliberately adds one.
- The **star-room session core** delegates backoff reconnect to the **star-room shell**; products pass establish/teardown hooks into both layers.
- A **room suffix** is drawn from the **unambiguous room alphabet** and selects the RTDB **room** document.
- A **room code**/**room suffix** selects which **host** **guest** browsers join; **join links** encode that suffix for copying.
- **App-scoped room paths** keep namespaces disjoint across products sharing the same Firebase project.
- **Stable host suffix preference** complements random suffix generation when hosts want repeatable codes until contested.
- **Host reclaim** preserves in-**room** authority and payloads for the same **host** principal; only an un-**ended** **room** with a matching host id qualifies—missing `hostPing` after refresh still counts as reclaim, not a contested takeover.
- **Host occupancy guard** runs on every **host** finish path in the **star-room session core**, including Movie Vote resume flows that skipped it before.
- **Stable client identity** ties reconnecting browsers to prior participation without exposing account sign-in.
- **Host abrupt disconnect** clears **hostPing** only; **guests** stay in the **room** with last **project** authority until **host** reclaim or explicit end—**loose guest attachment** and **strict guest presence** differ in quorum/stall rules, not in whether the **room** survives.
- **Loose guest attachment** and **strict guest presence** are intentional alternatives—do not unify guest `hostPing` teardown or online tracking across **projects**; future star-room **projects** may add further presence rules without changing **star-room shell** backoff/reconnect shape.
- **Connection posture** and each **project**’s collaborative flow are independent contracts—regressions in reconnect banners must not be conflated with regressions in ballots or timer **snapshots**.
- On **room exit**, persisted **room** join info always clears; facilitator **roster** (Game Timer) or personal nomination drafts and display preferences (Movie Vote) may survive per **project** rules—see those glossaries.
- **Guest reconnect coherence** is host-authoritative in every star-room **project**; only merge rules differ (Game Timer **snapshot** + **guest intent**; Movie Vote **participant id** remap + payloads).
- **Monotonic authority broadcast** applies to every star-room **project** **host**→**guest** authority channel—shared semantics, different payloads.
- **Structured session events** and **connection posture** outcomes are the contract; **user-visible session messaging** is not—logic and decisions must never depend on copy.
- **Deliberate host end** ends the **room** for all connected **guests**; **fatal session error** is tab-local—the **room** may persist for others.
- **Fatal session error** resets persistence and ends the collaboration; **non-fatal disconnect** and **transient disconnect** paths feed reconnect instead of immediate teardown.
- **Reconnect generation** must match across sleep/backoff slices or the client abandons stale attempts **silently**—no user-visible toast; a newer recovery path, user-initiated **Host room** / **Join room**, or **fatal session error** superseded the in-flight loop. If an obsolete loop briefly re-establishes the wire before noticing the mismatch, it performs **wire-only teardown**—not **leaveSession**—so a superseded **host** reconnect cannot mark the **room** **ended** for **guests**.
- **Path-scoped RTDB access** applies to all star-room **projects** and the Dungeon Runner replay archive on the shared Firebase project; see [dungeon-runner RTDB ingest access](https://github.com/enmaku/dungeon-runner/blob/main/CONTEXT.md) for maintainer read paths.

## Example dialogue

> **Dev:** “Guest tab lost Wi‑Fi for five seconds.”  
> **Maintainer:** “That should be **non-fatal**: run the guest reconnect loop, **wire-only teardown**, then establish **guest** again while **host** keeps state.”  
> **Dev:** “Room claim failed—suffix already taken.”  
> **Maintainer:** “Treat as fatal for that attempt — bump **reconnect generation**, clear **room** persistence, and force the user-visible session teardown.”

> **Dev:** “Guest refreshed—are they a new participant?”  
> **Maintainer:** “No—**stable client identity** maps them back; same **room code**, same logical **guest** slot.”

> **Dev:** “Users only ever copy six letters—where’s the RTDB path prefix?”  
> **Maintainer:** “That’s the **room suffix** humans trade; the client maps it to `gameTimerRooms/<suffix>` or the Movie Vote equivalent.”

## Flagged ambiguities

- Guest `hostPing` reaction: Resolved — **loose guest attachment** (Game Timer) vs **strict guest presence** (Movie Vote); shared session core must not collapse these into one behavior.
- “Session” vs “Room”: Resolved — persist user-facing wording as **room**; reserve **session** for implementation layers that include phase machines inside a product-specific store.
- **Host** reassignment: Resolved — never; a **room**’s **host** is fixed for that **room**’s lifetime.
- **Room** cleanup: Resolved — user-visible teardown clears shared persisted **room** artifacts; abandoned **rooms** may be purged by a product-defined time-based backstop whose clock **participant** activity refreshes—not **host**-only signals.
