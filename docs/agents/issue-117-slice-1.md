## Parent

#117

## What to build

Tracer bullet **slice 1**: consolidate shared **host room occupancy** logic in the star-room P2P package and wire both Game Timer and Movie Vote to it end-to-end.

Move host-ping freshness, `canClaimHostRoom`, `isRoomMarkedEnded`, and unified **host reclaim** (`isReclaimOwnHostRoom`) into one tested module. Movie Vote must adopt Game Timer reclaim semantics (reclaim when **stable client identity** matches and the **room** is not **ended**, without requiring a fresh `hostPing`—the old stricter ping check was a bug).

Both **projects** keep their existing session public APIs and per-**project** claim-reset path lists; only the occupancy import path changes. No session factory yet.

## Acceptance criteria

- [ ] Shared occupancy module exists in star-room P2P with unit tests (injected clock, snapshot values)—covering claim when **ended**, reclaim by same **host** principal, occupied-by-other-host, and absent ping after refresh
- [ ] Game Timer and Movie Vote host claim/resume paths use the shared module; duplicate per-**project** occupancy files removed or reduced to claim-reset constants only
- [ ] Movie Vote **host reclaim** preserves RTDB payload on same-principal refresh (parity with Game Timer tests)
- [ ] Existing host-ping and room-lifecycle tests in both **projects** still pass (updated imports only where needed)
- [ ] ADR 0006 slice-1 scope unchanged; no change to **join link** shape or **app-scoped room paths**

## Blocked by

None — can start immediately.

## Ready for agents

AFK — implement and open PR against the #117 branch.
