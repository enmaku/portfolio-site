import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchesPerWeekChart } from './buildMatchesPerWeekChart.js'

test('buildMatchesPerWeekChart maps bucket labels and counts', () => {
  const buckets = [
    {
      startInclusive: '2026-05-01T00:00:00.000Z',
      endExclusive: '2026-05-08T00:00:00.000Z',
      label: 'May 1',
    },
    {
      startInclusive: '2026-05-08T00:00:00.000Z',
      endExclusive: '2026-05-15T00:00:00.000Z',
      label: 'May 8',
    },
  ]
  const result = buildMatchesPerWeekChart(buckets, [2, 0])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.labels, ['May 1', 'May 8'])
  assert.deepEqual(result.chart.values, [2, 0])
  assert.deepEqual(result.chart.rollingAverageValues, [2, null])
})

test('buildMatchesPerWeekChart includes three-week rolling averages', () => {
  const buckets = [
    {
      startInclusive: '2026-05-01T00:00:00.000Z',
      endExclusive: '2026-05-08T00:00:00.000Z',
      label: 'May 1',
    },
    {
      startInclusive: '2026-05-08T00:00:00.000Z',
      endExclusive: '2026-05-15T00:00:00.000Z',
      label: 'May 8',
    },
    {
      startInclusive: '2026-05-15T00:00:00.000Z',
      endExclusive: '2026-05-22T00:00:00.000Z',
      label: 'May 15',
    },
  ]
  const result = buildMatchesPerWeekChart(buckets, [2, 4, 6])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.rollingAverageValues, [2, (2 + 4) / 2, (2 + 4 + 6) / 3])
})

test('buildMatchesPerWeekChart returns error when all counts are zero', () => {
  const buckets = [
    {
      startInclusive: '2026-05-01T00:00:00.000Z',
      endExclusive: '2026-05-08T00:00:00.000Z',
      label: 'May 1',
    },
  ]
  assert.deepEqual(buildMatchesPerWeekChart(buckets, [0]), { status: 'error' })
})
