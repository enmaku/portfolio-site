import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRollingHumanWinRateTile } from './rollingHumanWinRateLoader.js'

const SERIES = [
  { humanWon: true, createdAt: 1 },
  { humanWon: false, createdAt: 2 },
  { humanWon: true, createdAt: 3 },
  { humanWon: true, createdAt: 4 },
  { humanWon: false, createdAt: 5 },
]

test('loadRollingHumanWinRateTile returns series, bounds, and default-window chart', async () => {
  const result = await loadRollingHumanWinRateTile({
    fetchHumanWinSeries: async () => SERIES,
  })
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.deepEqual(result.windowBounds, { min: 5, max: 5, default: 5 })
  assert.deepEqual(result.humanWonSeries, SERIES.map(({ humanWon }) => ({ humanWon })))
  assert.deepEqual(result.chart, {
    labels: ['5'],
    percents: [60],
  })
})

test('loadRollingHumanWinRateTile returns error when series has fewer than five matches', async () => {
  const result = await loadRollingHumanWinRateTile({
    fetchHumanWinSeries: async () => SERIES.slice(0, 4),
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadRollingHumanWinRateTile returns error when series fetch fails', async () => {
  const result = await loadRollingHumanWinRateTile({
    fetchHumanWinSeries: async () => {
      throw new Error('firestore')
    },
  })
  assert.deepEqual(result, { status: 'error' })
})
