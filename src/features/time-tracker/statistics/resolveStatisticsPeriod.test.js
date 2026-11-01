import assert from 'node:assert/strict'
import test from 'node:test'
import { fixedBucketUnitForPreset, resolveStatisticsPeriod } from './resolveStatisticsPeriod.js'

const wednesday = new Date(2026, 8, 16, 15, 0, 0, 0).getTime()

test('month preset spans the current local calendar month', () => {
  const result = resolveStatisticsPeriod({ preset: 'month', now: wednesday })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
  assert.equal(result.endMs, new Date(2026, 8, 30, 23, 59, 59, 999).getTime())
})

test('week preset spans monday through sunday containing now', () => {
  const result = resolveStatisticsPeriod({ preset: 'week', now: wednesday })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, new Date(2026, 8, 14, 0, 0, 0, 0).getTime())
  assert.equal(result.endMs, new Date(2026, 8, 20, 23, 59, 59, 999).getTime())
})

test('year preset spans the current local calendar year', () => {
  const result = resolveStatisticsPeriod({ preset: 'year', now: wednesday })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, new Date(2026, 0, 1, 0, 0, 0, 0).getTime())
  assert.equal(result.endMs, new Date(2026, 11, 31, 23, 59, 59, 999).getTime())
})

test('custom preset is inclusive and rejects end before start', () => {
  const start = new Date(2026, 8, 10).getTime()
  const end = new Date(2026, 8, 12).getTime()
  const ok = resolveStatisticsPeriod({ preset: 'custom', customStartMs: start, customEndMs: end })
  assert.equal(ok.ok, true)
  assert.equal(ok.startMs, new Date(2026, 8, 10, 0, 0, 0, 0).getTime())
  assert.equal(ok.endMs, new Date(2026, 8, 12, 23, 59, 59, 999).getTime())
  const bad = resolveStatisticsPeriod({
    preset: 'custom',
    customStartMs: end,
    customEndMs: start,
  })
  assert.equal(bad.ok, false)
})

test('day preset spans the whole local day containing now', () => {
  const result = resolveStatisticsPeriod({ preset: 'day', now: wednesday })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, new Date(2026, 8, 16, 0, 0, 0, 0).getTime())
  assert.equal(result.endMs, new Date(2026, 8, 16, 23, 59, 59, 999).getTime())
})

test('last24h is a rolling window ending at now', () => {
  const result = resolveStatisticsPeriod({ preset: 'last24h', now: wednesday })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, wednesday - 24 * 60 * 60 * 1000)
  assert.equal(result.endMs, wednesday)
})

test('last7d and last30d end at end of today and start on a whole day', () => {
  const seven = resolveStatisticsPeriod({ preset: 'last7d', now: wednesday })
  assert.equal(seven.startMs, new Date(2026, 8, 10, 0, 0, 0, 0).getTime())
  assert.equal(seven.endMs, new Date(2026, 8, 16, 23, 59, 59, 999).getTime())

  const thirty = resolveStatisticsPeriod({ preset: 'last30d', now: wednesday })
  assert.equal(thirty.startMs, new Date(2026, 7, 18, 0, 0, 0, 0).getTime())
  assert.equal(thirty.endMs, new Date(2026, 8, 16, 23, 59, 59, 999).getTime())
})

test('all time spans the earliest entry to now', () => {
  const earliest = new Date(2025, 2, 3, 9, 30, 0, 0).getTime()
  const result = resolveStatisticsPeriod({
    preset: 'all',
    now: wednesday,
    earliestEntryStartMs: earliest,
  })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, earliest)
  assert.equal(result.endMs, wednesday)
})

test('all time without entries is unbounded', () => {
  const result = resolveStatisticsPeriod({ preset: 'all', now: wednesday })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, Number.NEGATIVE_INFINITY)
  assert.equal(result.endMs, Number.POSITIVE_INFINITY)
})

test('fixed presets pin their subdivision and span-decided presets do not', () => {
  assert.equal(fixedBucketUnitForPreset('day'), 'hour')
  assert.equal(fixedBucketUnitForPreset('last24h'), 'hour')
  assert.equal(fixedBucketUnitForPreset('week'), 'day')
  assert.equal(fixedBucketUnitForPreset('last7d'), 'day')
  assert.equal(fixedBucketUnitForPreset('month'), 'day')
  assert.equal(fixedBucketUnitForPreset('last30d'), 'day')
  assert.equal(fixedBucketUnitForPreset('year'), 'month')
  assert.equal(fixedBucketUnitForPreset('all'), null)
  assert.equal(fixedBucketUnitForPreset('custom'), null)
})
