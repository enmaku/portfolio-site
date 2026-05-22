## Problem Statement

Game Timer and Movie Vote each carry a large, parallel implementation of star-room wire ceremony: claim a **room**, attach to RTDB under an **app-scoped room path**, run host ping and guest hello, orchestrate reconnect through the **star-room shell**, and broadcast **host** tab visibility. Shared pieces exist (**star-room shell**, **stable client identity**, RTDB room client from #116), but a large fraction of each **project**'s session module is duplicated structural protocol. Host-ping and reclaim logic is duplicated too; Movie Vote diverged in ways that were mistakes (stricter reclaim, missing **host occupancy guard** on resume) rather than intentional product differences.

Maintainers fixing reconnect, reclaim, or crash signaling must patch two codepaths. A future third star-room **project** would likely copy another thousand-line session module.

## Solution

Introduce a **star-room session core** in the shared P2P feature: a store-agnostic factory (name TBD, e.g. `createStarRoomSession`) that owns low-level host/guest wire ceremony and delegates product behavior through injected adapters and callbacks. Game Timer and Movie Vote keep their existing public session APIs—same exports and import paths—implemented as thin facades over the core.

Delivery is two PR slices:

1. **Slice 1** — Consolidate host-ping helpers, `isRoomMarkedEnded`, and unified **host reclaim** in the P2P package; fix Movie Vote to use Game Timer reclaim semantics.
2. **Slice 2** — Introduce the session factory, wire both **projects** through **protocol adapters** and `guestPresence` mode, unify **host abrupt disconnect** and **host occupancy guard**, and shrink feature session modules to domain handling plus facade glue.

Architectural intent is recorded in [ADR 0006](https://github.com/enmaku/portfolio-site/blob/main/docs/adr/0006-star-room-session-core.md). Domain terms live in the star-room P2P glossary.

## User Stories

### Developers and maintainers

1. As a developer, I want host/guest reconnect orchestration to remain in the **star-room shell**, so that backoff and generation semantics stay one implementation across **projects**.
2. As a developer, I want host-ping, reclaim, and occupancy rules in one tested module, so that fixing a reclaim bug fixes both Game Timer and Movie Vote.
3. As a developer, I want the session core to avoid Pinia, Quasar, and Vue refs, so that I can unit-test wire behavior with fakes and clocks without mounting UI.
4. As a developer, I want per-**project** **protocol adapters** passed into the core, so that timer snapshots and vote drafts never leak across **project** boundaries.
5. As a developer, I want structured `onSessionEvent` payloads from the core, so that user-facing copy stays in facades and core tests do not assert marketing strings.
6. As a developer, I want `onPhaseChange` and `onSuffixChange` callbacks instead of shared refs, so that facades continue to own reactive connection UI state.
7. As a maintainer, I want phased PRs (host-ping slice, then factory slice), so that reviews stay tractable on the largest cross-**project** refactor.
8. As a maintainer, I want ADR 0006 to explain guest presence modes, so that a future reader does not "unify" Movie Vote quorum behavior with Game Timer broadcast behavior.
9. As a developer, I want a third star-room **project** to bind `guestPresence: 'loose' | 'strict'` explicitly, so that I do not copy another monolithic session file.
10. As a developer, I want per-**project** `claimResetPaths` configured at factory bind time, so that Movie Vote still clears `welcome` and `guestOnline` on fresh claim while Game Timer clears only its subtree children.

### Hosts

11. As a **host**, I want to claim and resume a **room** reliably after refactor, so that **room code** and **join link** behavior is unchanged.
12. As a **host**, I want **host reclaim** when I return with the same **stable client identity**, so that an un-**ended** **room** keeps its payload even if `hostPing` was missing after refresh.
13. As a **host**, I want **host abrupt disconnect** to mark the **room** **ended** when my tab crashes, so that **guests** are not stranded on a dead hub (both **projects**).
14. As a **host**, I want a **host occupancy guard** before I finish becoming **host**, so that I cannot attach over another live **host** on the same suffix (including Movie Vote resume).
15. As a **host**, I want **stable host suffix preference** and random suffix generation to behave as today, so that code discovery order and retry loops are preserved in facades.
16. As a **host**, I want tab visibility broadcast unchanged, so that **guests** still see whether the **host** tab is visible.
17. As a **host** on Game Timer, I want to keep broadcasting **snapshots** without strict quorum, so that **loose guest attachment** stays valid after extraction.
18. As a **host** on Movie Vote, I want live **guest online signal** maintained under **strict guest presence**, so that readiness and voting reflect who is actually connected.

### Guests

19. As a **guest**, I want **join links** and hello handshake unchanged, so that refactors are invisible at the UX layer.
20. As a **guest** on Game Timer, I want informational `hostPing` handling only, so that brief ping loss does not tear down my **room** while the **host** is still authoritative via `state` and `ended`.
21. As a **guest** on Movie Vote, I want ping-null-after-seen to mean the **host** ended the **room**, so that quorum flows do not count disconnected **guests** against a ghost **host**.
22. As a **guest** on Movie Vote, I want my **guest online signal** set and cleared by the core on connect/teardown, so that the **host** sees accurate live counts while **participant id** mapping stays in Movie Vote.
23. As a **guest**, I want **non-fatal disconnect** to run **star-room shell** reconnect loops, so that transient Wi‑Fi drops recover without clearing my **room** persistence.
24. As a **guest**, I want **fatal session error** paths unchanged, so that contested suffix claim still clears persistence and bumps **reconnect generation**.

### Portfolio / sharing

25. As a visitor, I want **join link** URL shape unchanged (ADR 0001), so that pasted links and static previews keep working.
26. As a **host**, I want **app-scoped room paths** to remain disjoint, so that timer state never appears under vote paths.

## Implementation Decisions

### Modules (build or modify)

| Module | Role | Slice |
|--------|------|-------|
| **Host room occupancy** (shared P2P) | `canClaimHostRoom`, `isReclaimOwnHostRoom`, `isRoomMarkedEnded`, ping freshness helpers | 1 |
| **Star-room session core factory** (shared P2P) | Claim, host finish, guest establish, visibility, connectivity, `onDisconnect`, guest observers by presence mode, delegates reconnect to **star-room shell** | 2 |
| **Protocol adapter** (per **project**) | Parse/encode domain messages; passed into factory; core never imports **project** protocol code | 2 |
| **Session facade** (per **project**) | Existing public API; binds factory; maps callbacks to Vue refs, Pinia room session store, Quasar notify copy | 2 |
| **Star-room shell** (existing) | Unchanged responsibility: backoff reconnect loops | — |
| **RTDB room client** (existing, #116) | Unchanged: **app-scoped room path**, sanitize, room refs | — |
| **Stable client identity** (existing) | Unchanged | — |

Deep modules to test in isolation: **host room occupancy** and **session core factory** (fake RTDB, fake clock, fake protocol adapter).

### Factory contract (slice 2)

**Inputs (conceptual):**

- `roomsRoot` — **app-scoped room path** prefix for the **project**
- `claimResetPaths` — RTDB child names cleared on fresh claim (not on **host reclaim**)
- `guestPresence: 'loose' | 'strict'`
- `protocolAdapter` — encode/decode hello, inbox, authority messages
- `stableHostSuffixApp` tag for **stable host suffix preference**
- Lifecycle callbacks: `onPhaseChange`, `onSuffixChange`, `onSessionEvent`, persistence clear/set hooks, `onHostInbox`, `onGuestAuthority`, host-finish hydration hook, etc.

**Core owns (unified across **projects** where applicable):**

- `tryClaimHostRoom` with unified **host reclaim**
- **Host occupancy guard** on every host finish (create, resume, reconnect)
- **Host abrupt disconnect** registration (`hostPing` removal + `ended` on tab loss)
- Shared guest listeners: `ended`, `hostVisible`; presence-mode-specific `hostPing` policy
- **Strict** mode: **guest online signal** read/write keyed by **stable client identity**; ping-null-after-seen → same teardown path as `ended`
- **Loose** mode: `hostPing` informational only (facade may expose "remote host present" for UI)
- **Wire-only teardown**, reconnect generation integration, visibility broadcast
- Delegation to **star-room shell** for guest/host reconnect loops

**Core does not own:**

- Pinia stores, Quasar, Vue refs, user-visible strings
- Timer **snapshot** / guest intent dedupe
- Movie Vote **participant id** maps, readiness, ballots, elections, removal timers
- Per-**project** Pinia bridge (#118)

### Phasing

- **Slice 1 PR:** Move occupancy helpers; unify reclaim; update both **projects** to import shared module; extend Movie Vote tests for reclaim parity; no factory yet.
- **Slice 2 PR:** Factory + facades; Game Timer gains **host abrupt disconnect**; Movie Vote gains **host occupancy guard** on resume; strict/loose guest wiring via `guestPresence`.

### Dependency

- RTDB room client factory (#116, ADR 0005) is done; this issue does not redo RTDB init/sanitize.

### Preserved behavior

- Public session API surface per **project** unchanged (import paths and export names).
- **Join link** / `room` query param unchanged (ADR 0001).
- **Reconnect generation**, **fatal session error**, **wire-only teardown** semantics unchanged.
- Dungeon Runner excluded (no star-room **room**).

## Testing Decisions

**What makes a good test:** Assert wire-level outcomes and observable connection posture—claim allowed/denied, reclaim preserves paths, `ended` set on host crash, strict guest online flags, phase transitions—not internal callback names or UI copy.

| Area | Approach | Prior art |
|------|----------|-----------|
| Host occupancy | Unit tests with injected clock and fake RTDB snapshots | Existing host-ping tests in both **projects** (move to P2P in slice 1) |
| Session core factory | Unit tests with fake RTDB, fake adapter, fake timers; table-driven `guestPresence` | `starRoomShell` tests, RTDB factory tests |
| Feature facades | One representative flow per **project**: host claim, **guest** join, reconnect; keep existing session tests where they still apply | Current `session.js` / host-ping / lifecycle tests |
| Regression | Movie Vote reclaim matches Timer; Movie Vote resume rejects occupied suffix | New cases from grill-found gaps |

Do not assert Quasar notify strings or `sessionPhase` label copy in core tests.

## Out of Scope

- Dungeon Runner (no star-room **room**; replay archive is ADR 0005 / #131).
- Changing Game Timer **snapshot** schema or Movie Vote election algorithms / ballot shape.
- Movie Vote Pinia bridge parity with Game Timer (#118).
- Collapsing **loose guest attachment** and **strict guest presence** into one guest `hostPing` policy.
- Changing **join link** routes or static share metadata.
- UI redesign of connection status copy.

## Further Notes

Ready for agents. Prefer two PRs aligned to slices above. See ADR 0006 and star-room P2P `CONTEXT.md` for vocabulary (**host reclaim**, **host occupancy guard**, **guest presence mode**, etc.).

Largest remaining naming choice: factory export name (`createStarRoomSession` vs alternative)—implementer may finalize during slice 2 without changing the architectural shape.
