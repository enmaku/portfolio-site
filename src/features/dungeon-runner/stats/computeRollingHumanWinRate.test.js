import assert from 'node:assert/strict'
import test from 'node:test'
import { computeRollingHumanWinRate } from './computeRollingHumanWinRate.js'

test('computeRollingHumanWinRate returns strict window percents at each sequence position', () => {
  const result = computeRollingHumanWinRate(
    [{ humanWon: true }, { humanWon: false }, { humanWon: true }],
    2,
  )
  assert.deepEqual(result, {
    status: 'ok',
    points: [
      { sequence: 2, percent: 50 },
      { sequence: 3, percent: 50 },
    ],
  })
})

test('computeRollingHumanWinRate rounds whole percents like headline rate tiles', () => {
  const result = computeRollingHumanWinRate(
    [{ humanWon: true }, { humanWon: true }, { humanWon: false }],
    3,
  )
  assert.deepEqual(result, {
    status: 'ok',
    points: [{ sequence: 3, percent: 67 }],
  })
})

test('computeRollingHumanWinRate errors when series shorter than window', () => {
  assert.deepEqual(
    computeRollingHumanWinRate([{ humanWon: true }, { humanWon: false }], 3),
    { status: 'error' },
  )
})
