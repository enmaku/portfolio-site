import assert from 'node:assert/strict'
import test from 'node:test'
import { loadHumanEliminatedRateTile } from './humanEliminatedRateLoader.js'

test('loadHumanEliminatedRateTile returns ok with formatted rate from independent counts', async () => {
  const calls = []
  const result = await loadHumanEliminatedRateTile({
    countMatchOutcomesWhere: async (field, value) => {
      calls.push(['where', field, value])
      return 1
    },
    countAllMatchOutcomes: async () => {
      calls.push(['all'])
      return 4
    },
  })
  assert.deepEqual(result, { status: 'ok', value: '25%' })
  assert.deepEqual(calls, [
    ['where', 'humanEliminated', true],
    ['all'],
  ])
})

test('loadHumanEliminatedRateTile returns error when total count is zero', async () => {
  const result = await loadHumanEliminatedRateTile({
    countMatchOutcomesWhere: async () => 0,
    countAllMatchOutcomes: async () => 0,
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadHumanEliminatedRateTile returns error when count queries fail', async () => {
  const failing = loadHumanEliminatedRateTile({
    countMatchOutcomesWhere: async () => {
      throw new Error('firestore')
    },
    countAllMatchOutcomes: async () => 10,
  })
  const failingAll = loadHumanEliminatedRateTile({
    countMatchOutcomesWhere: async () => 1,
    countAllMatchOutcomes: async () => {
      throw new Error('firestore')
    },
  })
  assert.deepEqual(await failing, { status: 'error' })
  assert.deepEqual(await failingAll, { status: 'error' })
})
