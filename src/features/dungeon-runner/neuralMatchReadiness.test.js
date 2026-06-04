import assert from 'node:assert/strict'
import test from 'node:test'
import { NEURAL_RECOVERY_TERMINAL, createNeuralRuntimeRecoveryCoordinator } from './nn/recovery.js'
import { applySetupSnapshot } from './setup/state.js'
import {
  clearCurrentMatch,
  CURRENT_MATCH_SCHEMA_VERSION,
  loadCurrentMatch,
  persistCurrentMatch,
} from './persistence/currentMatch.js'
import {
  applyNeuralRecoverySetupTerminal,
  attachNeuralRecoverySnapshotToMatch,
  collectNeuralModelIdsFromSetup,
  handleNeuralRecoveryTerminalOutcome,
  runMatchNeuralLoadGate,
  shouldDeferHeadlessForPersistedNeuralTerminal,
  shouldRunHeadlessMatchCompletion,
} from './neuralMatchReadiness.js'

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

function createSetupRestoreDeps(overrides = {}) {
  const storage = overrides.storage ?? createMemoryStorage()
  const setupTarget = overrides.setupTarget ?? { totalSeats: 2, opponents: [] }
  const setupSnapshot =
    overrides.setupSnapshot ??
    ({
      totalSeats: 2,
      opponents: [{ type: 'nn', modelId: 'latest' }],
    })
  let restoreCalls = 0
  return {
    storage,
    setupTarget,
    setupSnapshot,
    restoreCalls: () => restoreCalls,
    restoreSetup: (snapshot) => {
      restoreCalls += 1
      applyNeuralRecoverySetupTerminal({
        storage,
        setupSnapshot: snapshot,
        clearCurrentMatch,
        applySetupSnapshot,
        setupTarget,
      })
    },
  }
}

test('collectNeuralModelIdsFromSetup dedupes nn model ids with latest default', () => {
  assert.deepEqual(
    collectNeuralModelIdsFromSetup({
      totalSeats: 4,
      opponents: [
        { type: 'nn', modelId: 'v1.0.0' },
        { type: 'randombot' },
        { type: 'nn' },
      ],
    }),
    ['v1.0.0', 'latest'],
  )
})

test('runMatchNeuralLoadGate succeeds when every nn model loads once', async () => {
  const loads = []
  const result = await runMatchNeuralLoadGate(
    {
      totalSeats: 3,
      opponents: [{ type: 'nn', modelId: 'v1.0.0' }, { type: 'nn', modelId: 'v0.9.0' }],
    },
    {
      loadModel(modelId) {
        loads.push(modelId)
        return Promise.resolve()
      },
    },
  )
  assert.equal(result.ok, true)
  assert.equal(result.terminal, NEURAL_RECOVERY_TERMINAL.NONE)
  assert.deepEqual(loads, ['v1.0.0', 'v0.9.0'])
})

test('runMatchNeuralLoadGate stops on first failed load with SETUP terminal', async () => {
  const loads = []
  const result = await runMatchNeuralLoadGate(
    {
      totalSeats: 3,
      opponents: [{ type: 'nn', modelId: 'missing-model' }, { type: 'nn', modelId: 'v0.9.0' }],
    },
    {
      loadModel(modelId) {
        loads.push(modelId)
        if (modelId === 'missing-model') {
          return Promise.reject(new Error('missing model'))
        }
        return Promise.resolve()
      },
    },
  )
  assert.equal(result.ok, false)
  assert.equal(result.terminal, NEURAL_RECOVERY_TERMINAL.SETUP)
  assert.equal(result.failedModelId, 'missing-model')
  assert.deepEqual(loads, ['missing-model'])
})

test('runMatchNeuralLoadGate skips load attempts when setup has no nn seats', async () => {
  let loadCalls = 0
  const result = await runMatchNeuralLoadGate(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    {
      loadModel() {
        loadCalls += 1
        return Promise.resolve()
      },
    },
  )
  assert.equal(result.ok, true)
  assert.equal(loadCalls, 0)
})

test('applyNeuralRecoverySetupTerminal clears match and restores setup snapshot', () => {
  const storage = { removed: false }
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const snapshot = {
    totalSeats: 3,
    opponents: [{ type: 'nn', modelId: 'v1.0.0' }, { type: 'randombot' }],
  }
  const result = applyNeuralRecoverySetupTerminal({
    storage,
    setupSnapshot: snapshot,
    clearCurrentMatch: (targetStorage) => {
      assert.equal(targetStorage, storage)
      targetStorage.removed = true
    },
    applySetupSnapshot: (target, nextSnapshot) => {
      assert.equal(target, setupTarget)
      assert.deepEqual(nextSnapshot, snapshot)
      target.totalSeats = nextSnapshot.totalSeats
      target.opponents.splice(0, target.opponents.length, ...nextSnapshot.opponents.map((opponent) => ({ ...opponent })))
    },
    setupTarget,
  })
  assert.equal(result.terminal, NEURAL_RECOVERY_TERMINAL.SETUP)
  assert.equal(storage.removed, true)
  assert.deepEqual(setupTarget, snapshot)
})

test('attachNeuralRecoverySnapshotToMatch omits field when no terminal is recorded', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  const match = { id: 'm-1', setup: {}, state: {}, history: [] }
  assert.deepEqual(attachNeuralRecoverySnapshotToMatch(match, recovery), match)
})

