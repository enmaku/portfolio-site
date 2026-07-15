import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchesPerWeekChart } from './buildMatchesPerWeekChart.js'

test('buildMatchesPerWeekChart hides only trend buckets before the archive started', () => {
  const buckets = [
    {
      startInclusive: '2026-05-04T00:00:00.000Z',
      endExclusive: '2026-05-11T00:00:00.000Z',
      label: 'May 4',
    },
    {
      startInclusive: '2026-05-11T00:00:00.000Z',
      endExclusive: '2026-05-18T00:00:00.000Z',
      label: 'May 11',
    },
    {
      startInclusive: '2026-05-18T00:00:00.000Z',
      endExclusive: '2026-05-25T00:00:00.000Z',
      label: 'May 18',
    },
  ]
  const result = buildMatchesPerWeekChart(buckets, [0, 2, 0])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.labels, ['May 4', 'May 11', 'May 18'])
  assert.deepEqual(result.chart.values, [0, 2, 0])
  assert.deepEqual(result.chart.rollingAverageValues, [null, (0 + 2) / 2, (0 + 2 + 0) / 3])
})

test('buildMatchesPerWeekChart includes three-week rolling averages', () => {
  const buckets = [
    {
      startInclusive: '2026-05-18T00:00:00.000Z',
      endExclusive: '2026-05-25T00:00:00.000Z',
      label: 'May 18',
    },
    {
      startInclusive: '2026-05-25T00:00:00.000Z',
      endExclusive: '2026-06-01T00:00:00.000Z',
      label: 'May 25',
    },
    {
      startInclusive: '2026-06-01T00:00:00.000Z',
      endExclusive: '2026-06-08T00:00:00.000Z',
      label: 'Jun 1',
    },
  ]
  const result = buildMatchesPerWeekChart(buckets, [2, 4, 6])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.rollingAverageValues, [2, (2 + 4) / 2, (2 + 4 + 6) / 3])
})

test('buildMatchesPerWeekChart accepts custom rolling window size', () => {
  const buckets = [
    {
      startInclusive: '2026-05-18T00:00:00.000Z',
      endExclusive: '2026-05-25T00:00:00.000Z',
      label: 'May 18',
    },
    {
      startInclusive: '2026-05-25T00:00:00.000Z',
      endExclusive: '2026-06-01T00:00:00.000Z',
      label: 'May 25',
    },
    {
      startInclusive: '2026-06-01T00:00:00.000Z',
      endExclusive: '2026-06-08T00:00:00.000Z',
      label: 'Jun 1',
    },
  ]
  const result = buildMatchesPerWeekChart(buckets, [2, 4, 6], 2)
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.rollingAverageValues, [2, (2 + 4) / 2, (4 + 6) / 2])
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
