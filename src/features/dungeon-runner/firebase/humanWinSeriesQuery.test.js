import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchHumanWinSeries } from './humanWinSeriesQuery.js'

const fakeDb = { kind: 'firestore' }

test('fetchHumanWinSeries queries recent outcomes with projected fields and oldest-first order', async () => {
  /** @type {unknown[]} */
  const queryArgs = []
  const docs = [
    { data: () => ({ humanWon: false, createdAt: { seconds: 3 } }) },
    { data: () => ({ humanWon: true, createdAt: { seconds: 2 } }) },
    { data: () => ({ humanWon: true, createdAt: { seconds: 1 } }) },
  ]

  const series = await fetchHumanWinSeries({
    getFirestore: () => fakeDb,
    collection: (_db, name) => {
      assert.equal(name, 'dungeonRunnerMatchOutcomes')
      return { kind: 'collection' }
    },
    query: (...args) => {
      queryArgs.push(args)
      return { kind: 'query' }
    },
    orderBy: (field, direction) => {
      assert.equal(field, 'createdAt')
      assert.equal(direction, 'desc')
      return { kind: 'orderBy' }
    },
    limit: (count) => {
      assert.equal(count, 500)
      return { kind: 'limit' }
    },
    getDocs: async () => ({ docs }),
  })

  assert.deepEqual(series, [
    { humanWon: true, createdAt: { seconds: 1 } },
    { humanWon: true, createdAt: { seconds: 2 } },
    { humanWon: false, createdAt: { seconds: 3 } },
  ])
  assert.equal(queryArgs.length, 1)
})

test('fetchHumanWinSeries throws when Firestore is unavailable', async () => {
  await assert.rejects(
    () =>
      fetchHumanWinSeries({
        getFirestore: () => null,
      }),
    /not configured/,
  )
})
