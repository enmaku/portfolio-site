import assert from 'node:assert/strict'
import test from 'node:test'
import { loadHumanWinRateTile } from './humanWinRateLoader.js'

test('loadHumanWinRateTile returns ok with formatted rate from independent counts', async () => {
  const calls = []
  const result = await loadHumanWinRateTile({
    countMatchOutcomesWhere: async (field, value) => {
      calls.push(['where', field, value])
      return 2
    },
    countAllMatchOutcomes: async () => {
      calls.push(['all'])
      return 3
    },
  })
  assert.deepEqual(result, { status: 'ok', value: '67%' })
  assert.deepEqual(calls, [
    ['where', 'humanWon', true],
    ['all'],
  ])
})

test('loadHumanWinRateTile returns error when total count is zero', async () => {
  const result = await loadHumanWinRateTile({
    countMatchOutcomesWhere: async () => 0,
    countAllMatchOutcomes: async () => 0,
  })
  assert.deepEqual(result, { status: 'error' })
})

test('loadHumanWinRateTile returns error when count queries fail', async () => {
  const failing = loadHumanWinRateTile({
    countMatchOutcomesWhere: async () => {
      throw new Error('firestore')
    },
    countAllMatchOutcomes: async () => 10,
  })
  const failingAll = loadHumanWinRateTile({
    countMatchOutcomesWhere: async () => 1,
    countAllMatchOutcomes: async () => {
      throw new Error('firestore')
    },
  })
  assert.deepEqual(await failing, { status: 'error' })
  assert.deepEqual(await failingAll, { status: 'error' })
})
