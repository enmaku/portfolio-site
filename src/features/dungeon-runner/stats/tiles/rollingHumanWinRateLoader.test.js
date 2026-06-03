import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRollingHumanWinRateTile } from './rollingHumanWinRateLoader.js'

const SERIES = [
  { humanWon: true, createdAt: '2026-05-01T00:00:00.000Z' },
  { humanWon: false, createdAt: '2026-05-02T00:00:00.000Z' },
  { humanWon: true, createdAt: '2026-05-03T00:00:00.000Z' },
  { humanWon: true, createdAt: '2026-05-04T00:00:00.000Z' },
  { humanWon: false, createdAt: '2026-05-05T00:00:00.000Z' },
]

test('loadRollingHumanWinRateTile returns series, bounds, and default-window chart', async () => {
  const result = await loadRollingHumanWinRateTile({
    fetchHumanWinSeries: async () => SERIES,
    fetchModelCatalog: async () => ({ models: [], publishedAtByModelId: {} }),
  })
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.deepEqual(result.windowBounds, { min: 2, max: 5, default: 5 })
  assert.deepEqual(result.humanWonSeries, SERIES)
  assert.deepEqual(result.chart.labels, ['1', '2', '3', '4', '5'])
  assert.deepEqual(result.chart.values, [100, 0, 100, 100, 0])
  assert.deepEqual(result.chart.rollingAverageValues, [100, 50, 66.66666666666667, 75, 60])
  assert.deepEqual(result.chart.modelPublishMarkers, [])
})

test('loadRollingHumanWinRateTile returns error when series is empty', async () => {
  const result = await loadRollingHumanWinRateTile({
    fetchHumanWinSeries: async () => [],
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
