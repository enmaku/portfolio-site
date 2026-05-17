import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialMatchState } from '../engine/kernel.js'
import { buildStateFromReplayEnvelope } from './replaySession.js'

test('buildStateFromReplayEnvelope replays actions from seed + setup', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const seed = 11
  let state = createInitialMatchState(setup, { seed })
  const actorSeatId = state.turn.activeSeatId
  const result = buildStateFromReplayEnvelope({
    version: 1,
    seed,
    setup,
    history: [{ action: { type: 'PASS' }, actorSeatId, rngStepBefore: 0, rngStepAfter: 1 }],
  })
  assert.equal(result.ok, true)
  assert.equal(result.state.turn.turnNumber, state.turn.turnNumber + 1)
})

test('buildStateFromReplayEnvelope rejects invalid replay action sequence', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const result = buildStateFromReplayEnvelope({
    version: 1,
    seed: 11,
    setup,
    history: [{ action: { type: 'ADVANCE_DUNGEON' }, actorSeatId: 'seat-1', rngStepBefore: 0, rngStepAfter: 1 }],
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_REPLAY_ACTION')
})
