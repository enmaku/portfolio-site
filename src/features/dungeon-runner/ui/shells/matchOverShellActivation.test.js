import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../../engine/kernel.js'
import {
  UPLOADED_MATCH_IDS_STORAGE_KEY,
  maybeUploadCompletedMatchReplay,
} from '../../firebase/completedMatchReplayUpload.js'
import { runMatchOverShellActivation } from './matchOverShellActivation.js'

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

/** @param {Partial<import('../../firebase/completedMatchReplayUpload.js').CompletedMatchReplayUploadDeps>} overrides */
function createUploadDeps(overrides = {}) {
  const storage = createMemoryStorage()
  const uploadedIds = new Set()
  /** @type {Array<{ matchId: string, envelope: { createdAt: string } }>} */
  const setCalls = []
  return {
    storage,
    setCalls,
    deps: {
      storage,
      uploadedIds,
      isConfigured: () => true,
      exportEnvelope: (payload) => ({
        version: 1,
        createdAt: '2020-01-01T00:00:00.000Z',
        ...payload,
      }),
      setCompletedMatch: async (matchId, envelope) => {
        setCalls.push({ matchId, envelope })
      },
      createOutcome: async () => {},
      ...overrides,
    },
  }
}

function matchOverMatch(matchId = 'match-activation-1') {
  return {
    id: matchId,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    state: {
      phase: MATCH_PHASES.MATCH_OVER,
      rng: { seed: 1 },
      history: [],
    },
    presentationSpeedProfile: 'cinematic',
  }
}

test('runMatchOverShellActivation uploads completed match replay once', async () => {
  const { deps, setCalls } = createUploadDeps()
  const tracker = { maybeUpload: (match) => maybeUploadCompletedMatchReplay(match, deps) }
  const match = matchOverMatch()

  runMatchOverShellActivation({ match, uploadTracker: tracker })
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(setCalls.length, 1)
  assert.equal(setCalls[0].matchId, 'match-activation-1')
})

test('runMatchOverShellActivation pairs outcome upload with replay envelope', async () => {
  /** @type {Array<{ match: unknown, createdAt: string }>} */
  const outcomeCalls = []
  const { deps, setCalls } = createUploadDeps({
    createOutcome: async (uploadMatch, createdAt) => {
      outcomeCalls.push({ match: uploadMatch, createdAt })
    },
  })
  const tracker = { maybeUpload: (match) => maybeUploadCompletedMatchReplay(match, deps) }
  const match = matchOverMatch()

  runMatchOverShellActivation({ match, uploadTracker: tracker })
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(outcomeCalls.length, 1)
  assert.equal(outcomeCalls[0].match, match)
  assert.equal(outcomeCalls[0].createdAt, setCalls[0].envelope.createdAt)
})

test('runMatchOverShellActivation is idempotent for the same match id', () => {
  const { deps, setCalls, storage } = createUploadDeps()
  const tracker = { maybeUpload: (match) => maybeUploadCompletedMatchReplay(match, deps) }
  const match = matchOverMatch()

  runMatchOverShellActivation({ match, uploadTracker: tracker })
  runMatchOverShellActivation({ match, uploadTracker: tracker })

  assert.equal(setCalls.length, 1)
  assert.ok(storage.getItem(UPLOADED_MATCH_IDS_STORAGE_KEY)?.includes('match-activation-1'))
})

test('runMatchOverShellActivation no-ops without match', () => {
  const { deps, setCalls } = createUploadDeps()
  const tracker = { maybeUpload: (match) => maybeUploadCompletedMatchReplay(match, deps) }

  runMatchOverShellActivation({ match: null, uploadTracker: tracker })

  assert.equal(setCalls.length, 0)
})

test('runMatchOverShellActivation no-ops without upload tracker', () => {
  assert.doesNotThrow(() => {
    runMatchOverShellActivation({ match: matchOverMatch(), uploadTracker: null })
  })
})
