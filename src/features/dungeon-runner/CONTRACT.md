# Dungeon Runner Contract

## Game Rules Contract (v1)

- Engine entrypoint is `createInitialMatchState(setup, { seed })`.
- Canonical action query is `getLegalActions(state, { seatId })`.
- Canonical transition is `applyAction(state, action, { seatId })`.
- Invalid actions return `{ ok: false, errorCode: 'INVALID_ACTION' }`.
- **Empty dungeon run:** when bidding ends or dungeon resolution finds no **monsters** left for the runner, the runner succeeds immediately (pick-adventurer or **match over** as usual). See `CONTEXT.md` (**Empty dungeon run**) for divergence from the [dungeon-runner](https://github.com/enmaku/dungeon-runner) training simulator.
- History records canonical action payload and RNG step progression metadata.

## AI Interface Contract (v1)

- AI agents read only `getLegalActions` output and submit one canonical action object.
- Engine remains authoritative on legality and rejects out-of-contract actions.
- Initial runtime AI strategy can choose from legal actions only; fallback is `PASS`.
- Seat role types are `human`, `nn`, and `randombot`.
- Model selection default is `latest`, else highest available semver.
- NN runtime returns legal canonical actions and falls back to `PASS` on model/runtime failures.
- NN runtime retries once on illegal model output before falling back to `PASS`.
- Default NN sampling mode is stochastic with deterministic code-level override support.
- `encodeActionIndex` in `nn/policyAdapter.js` is a public export for dungeon-runner replay verification (maps canonical actions to policy head indices).

## Determinism Contract (v1)

- Same setup + seed must produce identical initial state.
- RNG progression is monotonic and recorded per transition.
- Setup seat randomization is deterministic for a fixed seed.

## Persistence Contract (v1)

- Current match is stored as one local blob at `dungeon-runner/current-match`.
- Resume flow is `resume-or-start-new` when a valid current match exists.
- Schema mismatch must hard-reset persisted data.
- Completed **match over** replays uploaded to RTDB use the same envelope shape as [Replay envelope contract (v1)](#replay-envelope-contract-v1); path root `dungeonRunnerCompletedMatches/{matchId}` (see `firebase/rtdb.js`). Field definitions are not duplicated here.

## Replay envelope contract (v1)

Normative serialized form for debug export, import, and completed-match archival. Implemented by `debug/replay.js` (`exportReplayEnvelope`, `importReplayEnvelope`).

Ingest-only extensions (skip-reason table, RTDB REST paths, **raw envelope store** layout): sibling [Replay pipeline documentation](../dungeon-runner/docs/replay-pipeline.md) when present in a checkout, otherwise [dungeon-runner #10](https://github.com/enmaku/dungeon-runner/issues/10). Field list and import/export behavior here are authoritative for v1; cross-repo tracking in [dungeon-runner #9](https://github.com/enmaku/dungeon-runner/issues/9).

### Required fields

| Field | Type | Semantics |
| --- | --- | --- |
| `version` | integer | Must be exactly `1`. Export always emits integer `1`. Import rejects non-integer or other values with `INVALID_REPLAY`. |
| `seed` | integer | RNG seed for `createInitialMatchState(setup, { seed })`. |
| `setup` | object | Match setup passed to the engine (e.g. `totalSeats`, `opponents`). |
| `history` | array | Ordered turn-boundary entries (see below). May be `[]`; import accepts empty history; terminal failure (e.g. match never reaches **match over**) is deferred to the replay verifier, not import. |

### Optional fields

| Field | Type | Semantics |
| --- | --- | --- |
| `createdAt` | string | ISO-8601 timestamp; export sets on emit. Omitted by import validation when absent. |
| `presentationSpeedProfile` | `'cinematic' \| 'brisk'` | Playback pace hint. Export includes only when valid; import rejects other values when the key is present (`INVALID_REPLAY`). |

### History entries

Each element records one applied canonical action at a turn boundary:

- `action` — canonical action object (required `type` string). May include `meta` from NN runtime (e.g. `modelId`, `backend`).
- `actorSeatId` — non-empty string seat id.
- `rngStepBefore`, `rngStepAfter` — integers with `rngStepAfter > rngStepBefore` and contiguous chain across entries (`rngStepBefore` of entry *n* equals `rngStepAfter` of entry *n−1*).

Additional per-entry keys from the engine (e.g. `phaseBefore`, `phaseAfter`, `dungeonRunResult`) are preserved when present.

### Non-NN history steps

A history step is **non-NN** when `action.modelId` is absent (human or non-model seat actions). **`is_human`** is not an envelope field; it is resolved when building the dungeon-runner training dataset, not at import/export.

### Import / export behavior

- **Export** — `exportReplayEnvelope(payload)` returns `{ version: 1, createdAt, seed, setup, history }` plus optional `presentationSpeedProfile` when valid on `payload`.
- **Import** — `importReplayEnvelope(raw)` returns `{ ok: true, replay }` with `replay` referencing the input object (unknown top-level keys preserved verbatim) or `{ ok: false, errorCode }`:
  - `INVALID_REPLAY` — missing/invalid envelope, seed, setup, `history` type, or invalid `presentationSpeedProfile` when present.
  - `INVALID_REPLAY_HISTORY` — history present but fails turn-boundary rules above.

### Consumer preservation

Consumers must not strip unknown top-level keys from a successfully imported envelope; forward-compatible metadata (e.g. future appendix fields) passes through unchanged.

### Planned v2 appendix (not implemented)

Documented for future envelopes only; v1 import/export does not read or emit these:

- `humanSeatIds` — explicit human seat listing for dataset builders.
- Terminal metadata — match-over outcome fields beyond v1 history.
- `rulesHash` — fingerprint of rules/catalog version for parity checks.

## Debug Contract (v1)

- Debug mode activates only on `localhost`/`127.0.0.1` with `?debug=true`.
- Debug mode is non-persistent unless query param is present again on boot.
- Replay envelope import/export follows [Replay envelope contract (v1)](#replay-envelope-contract-v1).

## Test Gate Contract (v1)

- Gate thresholds are codified in `src/features/dungeon-runner/test-gates.js`.
- Core deterministic engine suites must pass via `node --test "src/features/dungeon-runner/**/*.test.js"`.
- Headless determinism sweep must run at least `determinismSeedCount` seeds and satisfy invariant checks.
- Golden deterministic fixture coverage is anchored by `engine/fixtures/golden-seed-4242-two-pass.json`.
- Lint gate must pass via `npm run lint`.
- Acceptance tests must validate externally observable behavior through public interfaces.
- Downstream issue implementations must define explicit acceptance tests before implementation changes.
- Required acceptance-test sections are `Behavior`, `Public Interface`, and `Determinism Evidence`.

## Secondary Reference

- The `dungeon-runner` project rules/process semantics are a secondary reference for parity checks.

## Further Notes

- **Replay pipeline documentation** (ingest extensions, **ingest manifest** skip reasons): sibling path `../dungeon-runner/docs/replay-pipeline.md` from the portfolio-site repo root; content owned by [dungeon-runner #10](https://github.com/enmaku/dungeon-runner/issues/10) until that file ships—cross-link back to this [Replay envelope contract (v1)](#replay-envelope-contract-v1) from the runbook.
- **Envelope contract coordination:** [dungeon-runner #9](https://github.com/enmaku/dungeon-runner/issues/9).
- **Reference code:** `debug/replay.js` (export/import); `firebase/rtdb.js` and `firebase/completedMatchReplayUpload.js` (completed **match over** RTDB write using `exportReplayEnvelope`).
