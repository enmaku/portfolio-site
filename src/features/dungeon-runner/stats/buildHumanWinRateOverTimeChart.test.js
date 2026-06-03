import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHumanWinRateOverTimeChart } from './buildHumanWinRateOverTimeChart.js'

test('buildHumanWinRateOverTimeChart maps wins to 100 and losses to 0 on match sequence', () => {
  const result = buildHumanWinRateOverTimeChart([
    { humanWon: true, createdAt: '2026-05-01T00:00:00.000Z' },
    { humanWon: false, createdAt: '2026-05-02T00:00:00.000Z' },
  ])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.labels, ['1', '2'])
  assert.deepEqual(result.chart.values, [100, 0])
  assert.deepEqual(result.chart.rollingAverageValues, [100, 50])
})

test('buildHumanWinRateOverTimeChart uses default ten-match trend window when series is long enough', () => {
  const series = Array.from({ length: 12 }, (_, index) => ({
    humanWon: index % 2 === 0,
    createdAt: `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  }))
  const result = buildHumanWinRateOverTimeChart(series)
  assert.equal(result.status, 'ok')
  assert.equal(result.chart.rollingAverageValues[11], 50)
})

test('buildHumanWinRateOverTimeChart returns error for empty series', () => {
  assert.deepEqual(buildHumanWinRateOverTimeChart([]), { status: 'error' })
})
