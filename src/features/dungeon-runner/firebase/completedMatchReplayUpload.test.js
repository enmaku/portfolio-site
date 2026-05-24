import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from '../bots/randombot.js'
import { MATCH_PHASES, createInitialMatchState } from '../engine/kernel.js'
import {
  DEFAULT_MAX_HEADLESS_ACTIONS,
  runHeadlessMatchCompletion,
} from '../ui/headlessMatchCompletionRunner.js'
import { needsHeadlessCompletion } from '../ui/humanEliminationCompletionPolicy.js'
import {
  UPLOADED_MATCH_IDS_STORAGE_KEY,
  createCompletedMatchReplayUploadTracker,
  maybeUploadCompletedMatchReplay,
} from './completedMatchReplayUpload.js'

const FOUR_PLAYER_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
}

function seatByRole(state, roleType) {
  return state.seats.find((seat) => seat.role.type === roleType)
}

function humanEliminatedBeforeMatchOver(state, humanSeatId) {
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

async function buildHeadlessCompletedFourPlayerMatch(seed) {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedBeforeMatchOver(initial, human.id)
  assert.equal(needsHeadlessCompletion(start, human.id), true)
  const result = await runHeadlessMatchCompletion(start, {
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
  return { initial, human, result }
}

/** @param {Record<string, unknown>} overrides */
function sampleMatch(overrides = {}) {
  return {
    id: 'match-test-1',
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {
      phase: MATCH_PHASES.MATCH_OVER,
      rng: { seed: 42 },
      history: [
        {
          action: { type: 'PASS' },
          actorSeatId: 'seat-1',
          rngStepBefore: 0,
          rngStepAfter: 1,
        },
      ],
    },
    history: [{ action: { type: 'IGNORED_TOP_LEVEL' } }],
    presentationSpeedProfile: 'brisk',
    ...overrides,
  }
}

function createMemoryStorage() {
  /** @type {Map<string, string>} */
  const map = new Map()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

/** @param {Partial<import('./completedMatchReplayUpload.js').CompletedMatchReplayUploadDeps>} overrides */
function createDeps(overrides = {}) {
  const storage = createMemoryStorage()
  const uploadedIds = new Set()
  /** @type {Array<{ matchId: string, envelope: unknown }>} */
  const setCalls = []
  return {
    storage,
    uploadedIds,
    setCalls,
    deps: {
      storage,
      uploadedIds,
      isConfigured: () => true,
      exportEnvelope: (payload) => ({
        version: 1,
        createdAt: '2026-05-16T00:00:00.000Z',
        seed: payload.seed,
        setup: payload.setup,
        history: payload.history ?? [],
        ...(payload.presentationSpeedProfile === 'brisk' ||
        payload.presentationSpeedProfile === 'cinematic'
          ? { presentationSpeedProfile: payload.presentationSpeedProfile }
          : {}),
      }),
      setCompletedMatch: async (matchId, envelope) => {
        setCalls.push({ matchId, envelope })
      },
      ...overrides,
    },
  }
}

test('match over uses exportReplayEnvelope for RTDB payload shape', async () => {
  const { exportReplayEnvelope } = await import('../debug/replay.js')
  const { deps, setCalls } = createDeps()
  delete deps.exportEnvelope

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)

  assert.equal(setCalls.length, 1)
  const expected = exportReplayEnvelope({
    seed: 42,
    setup: sampleMatch().setup,
    history: sampleMatch().state.history,
    presentationSpeedProfile: 'brisk',
  })
  assert.equal(setCalls[0].envelope.version, expected.version)
  assert.equal(setCalls[0].envelope.seed, expected.seed)
  assert.deepEqual(setCalls[0].envelope.setup, expected.setup)
  assert.deepEqual(setCalls[0].envelope.history, expected.history)
  assert.equal(setCalls[0].envelope.presentationSpeedProfile, expected.presentationSpeedProfile)
  assert.equal(typeof setCalls[0].envelope.createdAt, 'string')
})

test('match over uploads envelope once via setCompletedMatch', async () => {
  const { deps, setCalls } = createDeps()
  const match = sampleMatch()

  maybeUploadCompletedMatchReplay(match, deps)
  maybeUploadCompletedMatchReplay(match, deps)

  assert.equal(setCalls.length, 1)
  assert.equal(setCalls[0].matchId, 'match-test-1')
  assert.equal(setCalls[0].envelope.version, 1)
  assert.equal(setCalls[0].envelope.seed, 42)
  assert.deepEqual(setCalls[0].envelope.setup, match.setup)
  assert.deepEqual(setCalls[0].envelope.history, match.state.history)
  assert.equal(setCalls[0].envelope.presentationSpeedProfile, 'brisk')
  assert.equal('id' in setCalls[0].envelope, false)
})

test('exportReplayEnvelope payload uses state.history not match.history', async () => {
  const { deps, setCalls } = createDeps({
    exportEnvelope: (payload) => {
      assert.deepEqual(payload.history, [
        {
          action: { type: 'PASS' },
          actorSeatId: 'seat-1',
          rngStepBefore: 0,
          rngStepAfter: 1,
        },
      ])
      return { version: 1, seed: payload.seed, setup: payload.setup, history: payload.history }
    },
  })

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  assert.equal(setCalls.length, 1)
})

test('already uploaded id in memory does not call set again', async () => {
  const { deps, setCalls, uploadedIds } = createDeps()
  uploadedIds.add('match-test-1')

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  assert.equal(setCalls.length, 0)
})

test('already uploaded id in sessionStorage does not call set again', async () => {
  const { deps, setCalls, storage } = createDeps()
  storage.setItem(UPLOADED_MATCH_IDS_STORAGE_KEY, JSON.stringify(['match-test-1']))

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  assert.equal(setCalls.length, 0)
})

test('not configured skips upload', async () => {
  const { deps, setCalls } = createDeps({
    isConfigured: () => false,
  })

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  assert.equal(setCalls.length, 0)
})

test('not match over skips upload', async () => {
  const { deps, setCalls } = createDeps()
  const match = sampleMatch({
    state: {
      phase: MATCH_PHASES.DUNGEON,
      rng: { seed: 42 },
      history: [],
    },
  })

  maybeUploadCompletedMatchReplay(match, deps)
  assert.equal(setCalls.length, 0)
})

test('missing match id skips upload', async () => {
  const { deps, setCalls } = createDeps()
  const match = sampleMatch({ id: '' })

  maybeUploadCompletedMatchReplay(match, deps)
  assert.equal(setCalls.length, 0)
})

test('marks uploaded before await so rapid calls only set once', async () => {
  const { deps, setCalls, uploadedIds } = createDeps({
    setCompletedMatch: async (matchId, envelope) => {
      setCalls.push({ matchId, envelope })
      assert.equal(uploadedIds.has('match-test-1'), true)
      await new Promise((resolve) => setTimeout(resolve, 10))
    },
  })

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.equal(setCalls.length, 1)
})

test('write failure does not throw to caller', async () => {
  const { deps } = createDeps({
    setCompletedMatch: async () => {
      throw new Error('network')
    },
  })

  assert.doesNotThrow(() => {
    maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  })
})

test('persists uploaded id to sessionStorage', () => {
  const { deps, storage } = createDeps()

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)

  const raw = storage.getItem(UPLOADED_MATCH_IDS_STORAGE_KEY)
  assert.ok(raw)
  assert.deepEqual(JSON.parse(raw), ['match-test-1'])
})

test('match over includes cinematic presentationSpeedProfile in envelope', async () => {
  const { exportReplayEnvelope } = await import('../debug/replay.js')
  const { deps, setCalls } = createDeps()
  delete deps.exportEnvelope

  maybeUploadCompletedMatchReplay(
    sampleMatch({ presentationSpeedProfile: 'cinematic' }),
    deps,
  )

  assert.equal(setCalls.length, 1)
  const expected = exportReplayEnvelope({
    seed: 42,
    setup: sampleMatch().setup,
    history: sampleMatch().state.history,
    presentationSpeedProfile: 'cinematic',
  })
  assert.equal(setCalls[0].envelope.presentationSpeedProfile, expected.presentationSpeedProfile)
})

test('match over omits presentationSpeedProfile when absent on match', async () => {
  const { deps, setCalls } = createDeps()
  delete deps.exportEnvelope

  maybeUploadCompletedMatchReplay(sampleMatch({ presentationSpeedProfile: undefined }), deps)
  assert.equal(setCalls.length, 1)
  assert.equal('presentationSpeedProfile' in setCalls[0].envelope, false)
})

test('match over omits presentationSpeedProfile when invalid on match', async () => {
  const { exportReplayEnvelope } = await import('../debug/replay.js')
  const { deps, setCalls } = createDeps({ uploadedIds: new Set() })
  delete deps.exportEnvelope

  maybeUploadCompletedMatchReplay(
    sampleMatch({ id: 'match-invalid-pace', presentationSpeedProfile: 'fast' }),
    deps,
  )
  assert.equal(setCalls.length, 1)
  const expected = exportReplayEnvelope({
    seed: 42,
    setup: sampleMatch().setup,
    history: sampleMatch().state.history,
    presentationSpeedProfile: 'fast',
  })
  assert.equal('presentationSpeedProfile' in expected, false)
  assert.equal('presentationSpeedProfile' in setCalls[0].envelope, false)
})

test('resume at match over with prior session upload does not set again', async () => {
  const storage = createMemoryStorage()
  const uploadedIds = new Set()
  /** @type {Array<{ matchId: string }>} */
  const setCalls = []

  const firstDeps = {
    storage,
    uploadedIds,
    isConfigured: () => true,
    setCompletedMatch: async (matchId) => {
      setCalls.push({ matchId })
    },
  }
  maybeUploadCompletedMatchReplay(sampleMatch(), firstDeps)
  assert.equal(setCalls.length, 1)

  const reloadedUploadedIds = new Set()
  const resumeDeps = {
    storage,
    uploadedIds: reloadedUploadedIds,
    isConfigured: () => true,
    setCompletedMatch: async (matchId) => {
      setCalls.push({ matchId })
    },
  }
  maybeUploadCompletedMatchReplay(sampleMatch(), resumeDeps)

  assert.equal(setCalls.length, 1)
  assert.equal(reloadedUploadedIds.has('match-test-1'), true)
})

test('sessionStorage dedup hydrates in-memory uploadedIds', () => {
  const { deps, uploadedIds } = createDeps()
  deps.storage.setItem(UPLOADED_MATCH_IDS_STORAGE_KEY, JSON.stringify(['match-test-1']))

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)

  assert.equal(uploadedIds.has('match-test-1'), true)
})

test('not configured does not mark sessionStorage', () => {
  const { deps, storage } = createDeps({
    isConfigured: () => false,
  })

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)

  assert.equal(storage.getItem(UPLOADED_MATCH_IDS_STORAGE_KEY), null)
})

