import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchMatchLengthSeries,
  MATCH_LENGTH_SERIES_FETCH_LIMIT,
} from './matchLengthSeriesQuery.js'

const fakeDb = { kind: 'firestore' }

test('fetchMatchLengthSeries queries recent outcomes and returns oldest first', async () => {
  let limitValue = null
  const result = await fetchMatchLengthSeries({
    getFirestore: () => fakeDb,
    collection: (_db, name) => {
      assert.equal(name, 'dungeonRunnerMatchOutcomes')
      return { kind: 'collection' }
    },
    orderBy: (field, direction) => {
      assert.equal(field, 'createdAt')
      assert.equal(direction, 'desc')
      return { kind: 'orderBy' }
    },
    limit: (value) => {
      limitValue = value
      return { kind: 'limit' }
    },
    query: (coll, order, lim) => {
      assert.deepEqual(coll, { kind: 'collection' })
      return { kind: 'query', order, lim }
    },
    getDocs: async () => ({
      docs: [
        {
          data: () => ({
            createdAt: '2026-05-02T00:00:00.000Z',
            historyStepCount: 20,
          }),
        },
        {
          data: () => ({
            createdAt: 'invalid',
            historyStepCount: 5,
          }),
        },
        {
          data: () => ({
            createdAt: '2026-05-01T00:00:00.000Z',
            historyStepCount: 10,
          }),
        },
      ],
    }),
  })
  assert.equal(limitValue, MATCH_LENGTH_SERIES_FETCH_LIMIT)
  assert.deepEqual(result, [
    { createdAt: '2026-05-01T00:00:00.000Z', historyStepCount: 10 },
    { createdAt: '2026-05-02T00:00:00.000Z', historyStepCount: 20 },
  ])
})
