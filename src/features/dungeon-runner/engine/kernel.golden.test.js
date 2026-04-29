import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ACTION_TYPES, applyAction, createInitialMatchState } from './kernel.js'

test('golden fixture: seed 4242 two-pass bidding transition is stable', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/golden-seed-4242-two-pass.json', import.meta.url), 'utf8'),
  )
  let state = createInitialMatchState(fixture.setup, { seed: fixture.seed })
  for (const step of fixture.script) {
    const action =
      step.action === 'PASS'
        ? { type: ACTION_TYPES.PASS }
        : { type: ACTION_TYPES[step.action] ?? step.action }
    const result = applyAction(state, action, { seatId: state.turn.activeSeatId })
    assert.equal(result.ok, true)
    state = result.state
  }
  assert.deepEqual(
    {
      seats: state.seats,
      phase: state.phase,
      turn: state.turn,
      bidding: state.bidding,
      scoreboard: state.scoreboard,
      history: state.history,
    },
    fixture.expected,
  )
})
