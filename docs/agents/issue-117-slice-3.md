## Parent

#117

## What to build

Tracer bullet **slice 3**: migrate **Movie Vote** onto the existing **star-room session core** factory with **`guestPresence: 'strict'`** (**strict guest presence**).

Movie Vote passes its **protocol adapter** and maps lifecycle callbacks into the existing facade (same public exports). **Participant id** mapping, readiness, ballots, elections, and removal timers stay in Movie Vote—not in the core.

Core **strict** mode: maintain **guest online signal** per **stable client identity**; ping-null-after-seen triggers the same **room** end path as `ended`; shared **host occupancy guard** on resume (fixing the previous skip).

Do not collapse loose and strict guest policies. Do not change election algorithms or ballot schema.

## Acceptance criteria

- [ ] Movie Vote session facade binds factory with `guestPresence: 'strict'` and Movie Vote **protocol adapter**; public API unchanged
- [ ] **Guest online signal** written on guest establish and cleared on wire-only teardown / disconnect; **host** quorum/readiness uses live counts correctly in manual or automated smoke
- [ ] Movie Vote **host** resume rejects suffix occupied by another **host** principal (**host occupancy guard**)
- [ ] Strict guest `hostPing` behavior preserved (ping loss after seen ends **room** for **guests**)
- [ ] Representative tests pass: host claim, **guest** join, reconnect; regression for unified **host reclaim**
- [ ] Game Timer behavior unchanged after this slice (no strict-mode bleed)

## Blocked by

- #140

## Ready for agents

AFK — implement after Game Timer migration merges.