test('write failure still marks uploaded to avoid duplicate attempts', async () => {
  const { deps, storage } = createDeps({
    setCompletedMatch: async () => {
      throw new Error('network')
    },
  })

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(JSON.parse(storage.getItem(UPLOADED_MATCH_IDS_STORAGE_KEY)), ['match-test-1'])
})

test('appends new match id to existing sessionStorage list', () => {
  const { deps, storage } = createDeps()
  storage.setItem(UPLOADED_MATCH_IDS_STORAGE_KEY, JSON.stringify(['match-other']))

  maybeUploadCompletedMatchReplay(sampleMatch(), deps)

  assert.deepEqual(JSON.parse(storage.getItem(UPLOADED_MATCH_IDS_STORAGE_KEY)), [
    'match-other',
    'match-test-1',
  ])
})

test('null match does not throw', () => {
  const { deps } = createDeps()
  assert.doesNotThrow(() => {
    maybeUploadCompletedMatchReplay(null, deps)
  })
})

test('corrupt sessionStorage does not throw and still uploads once', () => {
  const { deps, setCalls, storage } = createDeps()
  storage.setItem(UPLOADED_MATCH_IDS_STORAGE_KEY, 'not-json')

  assert.doesNotThrow(() => {
    maybeUploadCompletedMatchReplay(sampleMatch(), deps)
  })
  assert.equal(setCalls.length, 1)
})

