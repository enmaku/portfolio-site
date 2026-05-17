# Dungeon Runner Contract

## Game Rules Contract (v1)

- Engine entrypoint is `createInitialMatchState(setup, { seed })`.
- Canonical action query is `getLegalActions(state, { seatId })`.
- Canonical transition is `applyAction(state, action, { seatId })`.
- Invalid actions return `{ ok: false, errorCode: 'INVALID_ACTION' }`.
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

## Determinism Contract (v1)

- Same setup + seed must produce identical initial state.
- RNG progression is monotonic and recorded per transition.
- Setup seat randomization is deterministic for a fixed seed.

## Persistence Contract (v1)

- Current match is stored as one local blob at `dungeon-runner/current-match`.
- Resume flow is `resume-or-start-new` when a valid current match exists.
- Schema mismatch must hard-reset persisted data.

## Debug Contract (v1)

- Debug mode activates only on `localhost`/`127.0.0.1` with `?debug=true`.
- Debug mode is non-persistent unless query param is present again on boot.
- Replay envelope import/export uses a versioned schema with `{ version, seed, setup, history }`.

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
