import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialMatchState, getLegalActions } from '../engine/kernel.js'
import { chooseRandombotAction } from './randombot.js'

test('chooseRandombotAction always returns a legal action', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 3,
      opponents: [{ type: 'randombot' }, { type: 'randombot' }],
    },
    { seed: 501 },
  )
  const seatId = state.turn.activeSeatId
  const action = chooseRandombotAction(state, { seatId })
  const legal = getLegalActions(state, { seatId })
  assert.equal(legal.some((candidate) => JSON.stringify(candidate) === JSON.stringify(action)), true)
})

test('chooseRandombotAction is deterministic for same state', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 2024 },
  )
  const seatId = state.turn.activeSeatId
  const a = chooseRandombotAction(state, { seatId })
  const b = chooseRandombotAction(state, { seatId })
  assert.deepEqual(a, b)
})

test('chooseRandombotAction fallback returns first legal action when total weight is non-positive', () => {
  const initial = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 77 },
  )
  const state = {
    ...initial,
    rng: { ...initial.rng, state: 0xffffffff },
  }
  const seatId = state.turn.activeSeatId
  const legal = getLegalActions(state, { seatId })
  const action = chooseRandombotAction(state, { seatId }, { weights: { PASS: 0, DRAW: 0 } })
  assert.deepEqual(action, legal[0])
})

test('chooseRandombotAction stays deterministic across mirrored state sequences', () => {
  const setup = {
    totalSeats: 3,
    opponents: [{ type: 'randombot' }, { type: 'randombot' }],
  }
  const first = createInitialMatchState(setup, { seed: 9090 })
  const second = createInitialMatchState(setup, { seed: 9090 })

  const firstSeatId = first.turn.activeSeatId
  const secondSeatId = second.turn.activeSeatId
  const firstChoice = chooseRandombotAction(first, { seatId: firstSeatId })
  const secondChoice = chooseRandombotAction(second, { seatId: secondSeatId })
  assert.deepEqual(firstChoice, secondChoice)
})
