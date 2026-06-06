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

On reconnect exhaustion (**fatal session error**), the shell invokes role-specific failure hooks—**guest** copy steers toward **Join room** / **Host room**; **host** copy steers toward starting a new **room**. Same fatal outcome, different recovery guidance; not one neutral message for both roles.

**Host** and **guest** share one reconnect budget—same initial pause, attempt count, and backoff curve; no role-specific longer or shorter recovery window.

During **non-fatal disconnect** recovery, attempt 1 is silent after the initial pause; **warning** attempt-progress toasts (“attempt *n* of *max*”) start at **attempt 2** onward so brief blips that recover immediately never flash UI. Wording is shared across star-room **projects**; fatal failure still uses role-specific exhaustion copy.

A superseded in-flight loop that momentarily succeeds on the wire must unwind with **wire-only teardown** only—never **leaveSession** on the **host** path, which would broadcast **room** end to **guests** while a newer recovery owns the session.

### Star-room session core

Shared implementation-layer wiring for **room** claim, RTDB listeners, host ping, guest hello, and visibility broadcast—sitting above the **star-room shell** reconnect loops (`createStarRoomSession` in this package). Star-room **projects** inject domain messages and user-visible notifications; the core does not own product state stores. Guest observers follow a **guest presence mode** (**loose guest attachment** vs **strict guest presence**) so wire policy is explicit, not inferred from the **project**.

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

When the **host** browser loses connection without a deliberate leave, the **room** should still signal closure—clearing **host** presence and marking the **room** **ended** so **guests** are not left on a dead hub.

### Fatal session error

An error class that terminates the **room**, clears persisted join info, and stops the session until the user starts again.

Includes **star-room shell** reconnect exhaustion (all backoff attempts failed): same outcome—persisted join info cleared, user must explicitly **Host room** or **Join room** again; not a soft retry that keeps a stale **join link** alive.

### Non-fatal disconnect

Treatable interruption where **guest** reconnect logic may run while **host** remains up.

### Transient disconnect

Failure bucket treated like other non-fatal signals—eligible for **star-room shell** reconnect orchestration rather than immediate session teardown.

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
- **Host abrupt disconnect** clears **hostPing** only (refresh or tab close); **guests** stay in the **room** until the **host** explicitly ends it or the RTDB **ended** marker is set via **leaveSession**.
- **Loose guest attachment** and **strict guest presence** are intentional alternatives—do not unify guest `hostPing` teardown or online tracking across **projects**; future star-room **projects** may add further presence rules without changing **star-room shell** backoff/reconnect shape.
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
