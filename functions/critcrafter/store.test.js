'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { firestoreStore } = require('./store')
const { verifyAppCheckToken } = require('./appCheck')

function fakeDb() {
  const queries = []
  const snap = (docs) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) })
  return {
    queries,
    collection(name) {
      return {
        where(field, op, value) {
          return {
            async get() {
              queries.push({ name, field, op, value })
              return snap([{ id: 'feat:x', data: { nameKey: 'x', aliases: [] } }])
            },
          }
        },
        doc(id) {
          return {
            async get() {
              queries.push({ name, doc: id })
              return { exists: true, data: () => ({ sha: 'b'.repeat(40) }) }
            },
          }
        },
      }
    },
  }
}

test('the Firestore store queries rulesEntries by nameKey (in) and aliases (array-contains-any)', async () => {
  const db = fakeDb()
  const store = firestoreStore(db)
  assert.deepEqual(await store.byNameKeys(['a', 'b']), [{ id: 'feat:x', data: { nameKey: 'x', aliases: [] } }])
  await store.byAliases(['a'])
  assert.deepEqual(db.queries, [
    { name: 'rulesEntries', field: 'nameKey', op: 'in', value: ['a', 'b'] },
    { name: 'rulesEntries', field: 'aliases', op: 'array-contains-any', value: ['a'] },
  ])
})

test('the store reads rulesMeta/current', async () => {
  const db = fakeDb()
  assert.deepEqual(await firestoreStore(db).meta(), { sha: 'b'.repeat(40) })
  assert.deepEqual(db.queries, [{ name: 'rulesMeta', doc: 'current' }])
})

test('App Check: no token fails, a token the verifier rejects fails, a verified token passes', async () => {
  const req = (t) => ({ header: () => t })
  const ok = { appCheck: () => ({ verifyToken: async () => ({}) }) }
  const bad = { appCheck: () => ({ verifyToken: async () => { throw new Error('nope') } }) }
  assert.equal(await verifyAppCheckToken(req(undefined), ok), false)
  assert.equal(await verifyAppCheckToken(req('t'), bad), false)
  assert.equal(await verifyAppCheckToken(req('t'), ok), true)
})
