import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDefaultSetupConfig,
  randomizeSeatsFromSetup,
  validateSetupConfig,
} from './config.js'

test('default setup has one human and one opponent', () => {
  const setup = createDefaultSetupConfig()
  assert.equal(setup.totalSeats, 2)
  assert.equal(setup.opponents.length, 1)
  assert.equal(setup.opponents[0].type, 'randombot')
})

test('validateSetupConfig rejects zero opponents', () => {
  const result = validateSetupConfig({
    totalSeats: 1,
    opponents: [],
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_TABLE_SIZE')
})

test('validateSetupConfig enforces opponents length equals totalSeats - 1', () => {
  const result = validateSetupConfig({
    totalSeats: 4,
    opponents: [{ type: 'randombot' }],
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_OPPONENT_COUNT')
})

test('randomizeSeatsFromSetup is deterministic for same seed', () => {
  const setup = {
    totalSeats: 4,
    opponents: [{ type: 'randombot' }, { type: 'nn', modelId: 'latest' }, { type: 'randombot' }],
  }
  const a = randomizeSeatsFromSetup(setup, { seed: 2026 })
  const b = randomizeSeatsFromSetup(setup, { seed: 2026 })
  assert.deepEqual(a, b)
})

test('randomized seats are labeled Player 1-4 with role markers', () => {
  const setup = {
    totalSeats: 4,
    opponents: [{ type: 'randombot' }, { type: 'nn', modelId: 'v1.0.0' }, { type: 'randombot' }],
  }
  const result = randomizeSeatsFromSetup(setup, { seed: 10 })
  assert.equal(result.seats.length, 4)
  assert.deepEqual(
    result.seats.map((seat) => seat.label),
    ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  )
  assert.equal(
    result.seats.every(
      (seat) => typeof seat.roleMarker.symbol === 'string' && typeof seat.roleMarker.color === 'string',
    ),
    true,
  )
})
