# Star-room P2P

Shared multiplayer connection pattern for lightweight browser-to-browser rooms: clear **host** vs **guest** roles, deterministic recovery when links drop, and feature-specific payloads layered on top.

## Language

### Room

One shared session identified so **guest** browsers can attach to **host**.

_Avoid_: “Lobby” unless the feature explicitly distinguishes waiting areas from play.

### Host

The browser/tab that owns authoritative session lifecycle and relays state to attached **guest** connections.

### Guest

A browser/tab that joins **host**, sends updates upward, and follows **host**-issued snapshots or messages.

### Star-room shell

Cross-feature wiring for Peer errors classification, teardown, and backoff-based reconnect loops; individual products supply how to establish **host**/ **guest**, notify users, and clear persistence.

### Room code

Short alphanumeric token users exchange or paste to join the same **room**—the human-facing join secret distinct from full wire identifiers.

### Unambiguous room alphabet

Characters allowed in generated **room suffix** values: uppercase letters and digits with **I**, **O**, and **L** omitted so spoken and handwritten **room codes** stay distinct.

### Room suffix

The normalized alphanumeric tail users mean when they say **room code**; paired with an **app-scoped broker prefix** it becomes the full signaling id.

### App-scoped broker prefix

Fixed leading segment on full PeerJS ids (`dperry-gametimer-`, `dperry-movievote-`) so **rooms** from different products cannot collide on the broker.

### Join link

Canonical `/projects/…` URL carrying a `room` query parameter whose value is the **room suffix** guests paste after hosts share it.

### Hub (host peer)

Star-topology center peer that **guest** browsers dial—the same collaborator role as **host**, common wording in PeerJS-oriented discussions.

### Stable host suffix preference

Deterministic **room suffix** derived from **stable client identity** plus an app tag so returning hosts usually reclaim the same join code unless the broker reports the id unavailable.

### Stable client identity

Opaque per-browser identifier that lets a **host** treat a returning **guest** as the same collaborator after refresh or reconnect (so counts and submissions stay coherent).

### Reconnect generation

Logical counter incremented when a fatal Peer error clears the **room**, used to invalidate in-flight retries.

### Fatal peer error

An error class that terminates the **room**, clears persisted join info, and stops the session until the user starts again.

### Non-fatal peer error

Treatable interruption where **guest** reconnect logic may run while **host** remains up.

### Transient peer error

PeerJS failure bucket treated like other non-fatal signals—eligible for **star-room shell** reconnect orchestration rather than immediate session teardown.

### Wire-only teardown

Stopping live connections without discarding persisted **room** identity (narrow cleanup during reconnect orchestration).

## Relationships

- Every **guest** attaches to exactly one **host** in a running **star-room shell** pairing (star **hub**).
- A **room suffix** is drawn from the **unambiguous room alphabet**; combined with an **app-scoped broker prefix** it forms the wire **hub** id.
- A **room code**/**room suffix** selects which **host** **guest** browsers join; **join links** encode that suffix for copying.
- **App-scoped broker prefixes** keep namespaces disjoint across products sharing the same broker fleet.
- **Stable host suffix preference** complements random suffix generation when hosts want repeatable codes until contested.
- **Stable client identity** ties reconnecting browsers to prior participation without exposing account sign-in.
- **Fatal peer error** resets persistence and ends the collaboration; **non-fatal peer error** and **transient peer error** paths feed reconnect instead of immediate teardown.
- **Reconnect generation** must match across sleep/backoff slices or the client abandons stale attempts.

## Example dialogue

> **Dev:** “Guest tab lost Wi‑Fi for five seconds.”  
> **Maintainer:** “That should be **non-fatal**: run the guest reconnect loop, **wire-only teardown**, then establish **guest** again while **host** keeps state.”  
> **Dev:** “Peer ID collided upstream.”  
> **Maintainer:** “Classify fatal — bump **reconnect generation**, clear **room** persistence, and force the user-visible session teardown.”

> **Dev:** “Guest refreshed—are they a new participant?”  
> **Maintainer:** “No—**stable client identity** maps them back; same **room code**, same logical **guest** slot.”

> **Dev:** “Users only ever copy six letters—where’s the `dperry-…` prefix?”  
> **Maintainer:** “That’s the **room suffix** humans trade; the client prepends the **app-scoped broker prefix** to reach the real **hub** id.”

## Flagged ambiguities

- “Session” vs “Room”: Resolved — persist user-facing wording as **room**; reserve **session** for implementation layers that include phase machines inside a product-specific store.
