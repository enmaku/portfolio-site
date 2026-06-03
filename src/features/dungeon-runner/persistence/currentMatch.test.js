import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from '../bots/randombot.js'
import {
  ACTION_TYPES,
  DUNGEON_SUBPHASES,
  MATCH_PHASES,
  applyAction,
  createInitialMatchState,
} from '../engine/kernel.js'
import { NeuralRecoveryTerminalError, createChooseNnActionWithRecovery } from '../nn/chooseWithRecovery.js'
import { NN_FAILURE_KIND } from '../nn/runtime.js'
import {
  buildDeferredDungeonOutcomeDisplayState,
  DEFAULT_MAX_HEADLESS_ACTIONS,
  resolveHeadlessCompletionStartState,
  runMaybeHeadlessMatchCompletionFromState,
} from '../ui/headlessMatchCompletionRunner.js'
import { createLivePlayActionChooser } from '../ui/livePlayActionChooser.js'
import {
  shouldDeferHeadlessForPersistedNeuralTerminal,
  shouldRunHeadlessMatchCompletion,
} from '../ui/headlessNeuralRecoveryPersistence.js'
import {
  getMatchOverEndDialogVariant,
  MATCH_OVER_END_VARIANTS,
  needsHeadlessCompletion,
} from '../ui/humanEliminationCompletionPolicy.js'
import { applySetupSnapshot } from '../setup/state.js'
import { resolveNeuralLoadGateSetupTerminal } from '../nn/matchNeuralLoadGate.js'
import { NEURAL_RECOVERY_TERMINAL } from '../nn/recovery.js'
import {
  attachNeuralRecoverySnapshotToMatch,
  surfacePersistedNeuralRecoveryTerminal,
} from '../ui/headlessNeuralRecoveryPersistence.js'
import { createNeuralRuntimeRecoveryCoordinator } from '../nn/recovery.js'
import {
  CURRENT_MATCH_SCHEMA_VERSION,
  clearCurrentMatch,
  decideResumeFlow,
  loadCurrentMatch,
  persistCurrentMatch,
} from './currentMatch.js'

const FOUR_PLAYER_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
}

function seatByRole(state, roleType) {
  return state.seats.find((seat) => seat.role.type === roleType)
}

function lethalRevealDungeonState(state, runnerSeatId) {
  return {
    ...state,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...state.turn, activeSeatId: runnerSeatId },
    bidding: { ...state.bidding, runnerSeatId, dungeonMonsters: ['dragon'] },
    dungeon: {
      ...state.dungeon,
      subphase: DUNGEON_SUBPHASES.REVEAL,
      currentMonster: null,
      remainingMonsters: ['dragon'],
      hp: 3,
      inPlayEquipmentIds: ['W_VORPAL'],
      discardedRunMonsters: [],
      polySpent: true,
      axeSpent: true,
    },
  }
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

test('persist and load current match roundtrip', () => {
  const storage = createMemoryStorage()
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-1',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: { turn: 1 },
    history: [],
  }
  persistCurrentMatch(storage, match)
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.deepEqual(loaded.match, match)
})

test('schema mismatch hard resets persisted match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, { schemaVersion: CURRENT_MATCH_SCHEMA_VERSION - 1, id: 'stale', state: {}, history: [] })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, false)
  assert.equal(loaded.errorCode, 'SCHEMA_MISMATCH')
  assert.equal(storage.getItem('dungeon-runner/current-match'), null)
})

test('invalid persisted shape hard resets current match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, { schemaVersion: CURRENT_MATCH_SCHEMA_VERSION, id: 'bad-shape' })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, false)
  assert.equal(loaded.errorCode, 'INVALID_SHAPE')
  assert.equal(storage.getItem('dungeon-runner/current-match'), null)
})

test('resume flow does not resume malformed persisted match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, { schemaVersion: CURRENT_MATCH_SCHEMA_VERSION, id: 'bad-shape' })
  assert.deepEqual(decideResumeFlow(storage), { mode: 'start-new' })
})

test('resume flow surfaces resume when persisted match exists', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-1',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {},
    history: [],
  })
  assert.deepEqual(decideResumeFlow(storage), { mode: 'resume-or-start-new' })
})

test('start new clears current match before overwrite', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'old',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {},
    history: [],
  })
  clearCurrentMatch(storage)
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'new',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {},
    history: [],
  })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(loaded.match.id, 'new')
})

test('persisted current match keeps nn seat metadata', () => {
  const storage = createMemoryStorage()
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-nn',
    setup: { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    state: { nnSeatMetadata: { 'seat-2': { backend: 'cpu', modelId: 'latest', fallbackReason: null } } },
    history: [],
  }
  persistCurrentMatch(storage, match)
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.deepEqual(loaded.match.state.nnSeatMetadata['seat-2'], {
    backend: 'cpu',
    modelId: 'latest',
    fallbackReason: null,
  })
})

test('persisted match may include presentationSpeedProfile', () => {
  const storage = createMemoryStorage()
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-pace',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: { turn: 1 },
    history: [],
    presentationSpeedProfile: 'brisk',
  }
  persistCurrentMatch(storage, match)
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(loaded.match.presentationSpeedProfile, 'brisk')
})

