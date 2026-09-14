import assert from 'node:assert/strict'
import test from 'node:test'
import {
  queryWouldSearch,
  topRankedCatalogDocs,
  typingQueriesFromTitle,
  uniqueTypingQueriesForTopGames,
} from './lib/bggSeedTopSearches.mjs'

test('typingQueriesFromTitle grows Last Will as last then last will', () => {
  assert.deepEqual(typingQueriesFromTitle('Last Will'), ['last', 'last will'])
})

test('typingQueriesFromTitle grows a longer title word by word', () => {
  assert.deepEqual(typingQueriesFromTitle('longer game title here'), [
    'longer',
    'longer game',
    'longer game title',
    'longer game title here',
  ])
})

test('typingQueriesFromTitle skips a leading stopword-only prefix', () => {
  const queries = typingQueriesFromTitle('The Lord of the Rings')
  assert.ok(!queries.includes('the'))
  assert.ok(queries.includes('the lord'))
  assert.ok(queries.includes('the lord of the rings'))
  assert.ok(!queries.includes('lord'))
})

test('typingQueriesFromTitle falls back when the title starts with a 1-char token', () => {
  assert.deepEqual(typingQueriesFromTitle('7 Wonders Duel'), ['wonders', 'wonders duel'])
})

test('queryWouldSearch rejects first-token stopwords and 1-char lookups', () => {
  assert.equal(queryWouldSearch('the'), false)
  assert.equal(queryWouldSearch('7'), false)
  assert.equal(queryWouldSearch('last'), true)
})

test('uniqueTypingQueriesForTopGames uses rank order and dedupes', () => {
  const docs = [
    { bggId: '2', name: 'Last Will', rank: 2 },
    { bggId: '1', name: 'Last Night on Earth', rank: 1 },
    { bggId: '9', name: 'Unranked', rank: null },
  ]
  const top = topRankedCatalogDocs(docs, 2)
  assert.deepEqual(
    top.map((d) => d.bggId),
    ['1', '2'],
  )
  const queries = uniqueTypingQueriesForTopGames(docs, 2)
  assert.equal(queries[0], 'last')
  assert.ok(queries.includes('last night'))
  assert.ok(queries.includes('last will'))
  assert.equal(queries.filter((q) => q === 'last').length, 1)
})
