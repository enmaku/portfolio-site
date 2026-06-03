import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from './bots/randombot.js'
import {
  MATCH_PHASES,
  createInitialMatchState,
  getLegalActions,
} from './engine/kernel.js'
import { createChooseNnActionWithRecovery } from './nn/chooseWithRecovery.js'
import { NN_FAILURE_KIND } from './nn/runtime.js'
import {
  NEURAL_RECOVERY_TERMINAL,
  createNeuralRuntimeRecoveryCoordinator,
} from './nn/recovery.js'
import { applySetupSnapshot } from './setup/state.js'
import {
  CURRENT_MATCH_SCHEMA_VERSION,
  clearCurrentMatch,
  loadCurrentMatch,
  persistCurrentMatch,
} from './persistence/currentMatch.js'
import {
  HEADLESS_COMPLETION_ERROR_CODES,
  createHeadlessCompletionFlightGate,
  shouldBlockLiveAiPipelineWhileHeadless,
  shouldShowFinishingMatchOverlay,
} from './ui/headlessMatchCompletionRunner.js'
import { createLivePlayActionChooser } from './ui/livePlayActionChooser.js'
import { needsHeadlessCompletion } from './ui/humanEliminationCompletionPolicy.js'
import {
  applyNeuralLoadGateSetupTerminalForPage,
  bootstrapCurrentMatchFromStorage,
  buildNewMatchEnvelope,
  runHeadlessMatchCompletionForPage,
  runMatchEntryNeuralLoadGateForPage,
} from './matchPageOrchestration.js'
import { materializeNewMatchState } from './setup/materializeNewMatchState.js'

const FOUR_PLAYER_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
}

const NN_TWO_PLAYER_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'nn', modelId: 'latest' }],
}

const MIXED_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'randombot' }, { type: 'nn', modelId: 'latest' }, { type: 'randombot' }],
}

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

function seatByRole(state, roleType) {
  return state.seats.find((seat) => seat.role.type === roleType)
}

function humanEliminatedPickState(state, humanSeatId) {
  const opponent = state.seats.find(
    (seat) => seat.id !== humanSeatId && !state.scoreboard[seat.id]?.eliminated,
  )
  assert.ok(opponent)
  return {
    ...state,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    scoreboard: {
      ...state.scoreboard,
      [humanSeatId]: {
        ...state.scoreboard[humanSeatId],
        lives: 0,
        eliminated: true,
        successes: 0,
      },
    },
    turn: { ...state.turn, activeSeatId: opponent.id, turnNumber: state.turn.turnNumber + 1 },
    pickAdventurer: {
      ...state.pickAdventurer,
      activeSeatId: opponent.id,
    },
  }
}

function buildMatchEnvelope(setup, state, overrides = {}) {
  return {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: overrides.id ?? 'm-headless-orchestration',
    setup,
    state,
    history: state.history ?? [],
    ...overrides,
  }
}

function createPageDeps(overrides = {}) {
  const storage = overrides.storage ?? createMemoryStorage()
  const recovery = overrides.recovery ?? createNeuralRuntimeRecoveryCoordinator()
  const gate = overrides.gate ?? createHeadlessCompletionFlightGate()
  const setupTarget = overrides.setupTarget ?? { totalSeats: 2, opponents: [] }
  let setupTerminalCalls = 0

  return {
    storage,
    recovery,
    gate,
    setupTarget,
    setupTerminalCalls: () => setupTerminalCalls,
    deps: {
      match: overrides.match,
      humanPlayerSeatId: overrides.humanPlayerSeatId,
      chooseAction: overrides.chooseAction,
      recovery,
      gate,
      teardown: overrides.teardown ?? (() => {}),
      storage,
      persistCurrentMatch,
      applySetupTerminal: overrides.applySetupTerminal ?? ((setupSnapshot) => {
        setupTerminalCalls += 1
        applyNeuralLoadGateSetupTerminalForPage({
          storage,
          setupSnapshot,
          clearCurrentMatch,
          applySetupSnapshot,
          setupTarget,
        })
      }),
    },
  }
}

