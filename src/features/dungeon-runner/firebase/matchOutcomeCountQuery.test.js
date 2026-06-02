import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countAllMatchOutcomes,
  countMatchOutcomesCreatedBetween,
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

test('countMatchOutcomesCreatedBetween applies createdAt range filters', async () => {
  /** @type {unknown[]} */
  const whereArgs = []
  const result = await countMatchOutcomesCreatedBetween(
    '2026-05-01T00:00:00.000Z',
    '2026-05-08T00:00:00.000Z',
    {
      getFirestore: () => fakeDb,
      collection: () => ({ kind: 'collection' }),
      where: (...args) => {
        whereArgs.push(args)
        return { kind: `where-${whereArgs.length}` }
      },
      query: (_coll, ...filters) => ({ kind: 'query', filters }),
      getCountFromServer: async () => ({ data: () => ({ count: 9 }) }),
    },
  )
  assert.equal(result, 9)
  assert.deepEqual(whereArgs, [
    ['createdAt', '>=', '2026-05-01T00:00:00.000Z'],
    ['createdAt', '<', '2026-05-08T00:00:00.000Z'],
  ])
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
