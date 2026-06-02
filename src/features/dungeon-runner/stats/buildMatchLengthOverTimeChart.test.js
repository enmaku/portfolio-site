import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchLengthOverTimeChart } from './buildMatchLengthOverTimeChart.js'

test('buildMatchLengthOverTimeChart maps series to labels and history step values', () => {
  const result = buildMatchLengthOverTimeChart([
    { createdAt: '2026-05-01T12:00:00.000Z', historyStepCount: 40 },
    { createdAt: '2026-05-02T12:00:00.000Z', historyStepCount: 55 },
  ])
  assert.equal(result.status, 'ok')
  assert.equal(result.chart.values.length, 2)
  assert.deepEqual(result.chart.values, [40, 55])
  assert.equal(result.chart.labels.length, 2)
})

test('buildMatchLengthOverTimeChart returns error for empty series', () => {
  assert.deepEqual(buildMatchLengthOverTimeChart([]), { status: 'error' })
})
