import assert from 'node:assert/strict'
import test from 'node:test'
import routes, { portfolioDocumentTitle } from './router/routes.js'
import {
  FAVICON_IDS,
  PASTE_UNFURL_ROUTES,
  SHARE_CATALOG,
  SITE_NAME,
  getShareEntryForPath,
} from './share-metadata.js'

/** @param {string} path */
function normalizeRoutePath(path) {
  if (!path || path === '/') return '/'
  return path.replace(/\/+$/, '') || '/'
}

/** @param {string} parent @param {string} segment */
function joinRoutePath(parent, segment) {
  if (segment === '') return normalizeRoutePath(parent || '/')
  if (segment.startsWith('/')) return normalizeRoutePath(segment)
  if (!parent || parent === '/') return normalizeRoutePath(`/${segment}`)
  return normalizeRoutePath(`${parent}/${segment}`)
}

/** @param {import('vue-router').RouteRecordRaw[]} records @param {string} parent */
function collectRouterPaths(records, parent = '') {
  /** @type {string[]} */
  const paths = []
  for (const record of records) {
    if (record.path.includes(':')) continue

    const fullPath = joinRoutePath(parent, record.path)

    if (record.children?.length) {
      paths.push(...collectRouterPaths(record.children, fullPath))
      continue
    }

    paths.push(fullPath)
  }
  return paths
}

const ROUTER_PATHS = new Set(collectRouterPaths(routes))

/** Paths that must be **paste-unfurl eligible** per portfolio CONTEXT.md. */
const EXPECTED_PASTE_UNFURL_PATHS = [
  '/',
  '/about',
  '/projects/game-timer',
  '/projects/movie-vote',
  '/projects/dungeon-runner',
  '/projects/dungeon-runner/stats',
  '/projects/world-builder',
]

const CATALOG_ENTRY_KEYS = [
  'routePath',
  'pasteUnfurl',
  'shareSlug',
  'title',
  'description',
  'ogImage',
  'favicon',
]

test('catalog entries expose only the catalog contract fields', () => {
  const expectedKeys = [...CATALOG_ENTRY_KEYS].sort()
  for (const entry of SHARE_CATALOG) {
    assert.deepEqual(Object.keys(entry).sort(), expectedKeys)
  }
})

test('catalog has no cardpreview route', () => {
  assert.equal(
    SHARE_CATALOG.some((entry) => entry.routePath.toLowerCase().includes('cardpreview')),
    false,
  )
})

test('catalog rows are all paste-unfurl routes', () => {
  for (const entry of SHARE_CATALOG) {
    assert.equal(entry.pasteUnfurl, true)
  }
  assert.equal(SHARE_CATALOG.length, 7)
})

test('shipped paste-unfurl routes each have a catalog row', () => {
  for (const routePath of EXPECTED_PASTE_UNFURL_PATHS) {
    const entry = getShareEntryForPath(routePath)
    assert.ok(entry, `missing catalog row for ${routePath}`)
    assert.equal(entry.pasteUnfurl, true)
  }
})

test('paste-unfurl catalog route paths are defined router paths', () => {
  const pasteUnfurlPaths = SHARE_CATALOG.filter((entry) => entry.pasteUnfurl).map(
    (entry) => entry.routePath,
  )
  for (const routePath of pasteUnfurlPaths) {
    assert.equal(ROUTER_PATHS.has(routePath), true, `missing router path ${routePath}`)
  }
})

test('PASTE_UNFURL_ROUTES matches catalog paste-unfurl rows with non-empty shareSlug', () => {
  const expected = SHARE_CATALOG.filter((entry) => entry.pasteUnfurl && entry.shareSlug !== '')
  assert.deepEqual(PASTE_UNFURL_ROUTES, expected)
})

test('home is paste-unfurl in catalog but not in PASTE_UNFURL_ROUTES', () => {
  const home = SHARE_CATALOG.find((entry) => entry.routePath === '/')
  assert.ok(home)
  assert.equal(home.pasteUnfurl, true)
  assert.equal(home.shareSlug, '')
  assert.equal(PASTE_UNFURL_ROUTES.some((entry) => entry.routePath === '/'), false)
})

test('FAVICON_IDS lists each catalog favicon exactly once', () => {
  const fromCatalog = [...new Set(SHARE_CATALOG.map((entry) => entry.favicon))].sort()
  assert.deepEqual([...FAVICON_IDS].sort(), fromCatalog)
})

test('getShareEntryForPath returns null for unknown paths', () => {
  assert.equal(getShareEntryForPath('/cardpreview'), null)
  assert.equal(getShareEntryForPath('/does-not-exist'), null)
})

test('getShareEntryForPath returns catalog rows for known paths', () => {
  for (const entry of SHARE_CATALOG) {
    assert.equal(getShareEntryForPath(entry.routePath), entry)
  }
})

test('router paths exclude cardpreview', () => {
  assert.equal(ROUTER_PATHS.has('/cardpreview'), false)
})

test('portfolioDocumentTitle matches site author default for unknown paths', () => {
  assert.equal(portfolioDocumentTitle, SITE_NAME)
})

test('route records omit duplicated share chrome meta', () => {
  /** @param {import('vue-router').RouteRecordRaw[]} records */
  function assertNoShareMeta(records) {
    for (const record of records) {
      assert.equal(record.meta, undefined)
      if (record.children?.length) assertNoShareMeta(record.children)
    }
  }
  assertNoShareMeta(routes)
})
