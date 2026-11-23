'use strict'
// A synthetic rules corpus covering every name a set of builds (and the fixed action tables) asks for.
// It exercises assembly paths without needing the real Foundry corpus; the real corpus is used by
// scripts/critcrafter-regenerate-fixtures.mjs.
const { entry } = require('./memoryStore')
const { collectRequests } = require('../assemble')
const { nameKey } = require('../nameKey')

function syntheticCorpus(builds) {
  const docs = new Map()
  const add = (type, name, over) => {
    const k = `${type}|${nameKey(name)}`
    if (!docs.has(k)) docs.set(k, entry(type, name, over))
  }
  for (const build of builds) {
    for (const w of build.weapons || []) {
      add('equipment', w.name, {
        bulk: 0.1,
        price: { gp: 1 },
        traits: ['agile'],
        item: { itemType: 'weapon', category: 'simple', group: 'knife', usage: 'held-in-one-hand', range: null, acBonus: null, dexCap: null, hardness: null, hp: null },
      })
    }
    for (const a of build.armor || []) {
      const shield = a.prof === 'shield'
      add('equipment', a.name, {
        bulk: shield ? 1 : 'L' === a.prof ? 0.1 : 1,
        price: { gp: 5 },
        item: { itemType: shield ? 'shield' : 'armor', category: a.prof, group: null, usage: null, range: null, acBonus: shield ? 2 : 1, dexCap: shield ? null : 3, hardness: shield ? 5 : null, hp: shield ? 20 : null },
      })
    }
    for (const [i, e] of (build.equipment || []).entries()) {
      if (Array.isArray(e) && typeof e[0] === 'string' && e[0] !== '') {
        add('equipment', e[0], {
          bulk: i % 3 === 0 ? 0.1 : i % 3 === 1 ? 0 : 1,
          item: { itemType: i % 4 === 0 ? 'consumable' : 'equipment', category: null, group: null, usage: null, range: null, acBonus: null, dexCap: null, hardness: null, hp: null },
        })
      }
    }
    for (const { name, types } of collectRequests(build)) {
      if (types[0] === 'equipment') continue
      const len = name.length
      if (types[0] === 'spell') {
        add('spell', name, { spell: { rank: len % 4, defense: null, duration: null, area: null, range: '30 feet', time: '2', traditions: [], ritual: false } })
      } else if (types[0] === 'action') {
        add('action', name, { actionType: 'action', actions: (len % 3) + 1 })
      } else if (types[0] === 'heritage') {
        add('heritage', name, { level: 0 })
      } else if (types[0] === 'classFeature') {
        add('classFeature', name, { level: len % 5, actionType: len % 4 === 0 ? 'action' : 'passive', actions: len % 4 === 0 ? 1 : null })
      } else {
        add('feat', name, { level: len % 10, actionType: len % 2 === 0 ? 'reaction' : 'passive' })
      }
    }
  }
  return [...docs.values()]
}

module.exports = { syntheticCorpus }
