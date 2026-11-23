'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { entry, memoryStore } = require('./test/memoryStore')
const { createResolver, parseScrollOrWand } = require('./resolve')

const spell = (name, rank, over = {}) =>
  entry('spell', name, {
    level: rank,
    spell: { rank, defense: null, duration: null, area: null, range: null, time: '2', traditions: [], ritual: false },
    ...over,
  })

function resolverFor(docs, opts) {
  const store = memoryStore(docs)
  return { store, resolver: createResolver({ store, ...opts }) }
}

test('exact nameKey match wins, ignoring case, punctuation and apostrophes', async () => {
  const { resolver } = resolverFor([entry('equipment', "Explorer's Clothing")])
  await resolver.prefetch([{ name: 'explorers  CLOTHING' }])
  const hit = resolver.resolve('explorers  CLOTHING')
  assert.equal(hit.entry.id, 'equipment:explorers-clothing')
  assert.equal(hit.via, 'exact')
})

test('an alias resolves when there is no exact match, and exact beats alias', async () => {
  const { resolver } = resolverFor([
    entry('spell', 'Acid Grip', { aliases: ['Acid Arrow'] }),
    entry('spell', 'Acid Arrow', { id: 'spell:acid-arrow-old', remaster: false }),
    entry('equipment', 'Repair Toolkit', { aliases: ['Repair Kit'] }),
  ])
  await resolver.prefetch([{ name: 'Repair Kit' }, { name: 'Acid Arrow' }])
  const alias = resolver.resolve('Repair Kit')
  assert.equal(alias.entry.data.name, 'Repair Toolkit')
  assert.equal(alias.via, 'alias')
  assert.equal(resolver.resolve('Acid Arrow').entry.id, 'spell:acid-arrow-old')
})

test('the label table: a Pathbuilder label resolves via its alias', async () => {
  const { resolver } = resolverFor([entry('feat', 'Edgewatch Detective Dedication', { aliases: ['Detective Dedication'] })])
  await resolver.prefetch([{ name: 'Detective Dedication', types: ['feat'] }])
  assert.equal(resolver.resolve('Detective Dedication', ['feat']).entry.data.name, 'Edgewatch Detective Dedication')
})

test('a miss returns null', async () => {
  const { resolver } = resolverFor([])
  await resolver.prefetch([{ name: 'Nothing Here' }])
  assert.equal(resolver.resolve('Nothing Here'), null)
})

test('ambiguity: the remaster entry wins, then the export field type hint', async () => {
  const docs = [
    entry('feat', 'Shield Block', { id: 'feat:shield-block-legacy', remaster: false }),
    entry('feat', 'Shield Block', { id: 'feat:shield-block' }),
    entry('action', 'Shield Block', { id: 'action:shield-block', remaster: false }),
  ]
  const { resolver } = resolverFor(docs)
  await resolver.prefetch([{ name: 'Shield Block' }])
  assert.equal(resolver.resolve('Shield Block').entry.id, 'feat:shield-block')
  assert.equal(resolver.resolve('Shield Block', ['action']).entry.id, 'action:shield-block')
  assert.equal(resolver.resolve('Shield Block', ['spell']).entry.id, 'feat:shield-block')
})

test('prefetch batches in chunks of at most 30 keys and skips cached names', async () => {
  const names = Array.from({ length: 65 }, (_, i) => `Thing ${i}`)
  const { resolver, store } = resolverFor(names.map((n) => entry('equipment', n)))
  await resolver.prefetch(names.map((name) => ({ name })))
  assert.equal(store.calls.byNameKeys, 3)
  await resolver.prefetch(names.map((name) => ({ name })))
  assert.equal(store.calls.byNameKeys, 3, 'second prefetch is served from the cache')
  assert.equal(store.calls.byAliases, 0, 'no alias query when every name matched exactly')
})

test('the cache is bounded', async () => {
  const names = Array.from({ length: 12 }, (_, i) => `Thing ${i}`)
  const { resolver, store } = resolverFor(names.map((n) => entry('equipment', n)), { cacheMax: 5 })
  await resolver.prefetch(names.map((name) => ({ name })))
  assert.ok(resolver.cacheSize() <= 5)
  const before = store.calls.byNameKeys
  await resolver.prefetch([{ name: 'Thing 0' }])
  assert.ok(store.calls.byNameKeys > before, 'an evicted name is fetched again')
})

test('scroll and wand names split into family and spell, with an optional rank', () => {
  assert.deepEqual(parseScrollOrWand('Scroll of Fireball'), { family: 'scroll', spell: 'Fireball', rank: null })
  assert.deepEqual(parseScrollOrWand('Wand of Heal (3rd-rank)'), { family: 'wand', spell: 'Heal', rank: 3 })
  assert.deepEqual(parseScrollOrWand('Scroll of Heal (Rank 4)'), { family: 'scroll', spell: 'Heal', rank: 4 })
  assert.equal(parseScrollOrWand('Rope'), null)
})

test('Scroll of <Spell> resolves the spell and the generic item by the spell rank, separately', async () => {
  const { resolver } = resolverFor([
    spell('Fireball', 3),
    entry('equipment', 'Scroll of 3rd-rank Spell'),
    entry('equipment', 'Magic Wand (3rd-Rank Spell)'),
  ])
  await resolver.prefetch([{ name: 'Scroll of Fireball' }, { name: 'Wand of Fireball' }])
  const scroll = resolver.resolveItem('Scroll of Fireball', ['equipment'])
  assert.equal(scroll.entry.data.name, 'Scroll of 3rd-rank Spell')
  assert.equal(scroll.linked.name, 'Fireball')
  assert.equal(scroll.linked.rank, 3)
  assert.equal(scroll.linked.entry.data.type, 'spell')
  assert.equal(resolver.resolveItem('Wand of Fireball', ['equipment']).entry.data.name, 'Magic Wand (3rd-Rank Spell)')
})

test('a spell miss makes the whole scroll a miss; an explicit rank heightens the generic item', async () => {
  const { resolver } = resolverFor([spell('Heal', 1), entry('equipment', 'Scroll of 4th-rank Spell')])
  await resolver.prefetch([{ name: 'Scroll of Unknown Spell' }, { name: 'Scroll of Heal (Rank 4)' }])
  assert.equal(resolver.resolveItem('Scroll of Unknown Spell', ['equipment']), null)
  const heal = resolver.resolveItem('Scroll of Heal (Rank 4)', ['equipment'])
  assert.equal(heal.entry.data.name, 'Scroll of 4th-rank Spell')
  assert.equal(heal.linked.rank, 4)
})

test('an exact item match beats the scroll pattern (named wands)', async () => {
  const { resolver } = resolverFor([entry('equipment', 'Wand of Hawthorn (6th-rank)'), spell('Hawthorn', 6)])
  await resolver.prefetch([{ name: 'Wand of Hawthorn (6th-rank)' }])
  const hit = resolver.resolveItem('Wand of Hawthorn (6th-rank)', ['equipment'])
  assert.equal(hit.entry.data.name, 'Wand of Hawthorn (6th-rank)')
  assert.equal(hit.linked, undefined)
})

test('corpusSha comes from rulesMeta/current', async () => {
  const { resolver } = resolverFor([])
  assert.equal(await resolver.corpusSha(), 'a'.repeat(40))
})
