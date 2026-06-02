import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTotalMatchesTile } from './totalMatchesLoader.js'

test('loadTotalMatchesTile returns ok with positive count', async () => {
  const result = await loadTotalMatchesTile({
    countAllMatchOutcomes: async () => 12,
  })
  assert.deepEqual(result, { status: 'ok', value: 12 })
})

test('loadTotalMatchesTile returns error when count is zero', async () => {
  const result = await loadTotalMatchesTile({
    countAllMatchOutcomes: async () => 0,
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadTotalMatchesTile returns error when count is not a positive finite number', async () => {
  for (const count of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = await loadTotalMatchesTile({
      countAllMatchOutcomes: async () => count,
    })
    assert.deepEqual(result, { status: 'error' })
  }
})

test('loadTotalMatchesTile returns error when count query fails', async () => {
  const result = await loadTotalMatchesTile({
    countAllMatchOutcomes: async () => {
      throw new Error('firestore')
    },
  })
  assert.deepEqual(result, { status: 'error' })
})