function createMatchEntryGateDeps(overrides = {}) {
  const storage = overrides.storage ?? createMemoryStorage()
  const setupTarget = overrides.setupTarget ?? { totalSeats: 2, opponents: [] }
  const inFlightCalls = []
  const loadCalls = []

  return {
    storage,
    setupTarget,
    inFlightCalls,
    loadCalls,
    deps: {
      setupSnapshot: overrides.setupSnapshot ?? NN_TWO_PLAYER_SETUP,
      loadModel: overrides.loadModel ?? ((modelId) => {
        loadCalls.push(modelId)
        return Promise.resolve()
      }),
      setMatchNeuralLoadGateInFlight: (inFlight) => {
        inFlightCalls.push(inFlight)
      },
      releaseInFlightAfterGate: overrides.releaseInFlightAfterGate,
      storage,
      clearCurrentMatch,
      applySetupSnapshot,
      setupTarget,
    },
  }
}

test('runMatchEntryNeuralLoadGateForPage returns success when every nn model loads', async () => {
  const { deps, inFlightCalls, loadCalls } = createMatchEntryGateDeps()

  const result = await runMatchEntryNeuralLoadGateForPage(deps)
  assert.equal(result.kind, 'success')
  assert.deepEqual(loadCalls, ['latest'])
  assert.deepEqual(inFlightCalls, [true])
})

test('runMatchEntryNeuralLoadGateForPage succeeds without load attempts when setup has no nn seats', async () => {
  const { deps, inFlightCalls, loadCalls } = createMatchEntryGateDeps({
    setupSnapshot: {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
  })

  const result = await runMatchEntryNeuralLoadGateForPage(deps)
  assert.equal(result.kind, 'success')
  assert.deepEqual(loadCalls, [])
  assert.deepEqual(inFlightCalls, [true])
})

test('runMatchEntryNeuralLoadGateForPage returns setup-terminal and clears persisted match', async () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'missing-model' }],
  }
  const match = buildMatchEnvelope(setupSnapshot, createInitialMatchState(setupSnapshot, { seed: 1 }), {
    id: 'm-entry-gate-setup',
  })
  persistCurrentMatch(storage, match)
  const { deps, inFlightCalls } = createMatchEntryGateDeps({
    storage,
    setupTarget,
    setupSnapshot,
    loadModel: async () => {
      throw new Error('missing model')
    },
  })

  const result = await runMatchEntryNeuralLoadGateForPage(deps)
  assert.equal(result.kind, 'setup-terminal')
  assert.deepEqual(setupTarget, setupSnapshot)
  assert.equal(loadCurrentMatch(storage).ok, false)
  assert.deepEqual(inFlightCalls, [true])
})

test('runMatchEntryNeuralLoadGateForPage keeps in-flight until page release by default', async () => {
  const { deps, inFlightCalls } = createMatchEntryGateDeps()

  await runMatchEntryNeuralLoadGateForPage(deps)
  assert.deepEqual(inFlightCalls, [true])
})

test('runMatchEntryNeuralLoadGateForPage releases in-flight after gate when requested', async () => {
  const { deps, inFlightCalls } = createMatchEntryGateDeps({ releaseInFlightAfterGate: true })

  const result = await runMatchEntryNeuralLoadGateForPage(deps)
  assert.equal(result.kind, 'success')
  assert.deepEqual(inFlightCalls, [true, false])
})

test('applyNeuralLoadGateSetupTerminalForPage restores setup and clears persisted match', () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const setupSnapshot = NN_TWO_PLAYER_SETUP
  persistCurrentMatch(
    storage,
    buildMatchEnvelope(setupSnapshot, createInitialMatchState(setupSnapshot, { seed: 1 }), {
      id: 'm-setup-terminal-page',
    }),
  )

  applyNeuralLoadGateSetupTerminalForPage({
    storage,
    setupSnapshot,
    clearCurrentMatch,
    applySetupSnapshot,
    setupTarget,
  })

  assert.deepEqual(setupTarget, setupSnapshot)
  assert.equal(loadCurrentMatch(storage).ok, false)
})

