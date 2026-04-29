import assert from 'node:assert/strict'
import test from 'node:test'
import { canStartMatchFromSetup, normalizeSetupState } from './state.js'

test('normalizeSetupState keeps opponents aligned with total seats', () => {
  const setup = normalizeSetupState({
    totalSeats: 4,
    opponents: [{ type: 'randombot' }],
  })
  assert.equal(setup.opponents.length, 3)
})

test('normalizeSetupState clamps table size to 2-4 deterministically', () => {
  const low = normalizeSetupState({
    totalSeats: 1,
    opponents: [],
  })
  assert.equal(low.totalSeats, 2)
  assert.equal(low.opponents.length, 1)

  const high = normalizeSetupState({
    totalSeats: 9,
    opponents: [],
  })
  assert.equal(high.totalSeats, 4)
  assert.equal(high.opponents.length, 3)
})

test('canStartMatchFromSetup blocks zero-opponent table', () => {
  assert.equal(
    canStartMatchFromSetup({
      totalSeats: 2,
      opponents: [],
    }),
    false,
  )
})

test('canStartMatchFromSetup allows valid NN and randombot mix', () => {
  assert.equal(
    canStartMatchFromSetup({
      totalSeats: 3,
      opponents: [{ type: 'nn', modelId: 'latest' }, { type: 'randombot' }],
    }),
    true,
  )
})
