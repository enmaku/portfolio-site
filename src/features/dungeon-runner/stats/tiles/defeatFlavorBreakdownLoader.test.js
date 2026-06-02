import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_OVER_END_VARIANTS } from '../../ui/humanEliminationCompletionPolicy.js'
import {
  DEFEAT_FLAVOR_BREAKDOWN_KEYS,
  loadDefeatFlavorBreakdownTile,
} from './defeatFlavorBreakdownLoader.js'

test('loadDefeatFlavorBreakdownTile returns ok with defeat-only variants', async () => {
  const result = await loadDefeatFlavorBreakdownTile({
    countMatchOutcomesWhere: async (_field, value) => {
      const counts = {
        [MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED]: 3,
        [MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN]: 2,
      }
      return counts[value] ?? 0
    },
  })
  assert.equal(result.status, 'ok')
  assert.deepEqual(
    result.breakdown.map((row) => row.key),
    [...DEFEAT_FLAVOR_BREAKDOWN_KEYS],
  )
  assert.deepEqual(
    result.breakdown.map((row) => row.count),
    [3, 2],
  )
})

test('loadDefeatFlavorBreakdownTile returns error when no defeats exist', async () => {
  const result = await loadDefeatFlavorBreakdownTile({
    countMatchOutcomesWhere: async () => 0,
  })
  assert.deepEqual(result, { status: 'error' })
})
