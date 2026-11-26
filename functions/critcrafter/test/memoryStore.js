'use strict'
// In-memory stand-in for the Firestore corpus store: same contract as store.js, with call counts.
const { nameKey } = require('../nameKey')

/** Build a corpus entry doc the way scripts/critcrafter-ingest-lib.mjs does (only the fields the function reads). */
function entry(type, name, over = {}) {
  const slug = nameKey(name).replace(/ /g, '-')
  const { aliases = [], id, ...rest } = over
  return {
    id: id || `${type}:${slug}`,
    data: {
      name,
      nameKey: nameKey(name),
      type,
      level: null,
      traits: [],
      rarity: 'common',
      actionType: null,
      actions: null,
      bulk: null,
      price: null,
      spell: null,
      description: `<p>${name} text.</p>`,
      aliases: aliases.map(nameKey),
      license: 'ORC',
      remaster: true,
      title: 'Test Book',
      ...rest,
    },
  }
}

function memoryStore(docs, meta = { sha: 'a'.repeat(40) }) {
  const calls = { byNameKeys: 0, byAliases: 0, meta: 0 }
  return {
    calls,
    async byNameKeys(keys) {
      calls.byNameKeys += 1
      if (keys.length > 30) throw new Error('Firestore "in" is limited to 30 values')
      return docs.filter((d) => keys.includes(d.data.nameKey))
    },
    async byAliases(keys) {
      calls.byAliases += 1
      if (keys.length > 30) throw new Error('Firestore array-contains-any is limited to 30 values')
      return docs.filter((d) => d.data.aliases.some((a) => keys.includes(a)))
    },
    async meta() {
      calls.meta += 1
      return meta
    },
  }
}

module.exports = { entry, memoryStore }
