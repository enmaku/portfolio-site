import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMatchLengthOverTimeTile } from './matchLengthOverTimeLoader.js'

test('loadMatchLengthOverTimeTile builds chart from bounded match length series', async () => {
  const result = await loadMatchLengthOverTimeTile({
    fetchMatchLengthSeries: async () => [
      { createdAt: '2026-05-01T00:00:00.000Z', historyStepCount: 10 },
      { createdAt: '2026-05-02T00:00:00.000Z', historyStepCount: 20 },
    ],
  })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.values, [10, 20])
  assert.equal(result.chart.labels.length, 2)
})

test('loadMatchLengthOverTimeTile returns error for empty series', async () => {
  const result = await loadMatchLengthOverTimeTile({
    fetchMatchLengthSeries: async () => [],
  })
  assert.deepEqual(result, { status: 'error' })
})
