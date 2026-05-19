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

test('exportReplayEnvelope includes presentationSpeedProfile when cinematic or brisk', () => {
  const brisk = exportReplayEnvelope({
    seed: 1,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
    presentationSpeedProfile: 'brisk',
  })
  assert.equal(brisk.presentationSpeedProfile, 'brisk')
  const cinematic = exportReplayEnvelope({
    seed: 1,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
    presentationSpeedProfile: 'cinematic',
  })
  assert.equal(cinematic.presentationSpeedProfile, 'cinematic')
})

test('exportReplayEnvelope omits presentationSpeedProfile when absent or invalid', () => {
  const noPace = exportReplayEnvelope({
    seed: 1,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  })
  assert.equal('presentationSpeedProfile' in noPace, false)
  const bad = exportReplayEnvelope({
    seed: 1,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
    presentationSpeedProfile: 'fast',
  })
  assert.equal('presentationSpeedProfile' in bad, false)
})

test('importReplayEnvelope rejects invalid presentationSpeedProfile', () => {
  const base = {
    version: 1,
    seed: 0,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  }
  assert.equal(importReplayEnvelope({ ...base, presentationSpeedProfile: 'fast' }).ok, false)
  assert.equal(importReplayEnvelope({ ...base, presentationSpeedProfile: null }).ok, false)
})

test('importReplayEnvelope accepts optional presentationSpeedProfile', () => {
  const exported = exportReplayEnvelope({
    seed: 0,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
    presentationSpeedProfile: 'brisk',
  })
  const imported = importReplayEnvelope(exported)
  assert.equal(imported.ok, true)
  assert.equal(imported.replay.presentationSpeedProfile, 'brisk')
})

test('exportReplayEnvelope emits integer version 1', () => {
  const replay = exportReplayEnvelope({
    seed: 0,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  })
  assert.equal(replay.version, 1)
  assert.equal(Number.isInteger(replay.version), true)
})

test('importReplayEnvelope accepts empty history', () => {
  const result = importReplayEnvelope({
    version: 1,
    seed: 7,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.replay.history, [])
})

test('importReplayEnvelope preserves unknown top-level keys', () => {
  const result = importReplayEnvelope({
    version: 1,
    seed: 0,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
    rulesHash: 'abc',
    extra: { nested: true },
  })
  assert.equal(result.ok, true)
  assert.equal(result.replay.rulesHash, 'abc')
  assert.deepEqual(result.replay.extra, { nested: true })
})

test('importReplayEnvelope rejects non-integer version', () => {
  const base = {
    seed: 0,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  }
  assert.equal(importReplayEnvelope({ ...base, version: '1' }).ok, false)
  assert.equal(importReplayEnvelope({ ...base, version: 1.5 }).ok, false)
})
