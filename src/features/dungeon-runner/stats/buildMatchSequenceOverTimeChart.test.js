import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchSequenceOverTimeChart } from './buildMatchSequenceOverTimeChart.js'

test('buildMatchSequenceOverTimeChart returns error when values fail custom validation', () => {
  const result = buildMatchSequenceOverTimeChart({
    timelinePoints: [{ createdAt: '2026-05-01T00:00:00.000Z' }],
    values: [-1],
    validateValue: (value) => Number.isFinite(value) && value >= 0,
  })
  assert.equal(result.status, 'error')
})

test('buildMatchSequenceOverTimeChart returns error for length mismatch', () => {
  const result = buildMatchSequenceOverTimeChart({
    timelinePoints: [{ createdAt: '2026-05-01T00:00:00.000Z' }, { createdAt: '2026-05-02T00:00:00.000Z' }],
    values: [1],
  })
  assert.equal(result.status, 'error')
})