function createBootstrapDeps(overrides = {}) {
  const storage = overrides.storage ?? createMemoryStorage()
  const setupTarget = overrides.setupTarget ?? { totalSeats: 2, opponents: [] }
  const inFlightCalls = []
  const loadCalls = []
  const recovery = overrides.recovery ?? createNeuralRuntimeRecoveryCoordinator()
  const importCalls = []
  const wrappedRecovery = {
    ...recovery,
    importSnapshot(snapshot) {
      importCalls.push(snapshot)
      return recovery.importSnapshot(snapshot)
    },
  }

  return {
    storage,
    setupTarget,
    inFlightCalls,
    loadCalls,
    importCalls,
    recovery: wrappedRecovery,
    deps: {
      storage,
      loadModel: overrides.loadModel ?? ((modelId) => {
        loadCalls.push(modelId)
        return Promise.resolve()
      }),
      setMatchNeuralLoadGateInFlight: (inFlight) => {
        inFlightCalls.push(inFlight)
      },
      clearCurrentMatch,
      applySetupSnapshot,
      setupTarget,
      cloneSetup: overrides.cloneSetup ?? ((setup) => structuredClone(setup)),
      recovery: wrappedRecovery,
    },
  }
}

test('bootstrapCurrentMatchFromStorage returns no-saved-match when storage is empty', async () => {
  const { deps } = createBootstrapDeps()

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'no-saved-match')
})

test('bootstrapCurrentMatchFromStorage returns setup-terminal when neural load gate fails', async () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'missing-model' }],
  }
  const match = buildMatchEnvelope(setupSnapshot, createInitialMatchState(setupSnapshot, { seed: 1 }), {
    id: 'm-bootstrap-gate-setup',
  })
  persistCurrentMatch(storage, match)
  const { deps, inFlightCalls, importCalls } = createBootstrapDeps({
    storage,
    setupTarget,
    loadModel: async () => {
      throw new Error('missing model')
    },
  })

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'setup-terminal')
  assert.deepEqual(setupTarget, setupSnapshot)
  assert.equal(loadCurrentMatch(storage).ok, false)
  assert.deepEqual(inFlightCalls, [true, false])
  assert.equal(importCalls.length, 0)
})

test('runMatchEntryNeuralLoadGateForPage releases in-flight on setup-terminal when requested', async () => {
  const { deps, inFlightCalls } = createMatchEntryGateDeps({
    releaseInFlightAfterGate: true,
    loadModel: async () => {
      throw new Error('missing model')
    },
  })

  const result = await runMatchEntryNeuralLoadGateForPage(deps)
  assert.equal(result.kind, 'setup-terminal')
  assert.deepEqual(inFlightCalls, [true, false])
})

test('bootstrapCurrentMatchFromStorage returns setup-terminal for persisted SETUP recovery', async () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [] }
  const setupSnapshot = NN_TWO_PLAYER_SETUP
  const initial = createInitialMatchState(setupSnapshot, { seed: 201 })
  const match = buildMatchEnvelope(setupSnapshot, initial, {
    id: 'm-bootstrap-persisted-setup',
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 3,
        inferAttempts: 0,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
      },
    },
  })
  persistCurrentMatch(storage, match)
  const { deps, importCalls } = createBootstrapDeps({ storage, setupTarget })

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'setup-terminal')
  assert.deepEqual(setupTarget, setupSnapshot)
  assert.equal(loadCurrentMatch(storage).ok, false)
  assert.equal(importCalls.length, 1)
})

