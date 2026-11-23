'use strict'
// Firestore (Admin SDK) implementation of the corpus store contract used by resolve.js.
// Collection and document names match scripts/critcrafter-ingest-lib.mjs.
const ENTRIES = 'rulesEntries'
const META = 'rulesMeta'
const META_DOC = 'current'

function firestoreStore(db) {
  const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, data: d.data() }))
  return {
    async byNameKeys(keys) {
      return docsOf(await db.collection(ENTRIES).where('nameKey', 'in', keys).get())
    },
    async byAliases(keys) {
      return docsOf(await db.collection(ENTRIES).where('aliases', 'array-contains-any', keys).get())
    },
    async meta() {
      const snap = await db.collection(META).doc(META_DOC).get()
      return snap.exists ? snap.data() : null
    },
  }
}

module.exports = { firestoreStore }
