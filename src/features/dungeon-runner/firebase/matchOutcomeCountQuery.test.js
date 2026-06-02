import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countAllMatchOutcomes,
  countMatchOutcomesWhere,
} from './matchOutcomeCountQuery.js'

const fakeDb = { kind: 'firestore' }

test('countAllMatchOutcomes returns aggregate count from getCountFromServer', async () => {
  let countTarget = null
  const result = await countAllMatchOutcomes({
    getFirestore: () => fakeDb,
    collection: (_db, name) => {
      assert.equal(name, 'dungeonRunnerMatchOutcomes')
      return { kind: 'collection' }
    },
    getCountFromServer: async (target) => {
      countTarget = target
      return { data: () => ({ count: 42 }) }
    },
  })
  assert.equal(result, 42)
  assert.deepEqual(countTarget, { kind: 'collection' })
})

test('countAllMatchOutcomes rejects when getCountFromServer fails', async () => {
  await assert.rejects(
    () =>
      countAllMatchOutcomes({
        getFirestore: () => fakeDb,
        collection: () => ({ kind: 'collection' }),
        getCountFromServer: async () => {
          throw new Error('network')
        },
      }),
    /network/,
  )
})

test('countMatchOutcomesWhere applies field equality filter', async () => {
  /** @type {unknown[]} */
  const whereArgs = []
  let countTarget = null
  const result = await countMatchOutcomesWhere('humanWon', true, {
    getFirestore: () => fakeDb,
    collection: (_db, name) => {
      assert.equal(name, 'dungeonRunnerMatchOutcomes')
      return { kind: 'collection' }
    },
    where: (...args) => {
      whereArgs.push(args)
      return { kind: 'where' }
    },
    query: (coll, filter) => {
      assert.deepEqual(coll, { kind: 'collection' })
      assert.deepEqual(filter, { kind: 'where' })
      return { kind: 'query' }
    },
    getCountFromServer: async (target) => {
      countTarget = target
      return { data: () => ({ count: 7 }) }
    },
  })
  assert.equal(result, 7)
  assert.deepEqual(whereArgs, [['humanWon', '==', true]])
  assert.deepEqual(countTarget, { kind: 'query' })
})

test('countAllMatchOutcomes throws when Firestore is unavailable', async () => {
  await assert.rejects(
    () =>
      countAllMatchOutcomes({
        getFirestore: () => null,
      }),
    /not configured/,
  )
})
