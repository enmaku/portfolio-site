import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_OVER_END_VARIANTS } from '../../ui/humanEliminationCompletionPolicy.js'
import { loadEndVariantBreakdownTile } from './endVariantBreakdownLoader.js'

test('loadEndVariantBreakdownTile returns ok with counts for all end variants', async () => {
  const calls = []
  const result = await loadEndVariantBreakdownTile({
    countMatchOutcomesWhere: async (field, value) => {
      calls.push([field, value])
      const counts = {
        [MATCH_OVER_END_VARIANTS.VICTORY]: 5,
        [MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED]: 3,
        [MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN]: 2,
      }
      return counts[value] ?? 0
    },
  })

  assert.equal(result.status, 'ok')
  assert.deepEqual(
    result.breakdown.map((row) => row.key),
    [
      MATCH_OVER_END_VARIANTS.VICTORY,
      MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED,
      MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN,
    ],
  )
  assert.deepEqual(
    result.breakdown.map((row) => row.count),
    [5, 3, 2],
  )
  assert.deepEqual(
    calls,
    [
      ['endVariant', MATCH_OVER_END_VARIANTS.VICTORY],
      ['endVariant', MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED],
      ['endVariant', MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN],
    ],
  )
})

test('loadEndVariantBreakdownTile returns error when total count is zero', async () => {
  const result = await loadEndVariantBreakdownTile({
    countMatchOutcomesWhere: async () => 0,
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadEndVariantBreakdownTile returns error when a count query fails', async () => {
  const result = await loadEndVariantBreakdownTile({
    countMatchOutcomesWhere: async (_field, value) => {
      if (value === MATCH_OVER_END_VARIANTS.VICTORY) {
        throw new Error('firestore')
      }
      return 1
    },
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadEndVariantBreakdownTile forwards countQueryDeps to count API', async () => {
  const queryDeps = { kind: 'count-query-deps' }
  let receivedDeps = null
  const result = await loadEndVariantBreakdownTile({
    countQueryDeps: queryDeps,
    countMatchOutcomesWhere: async (_field, _value, deps) => {
      receivedDeps = deps
      return 1
    },
  })
  assert.equal(result.status, 'ok')
  assert.equal(receivedDeps, queryDeps)
})
