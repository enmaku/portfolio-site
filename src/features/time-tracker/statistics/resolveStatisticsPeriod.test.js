import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveStatisticsPeriod } from './resolveStatisticsPeriod.js'

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

test('all preset is unbounded', () => {
  const result = resolveStatisticsPeriod({ preset: 'all' })
  assert.equal(result.ok, true)
  assert.equal(result.startMs, Number.NEGATIVE_INFINITY)
  assert.equal(result.endMs, Number.POSITIVE_INFINITY)
})