test('attachNeuralRecoverySnapshotToMatch records terminal snapshot for persistence', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  const match = { id: 'm-1', setup: {}, state: {}, history: [] }
  const next = attachNeuralRecoverySnapshotToMatch(match, recovery)
  assert.equal(next.neuralRecoveryByModelId.latest.terminal, NEURAL_RECOVERY_TERMINAL.REFRESH)
})

test('shouldRunHeadlessMatchCompletion is false when refresh terminal is persisted', () => {
  const match = {
    state: { phase: 'pick-adventurer', turn: { activeSeatId: 'seat-2' }, scoreboard: {}, seats: [] },
    neuralRecoveryByModelId: { latest: { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH } },
  }
  assert.equal(shouldRunHeadlessMatchCompletion(match, 'seat-1'), false)
})

test('shouldDeferHeadlessForPersistedNeuralTerminal is true only for REFRESH snapshots', () => {
  assert.equal(
    shouldDeferHeadlessForPersistedNeuralTerminal({
      latest: { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
    }),
    true,
  )
  assert.equal(
    shouldDeferHeadlessForPersistedNeuralTerminal({
      latest: { terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
    }),
    false,
  )
})

test('handleNeuralRecoveryTerminalOutcome returns refresh-dialog for persisted REFRESH snapshot', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  const match = {
    id: 'm-persisted-refresh',
    setup: { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    state: {},
    history: [],
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 0,
        inferAttempts: 3,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
      },
    },
  }
  const { restoreSetup, restoreCalls } = createSetupRestoreDeps()

  const result = handleNeuralRecoveryTerminalOutcome({
    kind: 'persisted-snapshot',
    recovery,
    neuralRecoveryByModelId: match.neuralRecoveryByModelId,
    hasMatchSetup: true,
    match,
    restoreSetup,
  })

  assert.equal(result.surfaced, true)
  assert.equal(result.action, 'refresh-dialog')
  assert.equal(result.match, match)
  assert.equal(restoreCalls(), 0)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
})

test('handleNeuralRecoveryTerminalOutcome restores setup for persisted SETUP snapshot', () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [] }
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'latest' }],
  }
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-persisted-setup',
    setup: setupSnapshot,
    state: {},
    history: [],
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 3,
        inferAttempts: 0,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
      },
    },
  })
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  const deps = createSetupRestoreDeps({ storage, setupTarget, setupSnapshot })

  const result = handleNeuralRecoveryTerminalOutcome({
    kind: 'persisted-snapshot',
    recovery,
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 3,
        inferAttempts: 0,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
      },
    },
    hasMatchSetup: true,
    match: { setup: setupSnapshot },
    restoreSetup: deps.restoreSetup,
  })

  assert.equal(result.surfaced, true)
  assert.equal(result.action, 'setup-restore')
  assert.equal(deps.restoreCalls(), 1)
  assert.deepEqual(setupTarget, setupSnapshot)
  assert.equal(loadCurrentMatch(storage).ok, false)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.SETUP)
})

test('handleNeuralRecoveryTerminalOutcome returns not surfaced when persisted snapshot has no terminal', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  const { restoreSetup } = createSetupRestoreDeps()

  const result = handleNeuralRecoveryTerminalOutcome({
    kind: 'persisted-snapshot',
    recovery,
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 1,
        inferAttempts: 0,
        recovering: true,
        terminal: NEURAL_RECOVERY_TERMINAL.NONE,
      },
    },
    hasMatchSetup: true,
    restoreSetup,
  })

  assert.equal(result.surfaced, false)
})

test('handleNeuralRecoveryTerminalOutcome persists match for terminal-event REFRESH', () => {
  const storage = createMemoryStorage()
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'latest' }],
  }
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-terminal-refresh',
    setup: setupSnapshot,
    state: { phase: 'pick-adventurer' },
    history: [],
  }
  persistCurrentMatch(storage, match)
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  const deps = createSetupRestoreDeps({ storage, setupSnapshot })

  const result = handleNeuralRecoveryTerminalOutcome({
    kind: 'terminal-event',
    recovery,
    terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
    hasMatchSetup: true,
    match,
    storage,
    persistCurrentMatch,
    restoreSetup: deps.restoreSetup,
  })

  assert.equal(result.surfaced, true)
  assert.equal(result.action, 'refresh-dialog')
  assert.equal(
    result.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(
    loaded.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )
})

test('handleNeuralRecoveryTerminalOutcome restores setup for terminal-event SETUP', () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'latest' }],
  }
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-terminal-setup',
    setup: setupSnapshot,
    state: {},
    history: [],
  })
  const recovery = createNeuralRuntimeRecoveryCoordinator({ loadMaxAttempts: 1 })
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  const deps = createSetupRestoreDeps({ storage, setupTarget, setupSnapshot })

  const result = handleNeuralRecoveryTerminalOutcome({
    kind: 'terminal-event',
    recovery,
    terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
    hasMatchSetup: true,
    match: { setup: setupSnapshot },
    restoreSetup: deps.restoreSetup,
  })

  assert.equal(result.surfaced, true)
  assert.equal(result.action, 'setup-restore')
  assert.equal(deps.restoreCalls(), 1)
  assert.deepEqual(setupTarget, setupSnapshot)
  assert.equal(loadCurrentMatch(storage).ok, false)
})
