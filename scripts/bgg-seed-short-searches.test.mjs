import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bggSearchUrl,
  formatSeedDurationMs,
  formatSeedProgress,
  resolveBggSearchFunctionsBase,
  twoLetterQueries,
} from './lib/bggSeedShortSearches.mjs'

test('twoLetterQueries is aa through zz', () => {
  const queries = twoLetterQueries()
  assert.equal(queries.length, 26 * 26)
  assert.equal(queries[0], 'aa')
  assert.equal(queries[1], 'ab')
  assert.equal(queries[queries.length - 1], 'zz')
})

test('resolveBggSearchFunctionsBase prefers explicit base then project id', () => {
  assert.equal(
    resolveBggSearchFunctionsBase({ VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE: 'https://example.test/' }),
    'https://example.test',
  )
  assert.equal(
    resolveBggSearchFunctionsBase({ VITE_FIREBASE_PROJECT_ID: 'enmaku-portfolio-site' }),
    'https://us-central1-enmaku-portfolio-site.cloudfunctions.net',
  )
})

test('bggSearchUrl sets query param', () => {
  assert.equal(
    bggSearchUrl('https://us-central1-demo.cloudfunctions.net', 'aa'),
    'https://us-central1-demo.cloudfunctions.net/bggSearch?query=aa',
  )
})

test('formatSeedProgress includes percent elapsed and eta', () => {
  const line = formatSeedProgress({
    done: 40,
    total: 200,
    elapsedMs: 10_000,
    query: 'aa',
    hitCount: 20,
  })
  assert.equal(line, '20.0%  40/200  aa  hits 20  elapsed 10s  eta 40s')
  assert.equal(formatSeedDurationMs(65_000), '1m 05s')
})
