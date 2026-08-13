import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSearchPrefixes,
  catalogSearchDocFromRankRow,
  edgeNgrams,
  normalizeTitle,
  parseCsvLine,
  titleTokens,
} from './lib/bggCatalogSearchIndex.mjs'

test('normalizeTitle lowercases strips punctuation and diacritics', () => {
  assert.equal(normalizeTitle('  Café: Deluxe! '), 'cafe deluxe')
})

test('titleTokens drops stopwords', () => {
  assert.deepEqual(titleTokens('The Lord of the Rings'), ['lord', 'rings'])
})

test('edgeNgrams builds length-bounded prefixes', () => {
  assert.deepEqual(edgeNgrams('wing'), ['wi', 'win', 'wing'])
  assert.deepEqual(edgeNgrams('ab'), ['ab'])
  assert.deepEqual(edgeNgrams('a'), [])
})

test('buildSearchPrefixes covers article-skipped word starts', () => {
  const prefixes = buildSearchPrefixes('The Matrix')
  assert.ok(prefixes.includes('ma'))
  assert.ok(prefixes.includes('matrix'))
  assert.ok(!prefixes.includes('the'))
})

test('buildSearchPrefixes covers multi-token AND ingredients', () => {
  const prefixes = buildSearchPrefixes('The Lord of the Rings')
  assert.ok(prefixes.includes('lord'))
  assert.ok(prefixes.includes('rings'))
  assert.ok(prefixes.includes('ri'))
})

test('catalogSearchDocFromRankRow skips expansions', () => {
  assert.equal(
    catalogSearchDocFromRankRow({
      id: '1',
      name: 'Exp',
      is_expansion: '1',
    }),
    null,
  )
})

test('catalogSearchDocFromRankRow builds Model A doc', () => {
  const doc = catalogSearchDocFromRankRow({
    id: '266192',
    name: 'Wingspan',
    yearpublished: '2019',
    rank: '38',
    bayesaverage: '7.84',
    average: '8.0',
    usersrated: '100',
    is_expansion: '0',
  })
  assert.equal(doc.bggId, '266192')
  assert.equal(doc.rank, 38)
  assert.ok(doc.searchPrefixes.includes('wing'))
  assert.ok(doc.searchPrefixes.includes('wingspan'))
})

test('catalogSearchDocFromRankRow treats rank 0 as null', () => {
  const doc = catalogSearchDocFromRankRow({
    id: '9',
    name: 'Obscure',
    yearpublished: '1990',
    rank: '0',
    bayesaverage: '0',
    average: '0',
    usersrated: '0',
    is_expansion: '0',
  })
  assert.equal(doc.rank, null)
})

test('parseCsvLine handles quoted commas', () => {
  assert.deepEqual(parseCsvLine('1,"Brass: Birmingham",2018'), [
    '1',
    'Brass: Birmingham',
    '2018',
  ])
})