test('createCompletedMatchReplayUploadTracker exposes maybeUpload', () => {
  const tracker = createCompletedMatchReplayUploadTracker(createMemoryStorage())
  assert.equal(typeof tracker.maybeUpload, 'function')
  assert.doesNotThrow(() => tracker.maybeUpload(null))
})

test('maybeUpload uploads headless-completed multi-seat match replay envelope', async () => {
  const { initial, result } = await buildHeadlessCompletedFourPlayerMatch(8801)
  const { deps, setCalls } = createDeps()
  const match = {
    id: 'match-headless-complete',
    setup: FOUR_PLAYER_SETUP,
    state: result.state,
    presentationSpeedProfile: 'brisk',
  }

  assert.ok(match.state.history.length > initial.history.length)

  maybeUploadCompletedMatchReplay(match, deps)

  assert.equal(setCalls.length, 1)
  assert.equal(setCalls[0].matchId, 'match-headless-complete')
  assert.equal(setCalls[0].envelope.seed, initial.rng.seed)
  assert.deepEqual(setCalls[0].envelope.setup, FOUR_PLAYER_SETUP)
  assert.deepEqual(setCalls[0].envelope.history, match.state.history)
  assert.equal(setCalls[0].envelope.presentationSpeedProfile, 'brisk')
})
