## Parent

#117

## What to build

Tracer bullet **slice 2**: introduce the **star-room session core** factory and migrate **Game Timer** end-to-end on **`guestPresence: 'loose'`** (**loose guest attachment**).

The factory is store-agnostic: no Pinia, Quasar, or Vue refs. Game Timer passes a **protocol adapter** and maps `onPhaseChange`, `onSuffixChange`, and structured `onSessionEvent` into the existing facade (same public exports as today).

Core owns unified **host** ceremony: claim with **host reclaim**, **host occupancy guard** on every host finish, **host abrupt disconnect** (`onDisconnect` clears presence and marks **ended**), visibility broadcast, connectivity-driven reconnect handoff to **star-room shell**, and loose guest observers (`ended`, `hostVisible`, informational `hostPing` only—no teardown on ping null).

Game Timer facade retains **snapshot** publish/apply, guest intent dedupe, and `remoteHostPresent` UI derivation. Per-**project** `claimResetPaths` configured at bind time.

## Acceptance criteria

- [ ] Session core factory exists with unit tests (fake RTDB, fake protocol adapter, fake timers) for host claim/finish/resume, **host abrupt disconnect**, occupancy rejection, and loose guest join/reconnect wire outcomes
- [ ] Game Timer session facade is a thin binder; public API unchanged; multiplayer flows work: host create, **guest** join via **room code**, host/guest reconnect, deliberate leave
- [ ] Game Timer gains **host abrupt disconnect** behavior (guests observe **ended** when **host** tab dies without leave)
- [ ] Core tests do not assert user-visible notify strings
- [ ] Blocked slice-1 occupancy module is used for claim/reclaim (no re-duplication)

## Blocked by

- #139

## Ready for agents

AFK — implement after slice 1 merges.
