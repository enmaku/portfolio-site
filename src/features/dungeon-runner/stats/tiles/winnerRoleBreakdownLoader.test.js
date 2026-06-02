import assert from 'node:assert/strict'
import test from 'node:test'
import { WINNER_ROLE_BREAKDOWN_TYPES } from './winnerRoleBreakdownLoader.js'
import { loadWinnerRoleBreakdownTile } from './winnerRoleBreakdownLoader.js'

test('loadWinnerRoleBreakdownTile returns ok with counts for all winner role types', async () => {
  const calls = []
  const result = await loadWinnerRoleBreakdownTile({
    countMatchOutcomesWhere: async (field, value) => {
      calls.push([field, value])
      const counts = { human: 4, nn: 6, randombot: 1 }
      return counts[value] ?? 0
    },
  })

  assert.equal(result.status, 'ok')
  assert.deepEqual(
    result.breakdown.map((row) => row.key),
    WINNER_ROLE_BREAKDOWN_TYPES,
  )
  assert.deepEqual(
    result.breakdown.map((row) => row.count),
    [4, 6, 1],
  )
  assert.deepEqual(
    calls,
    [
      ['winnerRole.type', 'human'],
      ['winnerRole.type', 'nn'],
      ['winnerRole.type', 'randombot'],
    ],
  )
})

test('loadWinnerRoleBreakdownTile returns error when total count is zero', async () => {
  const result = await loadWinnerRoleBreakdownTile({
    countMatchOutcomesWhere: async () => 0,
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadWinnerRoleBreakdownTile returns error when a count query fails', async () => {
  const result = await loadWinnerRoleBreakdownTile({
    countMatchOutcomesWhere: async (_field, value) => {
      if (value === 'nn') {
        throw new Error('firestore')
      }
      return 1
    },
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadWinnerRoleBreakdownTile forwards countQueryDeps to count API', async () => {
  const queryDeps = { kind: 'count-query-deps' }
  let receivedDeps = null
  const result = await loadWinnerRoleBreakdownTile({
    countQueryDeps: queryDeps,
    countMatchOutcomesWhere: async (_field, _value, deps) => {
      receivedDeps = deps
      return 1
    },
  })
  assert.equal(result.status, 'ok')
  assert.equal(receivedDeps, queryDeps)
})
