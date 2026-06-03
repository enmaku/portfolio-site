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
  assert.deepEqual(result.chart.labels, ['1', '2'])
  assert.deepEqual(result.chart.modelPublishMarkers, [])
})

test('buildMatchLengthOverTimeChart attaches model publish markers on match sequence', () => {
  const result = buildMatchLengthOverTimeChart(
    [
      { createdAt: '2026-05-20T00:00:00.000Z', historyStepCount: 40 },
      { createdAt: '2026-05-21T18:00:00.000Z', historyStepCount: 55 },
      { createdAt: '2026-05-23T00:00:00.000Z', historyStepCount: 70 },
    ],
    { 'v0.2.02': '2026-05-21T12:00:00.000Z' },
  )
  assert.equal(result.status, 'ok')
  assert.equal(result.chart.modelPublishMarkers.length, 1)
  assert.equal(result.chart.modelPublishMarkers[0].modelId, 'v0.2.02')
  assert.equal(result.chart.modelPublishMarkers[0].sequence, 2)
  assert.equal(result.chart.modelPublishMarkers[0].labelIndex, 1)
})

test('buildMatchLengthOverTimeChart respects configurable trend window size', () => {
  const result = buildMatchLengthOverTimeChart(
    [
      { createdAt: '2026-05-01T12:00:00.000Z', historyStepCount: 10 },
      { createdAt: '2026-05-02T12:00:00.000Z', historyStepCount: 20 },
      { createdAt: '2026-05-03T12:00:00.000Z', historyStepCount: 30 },
      { createdAt: '2026-05-04T12:00:00.000Z', historyStepCount: 40 },
      { createdAt: '2026-05-05T12:00:00.000Z', historyStepCount: 50 },
    ],
    {},
    5,
  )
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.rollingAverageValues, [
    10,
    15,
    20,
    25,
    (10 + 20 + 30 + 40 + 50) / 5,
  ])
})

test('buildMatchLengthOverTimeChart uses default ten-match rolling window when series is long enough', () => {
  const series = Array.from({ length: 12 }, (_, index) => ({
    createdAt: `2026-05-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    historyStepCount: (index + 1) * 10,
  }))
  const result = buildMatchLengthOverTimeChart(series)
  assert.equal(result.status, 'ok')
  assert.equal(result.chart.rollingAverageValues[11], 75)
})

test('buildMatchLengthOverTimeChart caps default window to series length', () => {
  const result = buildMatchLengthOverTimeChart([
    { createdAt: '2026-05-01T12:00:00.000Z', historyStepCount: 30 },
    { createdAt: '2026-05-02T12:00:00.000Z', historyStepCount: 60 },
    { createdAt: '2026-05-03T12:00:00.000Z', historyStepCount: 90 },
  ])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.rollingAverageValues, [30, 45, 60])
})

test('buildMatchLengthOverTimeChart returns error for empty series', () => {
  assert.deepEqual(buildMatchLengthOverTimeChart([]), { status: 'error' })
})
