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

### Star-room shell

Cross-feature wiring for backoff-based reconnect loops; individual products supply how to establish **host**/ **guest**, notify users, and clear persistence—including shared persisted **room** artifacts when a product ends a **room** on the same user-visible teardown moments as today. Products may also define retention or automated cleanup for **rooms** that never receive a clean teardown.

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

### Stable client identity

Opaque per-browser identifier that lets a **host** treat a returning **guest** as the same collaborator after refresh or reconnect (so counts and submissions stay coherent).

The shell picks **one** persisted principal as canonical for that remapping; feature stores may mirror it for convenience, not hold a second competing browser-level id.

### Reconnect generation

Logical counter incremented when a fatal session error clears the **room**, used to invalidate in-flight retries.

### Fatal session error

An error class that terminates the **room**, clears persisted join info, and stops the session until the user starts again.

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
- A **room suffix** is drawn from the **unambiguous room alphabet** and selects the RTDB **room** document.
- A **room code**/**room suffix** selects which **host** **guest** browsers join; **join links** encode that suffix for copying.
- **App-scoped room paths** keep namespaces disjoint across products sharing the same Firebase project.
- **Stable host suffix preference** complements random suffix generation when hosts want repeatable codes until contested.
- **Stable client identity** ties reconnecting browsers to prior participation without exposing account sign-in.
- **Fatal session error** resets persistence and ends the collaboration; **non-fatal disconnect** and **transient disconnect** paths feed reconnect instead of immediate teardown.
- **Reconnect generation** must match across sleep/backoff slices or the client abandons stale attempts.
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

- “Session” vs “Room”: Resolved — persist user-facing wording as **room**; reserve **session** for implementation layers that include phase machines inside a product-specific store.
- **Host** reassignment: Resolved — never; a **room**’s **host** is fixed for that **room**’s lifetime.
- **Room** cleanup: Resolved — user-visible teardown clears shared persisted **room** artifacts; abandoned **rooms** may be purged by a product-defined time-based backstop whose clock **participant** activity refreshes—not **host**-only signals.
