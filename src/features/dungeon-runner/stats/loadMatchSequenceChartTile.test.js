import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMatchSequenceChartTile, toTrendWindowBounds } from './loadMatchSequenceChartTile.js'

test('toTrendWindowBounds maps ok resolver result to bounds object', () => {
  assert.deepEqual(toTrendWindowBounds({ status: 'ok', min: 2, max: 5, default: 5 }), {
    min: 2,
    max: 5,
    default: 5,
  })
})

test('toTrendWindowBounds returns null for error resolver result', () => {
  assert.equal(toTrendWindowBounds({ status: 'error' }), null)
})

test('loadMatchSequenceChartTile returns error when chart build fails', async () => {
  const result = await loadMatchSequenceChartTile({
    fetchSeries: async () => [{ createdAt: '2026-05-01', historyStepCount: 1 }],
    prepareSeries: (records) => ({ timelineSeries: records, matchLengthSeries: records }),
    buildChart: () => ({ status: 'error' }),
    fetchModelCatalog: async () => ({ publishedAtByModelId: {} }),
  })
  assert.equal(result.status, 'error')
})
