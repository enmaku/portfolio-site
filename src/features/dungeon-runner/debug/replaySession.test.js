import assert from 'node:assert/strict'
import test from 'node:test'
import { applyAction, getLegalActions } from '../engine/kernel.js'
import { bootstrapMatchStateForReplay } from './replayBootstrap.js'
import { buildStateFromReplayEnvelope } from './replaySession.js'

test('buildStateFromReplayEnvelope replays from bootstrap pick-adventurer start', () => {
  const setup = { totalSeats: 3, opponents: [{ type: 'randombot' }, { type: 'randombot' }] }
  const seed = 11
  let state = bootstrapMatchStateForReplay(setup, seed)
  const actorSeatId = state.turn.activeSeatId
  const legal = getLegalActions(state, { seatId: actorSeatId })
  const choose = legal.find((a) => a.type === 'CHOOSE_NEXT_ADVENTURER')
  assert.ok(choose)
  const applied = applyAction(state, choose, { seatId: actorSeatId })
  assert.equal(applied.ok, true)
  const result = buildStateFromReplayEnvelope({
    version: 1,
    seed,
    setup,
    history: [
      {
        action: choose,
        actorSeatId,
        rngStepBefore: 0,
        rngStepAfter: applied.state.rng.step,
      },
    ],
  })
  assert.equal(result.ok, true)
  assert.equal(result.state.rng.step, applied.state.rng.step)
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