test('bootstrapCurrentMatchFromStorage returns refresh-terminal for persisted REFRESH recovery', async () => {
  const storage = createMemoryStorage()
  const setupSnapshot = NN_TWO_PLAYER_SETUP
  const initial = createInitialMatchState(setupSnapshot, { seed: 202 })
  const match = buildMatchEnvelope(setupSnapshot, initial, {
    id: 'm-bootstrap-persisted-refresh',
    presentationSpeedProfile: 'brisk',
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 0,
        inferAttempts: 3,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
      },
    },
  })
  persistCurrentMatch(storage, match)
  const { deps } = createBootstrapDeps({ storage })

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'refresh-terminal')
  assert.equal(result.presentationSpeedProfile, 'brisk')
  assert.equal(result.match.id, 'm-bootstrap-persisted-refresh')
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

test('bootstrapCurrentMatchFromStorage returns resume with normalized presentation pace', async () => {
  const storage = createMemoryStorage()
  const setupSnapshot = FOUR_PLAYER_SETUP
  const initial = createInitialMatchState(setupSnapshot, { seed: 203 })
  const match = buildMatchEnvelope(setupSnapshot, initial, {
    id: 'm-bootstrap-resume',
  })
  delete match.presentationSpeedProfile
  persistCurrentMatch(storage, match)
  const { deps, loadCalls, importCalls } = createBootstrapDeps({ storage })

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'resume')
  assert.equal(result.presentationSpeedProfile, 'cinematic')
  assert.equal(result.match.id, 'm-bootstrap-resume')
  assert.equal(result.match.presentationSpeedProfile, 'cinematic')
  assert.deepEqual(loadCalls, [])
  assert.equal(importCalls.length, 0)
})

test('bootstrapCurrentMatchFromStorage returns resume preserving brisk presentation pace', async () => {
  const storage = createMemoryStorage()
  const setupSnapshot = FOUR_PLAYER_SETUP
  const initial = createInitialMatchState(setupSnapshot, { seed: 206 })
  persistCurrentMatch(
    storage,
    buildMatchEnvelope(setupSnapshot, initial, {
      id: 'm-bootstrap-resume-brisk',
      presentationSpeedProfile: 'brisk',
    }),
  )
  const { deps } = createBootstrapDeps({ storage })

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'resume')
  assert.equal(result.presentationSpeedProfile, 'brisk')
  assert.equal(result.match.presentationSpeedProfile, 'brisk')
})

test('bootstrapCurrentMatchFromStorage gate failure does not import persisted recovery', async () => {
  const storage = createMemoryStorage()
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'missing-model' }],
  }
  const initial = createInitialMatchState(setupSnapshot, { seed: 208 })
  persistCurrentMatch(
    storage,
    buildMatchEnvelope(setupSnapshot, initial, {
      neuralRecoveryByModelId: {
        latest: {
          loadAttempts: 0,
          inferAttempts: 3,
          recovering: false,
          terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
        },
      },
    }),
  )
  const { deps, importCalls } = createBootstrapDeps({
    storage,
    loadModel: async () => {
      throw new Error('missing model')
    },
  })

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'setup-terminal')
  assert.equal(importCalls.length, 0)
})

test('bootstrapCurrentMatchFromStorage runs load gate before importing persisted recovery', async () => {
  const storage = createMemoryStorage()
  const setupSnapshot = NN_TWO_PLAYER_SETUP
  const initial = createInitialMatchState(setupSnapshot, { seed: 204 })
  const match = buildMatchEnvelope(setupSnapshot, initial, {
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 0,
        inferAttempts: 3,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
      },
    },
  })
  persistCurrentMatch(storage, match)
  const order = []
  const { deps } = createBootstrapDeps({
    storage,
    loadModel: async (modelId) => {
      order.push(['load', modelId])
    },
    recovery: createNeuralRuntimeRecoveryCoordinator(),
  })
  const originalImport = deps.recovery.importSnapshot.bind(deps.recovery)
  deps.recovery.importSnapshot = (snapshot) => {
    order.push(['import', snapshot])
    return originalImport(snapshot)
  }

  await bootstrapCurrentMatchFromStorage(deps)
  assert.deepEqual(order, [['load', 'latest'], ['import', match.neuralRecoveryByModelId]])
})

