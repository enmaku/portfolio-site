import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allocateNextSettlementMapNumber,
  ensureSettlementMapNumbers,
  isValidSettlementMapNumber,
} from './settlementMapNumber.js'

test('isValidSettlementMapNumber accepts integers from 1', () => {
  assert.equal(isValidSettlementMapNumber(1), true)
  assert.equal(isValidSettlementMapNumber(12), true)
  assert.equal(isValidSettlementMapNumber(0), false)
  assert.equal(isValidSettlementMapNumber(-1), false)
  assert.equal(isValidSettlementMapNumber(1.5), false)
  assert.equal(isValidSettlementMapNumber('1'), false)
  assert.equal(isValidSettlementMapNumber(undefined), false)
})

test('allocateNextSettlementMapNumber starts at 1 for an empty realm', () => {
  assert.equal(allocateNextSettlementMapNumber([]), 1)
  assert.equal(allocateNextSettlementMapNumber(null), 1)
})

test('allocateNextSettlementMapNumber continues past the highest existing number including ruins', () => {
  assert.equal(
    allocateNextSettlementMapNumber([
      { mapNumber: 1 },
      { mapNumber: 3, status: 'ruin' },
      { mapNumber: 2 },
    ]),
    4,
  )
})

test('ensureSettlementMapNumbers preserves valid numbers and fills gaps in founding order', () => {
  const ensured = ensureSettlementMapNumbers([
    { id: 'b', foundedEpoch: 2 },
    { id: 'a', foundedEpoch: 0, mapNumber: 1 },
    { id: 'c', foundedEpoch: 1 },
  ])

  assert.deepEqual(
    ensured.map((row) => ({ id: row.id, mapNumber: row.mapNumber })),
    [
      { id: 'b', mapNumber: 3 },
      { id: 'a', mapNumber: 1 },
      { id: 'c', mapNumber: 2 },
    ],
  )
})

test('ensureSettlementMapNumbers does not mutate the input array or rows', () => {
  const input = [{ id: 'a', foundedEpoch: 0 }]
  const ensured = ensureSettlementMapNumbers(input)
  assert.equal(input[0].mapNumber, undefined)
  assert.equal(ensured[0].mapNumber, 1)
  assert.notEqual(ensured[0], input[0])
})
