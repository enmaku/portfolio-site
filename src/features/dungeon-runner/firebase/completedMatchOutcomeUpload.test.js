import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_OUTCOME_SCHEMA_VERSION } from '../analytics/buildMatchOutcomeRecord.js'
import { MATCH_PHASES } from '../engine/kernel.js'
import {
  maybeCreateCompletedMatchOutcome,
  resolveHumanPlayerSeatId,
} from './completedMatchOutcomeUpload.js'

/** @param {Record<string, unknown>} overrides */
function sampleMatch(overrides = {}) {
  return {
    id: 'match-test-1',
    setup: {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    state: {
      phase: MATCH_PHASES.MATCH_OVER,
      seats: [
        { id: 'seat-human', label: 'You', role: { type: 'human' } },
        { id: 'seat-bot', label: 'Bot', role: { type: 'randombot' } },
      ],
      history: [
        {
          action: { type: 'PASS' },
          actorSeatId: 'seat-human',
          rngStepBefore: 0,
          rngStepAfter: 1,
        },
      ],
      scoreboard: {
        'seat-human': { successes: 1, lives: 1, eliminated: false },
        'seat-bot': { successes: 0, lives: 0, eliminated: true },
      },
      matchWinnerSeatId: 'seat-human',
    },
    presentationSpeedProfile: 'brisk',
    ...overrides,
  }
}

test('resolveHumanPlayerSeatId finds human seat', () => {
  const seats = [
    { id: 'a', role: { type: 'nn' } },
    { id: 'b', role: { type: 'human' } },
  ]
  assert.equal(resolveHumanPlayerSeatId(seats), 'b')
  assert.equal(resolveHumanPlayerSeatId([]), '')
})

test('match over builds outcome record via createOutcome', async () => {
  /** @type {Array<{ matchId: string, record: unknown }>} */
  const createCalls = []
  const createdAt = '2026-05-16T00:00:00.000Z'

  await maybeCreateCompletedMatchOutcome(sampleMatch(), createdAt, {
    isConfigured: () => true,
    createOutcome: async (matchId, record) => {
      createCalls.push({ matchId, record })
    },
  })

  assert.equal(createCalls.length, 1)
  assert.equal(createCalls[0].matchId, 'match-test-1')
  assert.equal(createCalls[0].record.createdAt, createdAt)
  assert.equal(createCalls[0].record.outcomeSchemaVersion, MATCH_OUTCOME_SCHEMA_VERSION)
  assert.equal(createCalls[0].record.matchId, 'match-test-1')
  assert.equal(createCalls[0].record.presentationSpeedProfile, 'brisk')
})

test('uses caller createdAt without inventing timestamp', async () => {
  /** @type {Array<{ record: { createdAt: string } }>} */
  const createCalls = []
  const createdAt = '2026-01-02T03:04:05.678Z'

  await maybeCreateCompletedMatchOutcome(sampleMatch(), createdAt, {
    isConfigured: () => true,
    createOutcome: async (_matchId, record) => {
      createCalls.push({ record })
    },
  })

  assert.equal(createCalls[0].record.createdAt, createdAt)
})

test('not configured skips createOutcome', async () => {
  /** @type {unknown[]} */
  const createCalls = []

  await maybeCreateCompletedMatchOutcome(sampleMatch(), '2026-05-16T00:00:00.000Z', {
    isConfigured: () => false,
    createOutcome: async () => {
      createCalls.push(true)
    },
  })

  assert.equal(createCalls.length, 0)
})

test('not match over skips createOutcome', async () => {
  /** @type {unknown[]} */
  const createCalls = []

  await maybeCreateCompletedMatchOutcome(
    sampleMatch({
      state: {
        ...sampleMatch().state,
        phase: MATCH_PHASES.DUNGEON,
      },
    }),
    '2026-05-16T00:00:00.000Z',
    {
      isConfigured: () => true,
      createOutcome: async () => {
        createCalls.push(true)
      },
    },
  )

  assert.equal(createCalls.length, 0)
})

test('empty createdAt skips createOutcome', async () => {
  /** @type {unknown[]} */
  const createCalls = []

  await maybeCreateCompletedMatchOutcome(sampleMatch(), '', {
    isConfigured: () => true,
    createOutcome: async () => {
      createCalls.push(true)
    },
  })

  assert.equal(createCalls.length, 0)
})

test('write failure does not throw to caller', async () => {
  await assert.doesNotReject(async () => {
    await maybeCreateCompletedMatchOutcome(sampleMatch(), '2026-05-16T00:00:00.000Z', {
      isConfigured: () => true,
      createOutcome: async () => {
        throw new Error('network')
      },
    })
  })
})

test('null match does not throw', async () => {
  await assert.doesNotReject(async () => {
    await maybeCreateCompletedMatchOutcome(null, '2026-05-16T00:00:00.000Z', {
      isConfigured: () => true,
      createOutcome: async () => {
        throw new Error('should not run')
      },
    })
  })
})