test('bootstrapCurrentMatchFromStorage releases in-flight after gate before recovery', async () => {
  const storage = createMemoryStorage()
  const setupSnapshot = NN_TWO_PLAYER_SETUP
  const initial = createInitialMatchState(setupSnapshot, { seed: 205 })
  persistCurrentMatch(storage, buildMatchEnvelope(setupSnapshot, initial))
  const { deps, inFlightCalls } = createBootstrapDeps({ storage })

  const result = await bootstrapCurrentMatchFromStorage(deps)
  assert.equal(result.kind, 'resume')
  assert.deepEqual(inFlightCalls, [true, false])
})

test('runMatchEntryNeuralLoadGateForPage releases in-flight when gate throws unexpectedly', async () => {
  const inFlightCalls = []
  const deps = {
    setupSnapshot: NN_TWO_PLAYER_SETUP,
    setMatchNeuralLoadGateInFlight: (inFlight) => {
      inFlightCalls.push(inFlight)
    },
    releaseInFlightAfterGate: false,
    storage: createMemoryStorage(),
    clearCurrentMatch,
    applySetupSnapshot,
    setupTarget: { totalSeats: 2, opponents: [] },
  }

  await assert.rejects(
    () => runMatchEntryNeuralLoadGateForPage(deps),
    /loadModel required/,
  )
  assert.deepEqual(inFlightCalls, [true, false])
})

test('buildNewMatchEnvelope uses materializeNewMatchState for initial state', () => {
  const setupSnapshot = MIXED_SETUP
  const seed = 4242
  const envelope = buildNewMatchEnvelope({
    setupSnapshot,
    seed,
    id: 'match-test',
    presentationSpeedProfile: 'cinematic',
  })
  assert.equal(envelope.schemaVersion, CURRENT_MATCH_SCHEMA_VERSION)
  assert.equal(envelope.id, 'match-test')
  assert.deepEqual(envelope.setup, setupSnapshot)
  assert.deepEqual(envelope.state, materializeNewMatchState(setupSnapshot, seed))
  assert.deepEqual(envelope.history, [])
  assert.equal(envelope.presentationSpeedProfile, 'cinematic')
})

test('buildNewMatchEnvelope forwards preservedBotLabels for rematch materialization', () => {
  const setupSnapshot = MIXED_SETUP
  const seed = 3333
  const initial = materializeNewMatchState(setupSnapshot, 8080)
  const preservedBotLabels = initial.seats
    .filter((seat) => seat.role.type !== 'human' && seat.label)
    .map((seat) => seat.label)

  const envelope = buildNewMatchEnvelope({
    setupSnapshot,
    seed,
    id: 'match-rematch',
    presentationSpeedProfile: 'brisk',
    preservedBotLabels,
  })
  assert.deepEqual(
    envelope.state,
    materializeNewMatchState(setupSnapshot, seed, { preservedBotLabels }),
  )
})

test('buildNewMatchEnvelope omits preservedBotLabels when rematch has none', () => {
  const setupSnapshot = MIXED_SETUP
  const seed = 4444
  const envelope = buildNewMatchEnvelope({
    setupSnapshot,
    seed,
    id: 'match-rematch-empty-labels',
    presentationSpeedProfile: 'brisk',
    preservedBotLabels: [],
  })
  assert.deepEqual(envelope.state, materializeNewMatchState(setupSnapshot, seed))
})

test('runHeadlessMatchCompletionForPage skips when match is missing', async () => {
  const { deps } = createPageDeps({
    match: null,
    humanPlayerSeatId: 'seat-human',
    chooseAction: async () => null,
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'skipped')
  assert.equal(result.reason, 'NO_MATCH')
})

test('runHeadlessMatchCompletionForPage skips when human seat is missing', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 99 })
  const { deps } = createPageDeps({
    match: buildMatchEnvelope(FOUR_PLAYER_SETUP, initial),
    humanPlayerSeatId: null,
    chooseAction: async () => null,
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'skipped')
  assert.equal(result.reason, 'NO_HUMAN')
})

