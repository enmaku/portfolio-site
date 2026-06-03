import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMatchesPerWeekTile } from './matchesPerWeekLoader.js'

test('loadMatchesPerWeekTile aggregates weekly counts via createdAt range queries', async () => {
  const calls = []
  const result = await loadMatchesPerWeekTile({
    buildWeekBuckets: () => [
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
    ],
    countMatchOutcomesCreatedBetween: async (start, end) => {
      calls.push([start, end])
      return start === '2026-05-01T00:00:00.000Z' ? 4 : 1
    },
  })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.values, [4, 1])
  assert.deepEqual(result.chart.rollingAverageValues, [4, (4 + 1) / 2])
  assert.deepEqual(result.windowBounds, { min: 1, max: 2, default: 2 })
  assert.deepEqual(result.weeklyCounts, [4, 1])
  assert.equal(calls.length, 2)
})

test('loadMatchesPerWeekTile includes rolling averages when at least three weeks', async () => {
  const result = await loadMatchesPerWeekTile({
    buildWeekBuckets: () => [
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
    ],
    countMatchOutcomesCreatedBetween: async () => 1,
  })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.rollingAverageValues, [1, 1, 1])
  assert.deepEqual(result.windowBounds, { min: 1, max: 3, default: 3 })
})

test('loadMatchesPerWeekTile returns error when weekly total is zero', async () => {
  const result = await loadMatchesPerWeekTile({
    buildWeekBuckets: () => [
      {
        startInclusive: '2026-05-01T00:00:00.000Z',
        endExclusive: '2026-05-08T00:00:00.000Z',
        label: 'May 1',
      },
    ],
    countMatchOutcomesCreatedBetween: async () => 0,
  })
  assert.deepEqual(result, { status: 'error' })
})
