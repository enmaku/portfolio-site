import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchOutcomeBreakdownChart } from './buildMatchOutcomeBreakdownChart.js'

test('buildMatchOutcomeBreakdownChart maps counts to whole-percent shares', () => {
  const result = buildMatchOutcomeBreakdownChart([
    { key: 'victory', count: 5 },
    { key: 'defeat-not-eliminated', count: 3 },
    { key: 'elimination-end-human', count: 2 },
  ])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.chart.keys, [
    'victory',
    'defeat-not-eliminated',
    'elimination-end-human',
  ])
  assert.deepEqual(result.chart.counts, [5, 3, 2])
  assert.deepEqual(result.chart.percents, [50, 30, 20])
  assert.equal(result.chart.total, 10)
})

test('buildMatchOutcomeBreakdownChart returns error for empty or invalid rows', () => {
  assert.deepEqual(buildMatchOutcomeBreakdownChart([]), { status: 'error' })
  assert.deepEqual(buildMatchOutcomeBreakdownChart([{ key: 'victory', count: -1 }]), {
    status: 'error',
  })
  assert.deepEqual(buildMatchOutcomeBreakdownChart([{ key: 'victory', count: 0 }]), {
    status: 'error',
  })
})
