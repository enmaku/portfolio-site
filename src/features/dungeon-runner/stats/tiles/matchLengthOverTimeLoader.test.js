import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMatchLengthOverTimeTile } from './matchLengthOverTimeLoader.js'

test('loadMatchLengthOverTimeTile builds chart from bounded match length series', async () => {
  const result = await loadMatchLengthOverTimeTile({
    fetchMatchLengthSeries: async () => [
      { createdAt: '2026-05-01T00:00:00.000Z', historyStepCount: 10 },
      { createdAt: '2026-05-02T00:00:00.000Z', historyStepCount: 20 },
    ],
    fetchModelCatalog: async () => ({ publishedAtByModelId: {} }),
  })
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.deepEqual(result.windowBounds, { min: 2, max: 2, default: 2 })
  assert.deepEqual(result.matchLengthSeries.length, 2)
  assert.deepEqual(result.chart.values, [10, 20])
  assert.deepEqual(result.chart.rollingAverageValues, [10, 15])
  assert.deepEqual(result.chart.modelPublishMarkers, [])
  assert.equal(result.chart.labels.length, 2)
})

test('loadMatchLengthOverTimeTile uses default ten-match trend window when series is long enough', async () => {
  const matchLengthSeries = Array.from({ length: 12 }, (_, index) => ({
    createdAt: `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    historyStepCount: (index + 1) * 10,
  }))
  const result = await loadMatchLengthOverTimeTile({
    fetchMatchLengthSeries: async () => matchLengthSeries,
    fetchModelCatalog: async () => ({ publishedAtByModelId: {} }),
  })
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.deepEqual(result.windowBounds, { min: 2, max: 12, default: 10 })
  assert.equal(result.chart.rollingAverageValues.length, 12)
  assert.equal(result.chart.rollingAverageValues[11], 75)
})

test('loadMatchLengthOverTimeTile returns error for empty series', async () => {
  const result = await loadMatchLengthOverTimeTile({
    fetchMatchLengthSeries: async () => [],
  })
  assert.deepEqual(result, { status: 'error' })
})
