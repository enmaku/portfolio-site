import assert from 'node:assert/strict'
import test from 'node:test'
import { exportReplayEnvelope, importReplayEnvelope } from './replay.js'

test('exportReplayEnvelope captures setup and history', () => {
  const replay = exportReplayEnvelope({
    seed: 42,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [{ action: { type: 'PASS' } }],
  })
  assert.equal(replay.version, 1)
  assert.equal(replay.seed, 42)
  assert.equal(replay.history.length, 1)
})

test('importReplayEnvelope rejects malformed payload', () => {
  const result = importReplayEnvelope({ version: 1 })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_REPLAY')
})

test('importReplayEnvelope accepts valid envelope', () => {
  const replay = exportReplayEnvelope({
    seed: 42,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [{ action: { type: 'PASS' }, actorSeatId: 'seat-1', rngStepBefore: 0, rngStepAfter: 1 }],
  })
  const result = importReplayEnvelope(replay)
  assert.equal(result.ok, true)
  assert.deepEqual(result.replay.history, replay.history)
})

test('importReplayEnvelope rejects non turn-boundary history', () => {
  const replay = exportReplayEnvelope({
    seed: 42,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [
      {
        action: { type: 'PASS' },
        actorSeatId: 'seat-1',
        rngStepBefore: 2,
        rngStepAfter: 2,
      },
    ],
  })
  const result = importReplayEnvelope(replay)
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_REPLAY_HISTORY')
})

test('importReplayEnvelope requires contiguous turn boundaries', () => {
  const replay = exportReplayEnvelope({
    seed: 42,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [
      { action: { type: 'PASS' }, actorSeatId: 'seat-1', rngStepBefore: 0, rngStepAfter: 1 },
      { action: { type: 'PASS' }, actorSeatId: 'seat-2', rngStepBefore: 3, rngStepAfter: 4 },
    ],
  })
  const result = importReplayEnvelope(replay)
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_REPLAY_HISTORY')
})

test('importReplayEnvelope requires numeric seed', () => {
  const replay = {
    version: 1,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  }
  const result = importReplayEnvelope(replay)
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_REPLAY')
})
