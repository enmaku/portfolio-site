import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../engine/kernel.js'
import { bootstrapMatchStateForReplay } from './replayBootstrap.js'

test('bootstrapMatchStateForReplay matches live match start (seed 1355487512)', () => {
  const setup = {
    totalSeats: 4,
    opponents: [
      { type: 'nn', modelId: 'latest' },
      { type: 'nn', modelId: 'latest' },
      { type: 'nn', modelId: 'latest' },
    ],
  }
  const state = bootstrapMatchStateForReplay(setup, 1355487512)
  assert.equal(state.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.equal(state.turn.activeSeatId, 'seat-4')
  assert.equal(state.pickAdventurer.activeSeatId, 'seat-4')
  assert.equal(state.rng.step, 0)
})
