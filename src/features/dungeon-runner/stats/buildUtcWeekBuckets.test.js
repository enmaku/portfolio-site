import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildUtcWeekBuckets,
  formatUtcWeekAxisLabel,
  MS_PER_WEEK,
  startOfUtcWeekMs,
} from './buildUtcWeekBuckets.js'

test('startOfUtcWeekMs aligns to Monday 00:00 UTC', () => {
  const wednesday = Date.parse('2026-06-03T15:00:00.000Z')
  const monday = startOfUtcWeekMs(wednesday)
  assert.equal(new Date(monday).toISOString(), '2026-06-01T00:00:00.000Z')
})

test('buildUtcWeekBuckets returns consecutive weeks oldest first', () => {
  const nowMs = Date.parse('2026-06-03T12:00:00.000Z')
  const buckets = buildUtcWeekBuckets({ nowMs, weekCount: 3 })
  assert.equal(buckets.length, 3)
  assert.equal(buckets[0].label, formatUtcWeekAxisLabel(startOfUtcWeekMs(nowMs) - 2 * MS_PER_WEEK))
  assert.equal(
    Date.parse(buckets[1].endExclusive) - Date.parse(buckets[1].startInclusive),
    MS_PER_WEEK,
  )
})