test('runHeadlessMatchCompletionForPage skips when headless is not needed', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 100 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const { deps } = createPageDeps({
    match: buildMatchEnvelope(FOUR_PLAYER_SETUP, initial),
    humanPlayerSeatId: human.id,
    chooseAction: async () => null,
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'skipped')
  assert.equal(result.reason, 'NOT_NEEDED')
})

test('runHeadlessMatchCompletionForPage skips when persisted neural recovery is REFRESH', async () => {
  const initial = createInitialMatchState(NN_TWO_PLAYER_SETUP, { seed: 101 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  assert.equal(needsHeadlessCompletion(start, human.id), true)
  const match = buildMatchEnvelope(NN_TWO_PLAYER_SETUP, start, {
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 0,
        inferAttempts: 3,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
      },
    },
  })
  const { deps } = createPageDeps({
    match,
    humanPlayerSeatId: human.id,
    chooseAction: async () => null,
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'skipped')
  assert.equal(result.reason, 'REFRESH_DEFERRED')
})

test('runHeadlessMatchCompletionForPage skips duplicate start while in flight', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 102 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  const gate = createHeadlessCompletionFlightGate()
  assert.equal(gate.tryStart(), true)
  let teardownCalls = 0
  const { deps } = createPageDeps({
    match: buildMatchEnvelope(FOUR_PLAYER_SETUP, start),
    humanPlayerSeatId: human.id,
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    gate,
    teardown: () => {
      teardownCalls += 1
    },
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'skipped')
  assert.equal(result.reason, 'IN_FLIGHT')
  assert.equal(teardownCalls, 0)
  gate.finish()
})

test('runHeadlessMatchCompletionForPage does not teardown when skipped before flight', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 1025 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  let teardownCalls = 0
  const { deps } = createPageDeps({
    match: buildMatchEnvelope(FOUR_PLAYER_SETUP, initial),
    humanPlayerSeatId: human.id,
    chooseAction: async () => null,
    teardown: () => {
      teardownCalls += 1
    },
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'skipped')
  assert.equal(result.reason, 'NOT_NEEDED')
  assert.equal(teardownCalls, 0)
})

test('runHeadlessMatchCompletionForPage teardown runs after flight start then clears gate', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 103 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  const gate = createHeadlessCompletionFlightGate()
  let sawOverlayDuringTeardown = false
  let teardownCalls = 0
  const { deps } = createPageDeps({
    match: buildMatchEnvelope(FOUR_PLAYER_SETUP, start),
    humanPlayerSeatId: human.id,
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    gate,
    teardown: () => {
      teardownCalls += 1
      assert.equal(gate.inFlight, true)
      assert.equal(shouldShowFinishingMatchOverlay(gate.inFlight), true)
      assert.equal(shouldBlockLiveAiPipelineWhileHeadless(gate.inFlight), true)
      sawOverlayDuringTeardown = true
    },
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'completed')
  assert.equal(teardownCalls, 1)
  assert.equal(sawOverlayDuringTeardown, true)
  assert.equal(gate.inFlight, false)
  assert.equal(shouldShowFinishingMatchOverlay(gate.inFlight), false)
})

test('runHeadlessMatchCompletionForPage completes and persists updated match', async () => {
  const storage = createMemoryStorage()
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 103 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  const match = buildMatchEnvelope(FOUR_PLAYER_SETUP, start, { id: 'm-headless-complete' })
  persistCurrentMatch(storage, match)
  const { deps } = createPageDeps({
    storage,
    match,
    humanPlayerSeatId: human.id,
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'completed')
  assert.equal(result.match.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal('neuralRecoveryByModelId' in result.match, false)

  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(loaded.match.id, 'm-headless-complete')
  assert.equal(loaded.match.state.phase, MATCH_PHASES.MATCH_OVER)
})

test('runHeadlessMatchCompletionForPage returns setup-terminal and clears current match', async () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }
  const initial = createInitialMatchState(NN_TWO_PLAYER_SETUP, { seed: 104 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  const match = buildMatchEnvelope(NN_TWO_PLAYER_SETUP, start, { id: 'm-headless-setup' })
  persistCurrentMatch(storage, match)
  const recovery = createNeuralRuntimeRecoveryCoordinator({ loadMaxAttempts: 1 })
  const chooseAction = createLivePlayActionChooser({
    nnRecovery: recovery,
    nnRuntimeOptions: () => ({}),
    chooseNnActionWithRecovery: createChooseNnActionWithRecovery({
      recovery,
      chooseNnAction: async () => ({ ok: false, kind: NN_FAILURE_KIND.LOAD, modelId: 'latest' }),
      resetRuntimeForModel: () => {},
    }),
  })
  const { deps, setupTerminalCalls, setupTarget: target } = createPageDeps({
    storage,
    setupTarget,
    recovery,
    match,
    humanPlayerSeatId: human.id,
    chooseAction,
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'setup-terminal')
  assert.equal(setupTerminalCalls(), 1)
  assert.deepEqual(target, NN_TWO_PLAYER_SETUP)
  assert.equal(loadCurrentMatch(storage).ok, false)
})

test('runHeadlessMatchCompletionForPage returns refresh-terminal and persists recovery snapshot', async () => {
  const storage = createMemoryStorage()
  const initial = createInitialMatchState(NN_TWO_PLAYER_SETUP, { seed: 105 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  const match = buildMatchEnvelope(NN_TWO_PLAYER_SETUP, start, { id: 'm-headless-refresh' })
  persistCurrentMatch(storage, match)
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  const chooseAction = createLivePlayActionChooser({
    nnRecovery: recovery,
    nnRuntimeOptions: () => ({}),
    chooseNnActionWithRecovery: createChooseNnActionWithRecovery({
      recovery,
      chooseNnAction: async () => ({ ok: false, kind: NN_FAILURE_KIND.INFER, modelId: 'latest' }),
      resetRuntimeForModel: () => {},
    }),
  })
  const { deps } = createPageDeps({
    storage,
    recovery,
    match,
    humanPlayerSeatId: human.id,
    chooseAction,
  })

  const result = await runHeadlessMatchCompletionForPage(deps)
  assert.equal(result.kind, 'refresh-terminal')
  assert.equal(result.match.neuralRecoveryByModelId.latest.terminal, NEURAL_RECOVERY_TERMINAL.REFRESH)
  assert.equal(result.modelId, 'latest')

  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(
    loaded.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )
})

test('runHeadlessMatchCompletionForPage returns failed when safety cap is exceeded', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 106 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  assert.equal(needsHeadlessCompletion(start, human.id), true)
  const gate = createHeadlessCompletionFlightGate()
  let teardownCalls = 0
  const chooseAction = async ({ state, seatId }) => {
    const legal = getLegalActions(state, { seatId })
    return legal[0] ?? null
  }
  const { deps } = createPageDeps({
    match: buildMatchEnvelope(FOUR_PLAYER_SETUP, start),
    humanPlayerSeatId: human.id,
    chooseAction,
    gate,
    teardown: () => {
      teardownCalls += 1
      assert.equal(gate.inFlight, true)
    },
  })

  const result = await runHeadlessMatchCompletionForPage(deps, { maxActions: 3 })
  assert.equal(result.kind, 'failed')
  assert.equal(result.errorCode, HEADLESS_COMPLETION_ERROR_CODES.SAFETY_CAP)
  assert.equal(result.actionCount, 3)
  assert.equal(teardownCalls, 1)
  assert.equal(gate.inFlight, false)
})
