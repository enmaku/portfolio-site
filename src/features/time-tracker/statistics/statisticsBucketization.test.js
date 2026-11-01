import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBuckets,
  chooseBucketUnit,
  quantizeBucketKey,
} from './statisticsBucketization.js'

const DAY = new Date(2026, 8, 16, 15, 0, 0, 0).getTime()

test('chooseBucketUnit picks a subdivision from the span', () => {
  const hours = 60 * 60 * 1000
  assert.equal(chooseBucketUnit({ startMs: 0, endMs: 2 * 24 * hours }), 'hour')
  assert.equal(chooseBucketUnit({ startMs: 0, endMs: 2 * 24 * hours + 1 }), 'day')
  assert.equal(chooseBucketUnit({ startMs: 0, endMs: 62 * 24 * hours }), 'day')
  assert.equal(chooseBucketUnit({ startMs: 0, endMs: 63 * 24 * hours }), 'month')
  assert.equal(chooseBucketUnit({ startMs: 0, endMs: 700 * 24 * hours }), 'month')
  assert.equal(chooseBucketUnit({ startMs: 0, endMs: 800 * 24 * hours }), 'year')
})

test('quantizeBucketKey floors to the containing hour, day, month, and year', () => {
  assert.equal(quantizeBucketKey(DAY, 'hour'), new Date(2026, 8, 16, 15, 0, 0, 0).getTime())
  assert.equal(quantizeBucketKey(DAY, 'day'), new Date(2026, 8, 16, 0, 0, 0, 0).getTime())
  assert.equal(quantizeBucketKey(DAY, 'month'), new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
  assert.equal(quantizeBucketKey(DAY, 'year'), new Date(2026, 0, 1, 0, 0, 0, 0).getTime())
})

test('hourly buckets are clock-aligned and clip to the range', () => {
  const startMs = new Date(2026, 8, 16, 15, 37, 0, 0).getTime()
  const endMs = new Date(2026, 8, 16, 17, 12, 0, 0).getTime()
  const buckets = buildBuckets({ startMs, endMs, unit: 'hour' })
  assert.equal(buckets.keys.length, 3)
  assert.deepEqual(buckets.keys, [
    new Date(2026, 8, 16, 15, 0, 0, 0).getTime(),
    new Date(2026, 8, 16, 16, 0, 0, 0).getTime(),
    new Date(2026, 8, 16, 17, 0, 0, 0).getTime(),
  ])
  assert.deepEqual(buckets.bucketStartMs, [startMs, new Date(2026, 8, 16, 16, 0, 0, 0).getTime(), new Date(2026, 8, 16, 17, 0, 0, 0).getTime()])
  assert.deepEqual(buckets.labels, ['3 PM', '4 PM', '5 PM'])
})

test('a rolling 24 hour window yields 25 clock-hour buckets with partial ends', () => {
  const startMs = DAY - 24 * 60 * 60 * 1000
  const buckets = buildBuckets({ startMs, endMs: DAY, unit: 'hour' })
  assert.equal(buckets.keys.length, 25)
  assert.equal(buckets.bucketStartMs[0], startMs)
})

test('daily buckets cover a calendar week and label month days', () => {
  const buckets = buildBuckets({
    startMs: new Date(2026, 8, 14, 0, 0, 0, 0).getTime(),
    endMs: new Date(2026, 8, 20, 23, 59, 59, 999).getTime(),
    unit: 'day',
  })
  assert.equal(buckets.keys.length, 7)
  assert.deepEqual(buckets.labels, ['Sep 14', 'Sep 15', 'Sep 16', 'Sep 17', 'Sep 18', 'Sep 19', 'Sep 20'])
})

test('daily buckets follow calendar days across a DST boundary', () => {
  const buckets = buildBuckets({
    startMs: new Date(2026, 2, 7, 0, 0, 0, 0).getTime(),
    endMs: new Date(2026, 2, 10, 23, 59, 59, 999).getTime(),
    unit: 'day',
  })
  assert.deepEqual(
    buckets.keys.map((key) => new Date(key).getDate()),
    [7, 8, 9, 10],
  )
  for (const key of buckets.keys) {
    assert.equal(new Date(key).getHours(), 0)
  }
})

test('monthly buckets span a year and mark January with its year', () => {
  const buckets = buildBuckets({
    startMs: new Date(2025, 10, 1, 0, 0, 0, 0).getTime(),
    endMs: new Date(2026, 1, 28, 23, 59, 59, 999).getTime(),
    unit: 'month',
  })
  assert.equal(buckets.keys.length, 4)
  assert.deepEqual(buckets.labels, ['Nov', 'Dec', 'Jan 2026', 'Feb'])
})

test('yearly buckets label each year', () => {
  const buckets = buildBuckets({
    startMs: new Date(2024, 5, 1).getTime(),
    endMs: new Date(2026, 5, 1).getTime(),
    unit: 'year',
  })
  assert.equal(buckets.keys.length, 3)
  assert.deepEqual(buckets.labels, ['2024', '2025', '2026'])
})

test('titles carry the full bucket label for tooltips', () => {
  const buckets = buildBuckets({
    startMs: new Date(2026, 8, 16, 15, 0, 0, 0).getTime(),
    endMs: new Date(2026, 8, 16, 15, 59, 59, 999).getTime(),
    unit: 'hour',
  })
  assert.deepEqual(buckets.titles, ['Sep 16, 3 PM'])
})