test('persisted eliminated-before-match-over resumes headless completion to match over', async () => {
  const storage = createMemoryStorage()
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 9100 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const onLastLife = {
    ...lethalRevealDungeonState(initial, human.id),
    scoreboard: {
      ...initial.scoreboard,
      [human.id]: { ...initial.scoreboard[human.id], lives: 1, eliminated: false },
    },
    turn: { ...initial.turn, activeSeatId: human.id },
  }
  const eliminated = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  const { displayState } = buildDeferredDungeonOutcomeDisplayState(onLastLife, eliminated.state)
  assert.equal(displayState.phase, MATCH_PHASES.DUNGEON)
  assert.equal(needsHeadlessCompletion(eliminated.state, human.id), true)

  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-headless-resume',
    setup: FOUR_PLAYER_SETUP,
    state: displayState,
    history: eliminated.state.history,
  })

  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(decideResumeFlow(storage).mode, 'resume-or-start-new')

  const start = resolveHeadlessCompletionStartState(loaded.match.state, human.id)
  const completion = await runMaybeHeadlessMatchCompletionFromState(start, {
    humanPlayerSeatId: human.id,
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })

  assert.equal(completion.ran, true)
  assert.equal(completion.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(getMatchOverEndDialogVariant(completion.state, human.id), MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
})

test('invalid presentationSpeedProfile rejects persisted match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'bad-pace',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {},
    history: [],
    presentationSpeedProfile: 'fast',
  })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, false)
  assert.equal(loaded.errorCode, 'INVALID_SHAPE')
})

const NN_TWO_PLAYER_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'nn', modelId: 'latest' }],
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

test('headless infer terminal persists refresh snapshot and defers completion on reload', async () => {
  const storage = createMemoryStorage()
  const initial = createInitialMatchState(NN_TWO_PLAYER_SETUP, { seed: 9200 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedPickState(initial, human.id)
  assert.equal(needsHeadlessCompletion(start, human.id), true)

  const baseMatch = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-headless-nn-refresh',
    setup: NN_TWO_PLAYER_SETUP,
    state: start,
    history: start.history,
  }
  persistCurrentMatch(storage, baseMatch)

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

  await assert.rejects(
    () => runMaybeHeadlessMatchCompletionFromState(start, {
      humanPlayerSeatId: human.id,
      chooseAction,
      maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
    }),
    (error) => error instanceof NeuralRecoveryTerminalError,
  )

  const withTerminal = attachNeuralRecoverySnapshotToMatch(baseMatch, recovery)
  persistCurrentMatch(storage, withTerminal)
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(
    loaded.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )
  assert.equal(shouldDeferHeadlessForPersistedNeuralTerminal(loaded.match.neuralRecoveryByModelId), true)

  let refreshOpen = false
  const resumedRecovery = createNeuralRuntimeRecoveryCoordinator()
  assert.equal(
    surfacePersistedNeuralRecoveryTerminal({
      recovery: resumedRecovery,
      neuralRecoveryByModelId: loaded.match.neuralRecoveryByModelId,
      hasMatchSetup: true,
      openRefreshTerminal: () => {
        refreshOpen = true
      },
    }).surfaced,
    true,
  )
  assert.equal(refreshOpen, true)
  assert.equal(shouldRunHeadlessMatchCompletion(loaded.match, human.id), false)
})

test('persisted neural recovery terminal round-trips and surfaces refresh on resume', () => {
  const storage = createMemoryStorage()
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  const base = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-nn-refresh',
    setup: { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    state: { turn: { activeSeatId: 'seat-2' } },
    history: [],
  }
  persistCurrentMatch(storage, attachNeuralRecoverySnapshotToMatch(base, recovery))
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(
    loaded.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )

  const resumedRecovery = createNeuralRuntimeRecoveryCoordinator()
  let refreshOpen = false
  assert.equal(
    surfacePersistedNeuralRecoveryTerminal({
      recovery: resumedRecovery,
      neuralRecoveryByModelId: loaded.match.neuralRecoveryByModelId,
      hasMatchSetup: true,
      openRefreshTerminal: () => {
        refreshOpen = true
      },
    }).surfaced,
    true,
  )
  assert.equal(refreshOpen, true)
})

test('invalid neuralRecoveryByModelId rejects persisted match', () => {
  const storage = createMemoryStorage()
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-bad-recovery',
    setup: { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    state: {},
    history: [],
    neuralRecoveryByModelId: { latest: { terminal: 'UNKNOWN' } },
  })
  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, false)
  assert.equal(loaded.errorCode, 'INVALID_SHAPE')
})

test('neural load gate setup terminal clears persisted match while preserving setup snapshot', () => {
  const storage = createMemoryStorage()
  const setupSnapshot = {
    totalSeats: 3,
    opponents: [{ type: 'nn', modelId: 'v1.0.0' }, { type: 'randombot' }],
  }
  persistCurrentMatch(storage, {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-gate-fail',
    setup: setupSnapshot,
    state: { turn: { activeSeatId: 'seat-2' } },
    history: [],
  })
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  resolveNeuralLoadGateSetupTerminal({
    storage,
    setupSnapshot,
    clearCurrentMatch,
    applySetupSnapshot,
    setupTarget,
  })
  assert.equal(loadCurrentMatch(storage).ok, false)
  assert.deepEqual(setupTarget, setupSnapshot)
})
