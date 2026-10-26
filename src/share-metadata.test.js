import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import routes, { portfolioDocumentTitle } from './router/routes.js'
import {
  APP_ICON_COLORS,
  APP_ICON_SIZES,
  FAVICON_IDS,
  INSTALLABLE_APPS,
  PASTE_UNFURL_ROUTES,
  SHARE_CATALOG,
  SITE_NAME,
  getInstallableAppForPath,
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
  '/projects/game-manager',
  '/projects/time-tracker',
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
  assert.equal(SHARE_CATALOG.length, 9)
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

test('installable apps are the mobile nav routes with distinct identities', () => {
  assert.deepEqual(
    INSTALLABLE_APPS.map((app) => app.routePath),
    [
      '/projects/game-timer',
      '/projects/movie-vote',
      '/projects/dungeon-runner',
      '/projects/game-manager',
      '/projects/time-tracker',
    ],
  )
  const ids = INSTALLABLE_APPS.map((app) => app.manifestId)
  assert.equal(new Set(ids).size, ids.length)
  for (const app of INSTALLABLE_APPS) {
    const slug = app.routePath.replace(/^\/+/, '')
    assert.equal(app.manifestId, `../${slug}/`)
    assert.equal(app.startUrl, `../${slug}/`)
    assert.equal(app.scope, `../${slug}/`)
    assert.equal(app.startUrl.includes('#'), false)
  }
})

test('installable app scopes are path-scoped and mutually non-overlapping', () => {
  const roots = INSTALLABLE_APPS.map((app) => new URL(app.scope, `https://example.com/manifests/x`).pathname)
  for (const [index, root] of roots.entries()) {
    assert.equal(root.endsWith('/'), true, root)
    assert.notEqual(root, '/', 'a site-wide scope blocks installing the other apps')
    for (const [otherIndex, other] of roots.entries()) {
      if (otherIndex === index) continue
      assert.equal(other.startsWith(root), false, `${root} claims ${other}`)
    }
  }
})

test('installable app manifest hrefs point at shipped public manifests', async () => {
  const manifestsDir = fileURLToPath(new URL('../public/manifests', import.meta.url))
  for (const app of INSTALLABLE_APPS) {
    const file = `${manifestsDir}/${app.iconId}.webmanifest`
    assert.equal(existsSync(file), true, `missing public/manifests/${app.iconId}.webmanifest`)
    const manifest = JSON.parse(await readFile(file, 'utf8'))
    assert.equal(manifest.id, app.manifestId)
    assert.equal(manifest.name, app.name)
    assert.equal(manifest.start_url, app.startUrl)
    assert.equal(manifest.scope, app.scope)
    assert.equal(manifest.display, 'standalone')
    assert.deepEqual(
      manifest.icons.map((icon) => icon.sizes),
      APP_ICON_SIZES.map((size) => `${size}x${size}`),
    )

    // Every manifest URL resolves against the manifest itself, so `id` must
    // land on the app root too — a mismatch reads as a broken app identity.
    const manifestUrl = `https://example.test/manifests/${app.iconId}.webmanifest`
    const appRoot = new URL(`/projects/${app.routePath.split('/').pop()}/`, manifestUrl).pathname
    for (const key of /** @type {const} */ (['id', 'start_url', 'scope'])) {
      assert.equal(new URL(manifest[key], manifestUrl).pathname, appRoot, `${key} must resolve to ${appRoot}`)
    }
  }
})

test('installable app manifests paint the icon color', async () => {
  const manifestsDir = fileURLToPath(new URL('../public/manifests', import.meta.url))
  for (const app of INSTALLABLE_APPS) {
    const manifest = JSON.parse(await readFile(`${manifestsDir}/${app.iconId}.webmanifest`, 'utf8'))
    assert.equal(app.iconColor, APP_ICON_COLORS[app.iconId])
    assert.match(app.iconColor, /^#[0-9a-fA-F]{6}$/)
    assert.equal(manifest.theme_color, app.iconColor, `${app.iconId} theme_color`)
    assert.equal(manifest.background_color, app.iconColor, `${app.iconId} background_color`)
  }
})

test('launcher icon sources are separate from route favicons', () => {
  const iconsDir = fileURLToPath(new URL('../public/icons', import.meta.url))
  for (const app of INSTALLABLE_APPS) {
    assert.equal(
      existsSync(`${iconsDir}/app-icon-${app.iconId}.svg`),
      true,
      `missing public/icons/app-icon-${app.iconId}.svg`,
    )
  }
})

test('installable app icons ship at manifest-declared sizes', async () => {
  const iconsDir = fileURLToPath(new URL('../public/icons/apps', import.meta.url))
  for (const app of INSTALLABLE_APPS) {
    for (const size of APP_ICON_SIZES) {
      const file = `${iconsDir}/${app.iconId}-${size}.png`
      assert.equal(existsSync(file), true, `missing public/icons/apps/${app.iconId}-${size}.png`)
      const meta = await sharp(file).metadata()
      assert.equal(meta.width, size)
      assert.equal(meta.height, size)
    }
  }
})

test('each catalog favicon id has a public SVG asset', () => {
  const iconsDir = fileURLToPath(new URL('../public/icons', import.meta.url))
  for (const id of FAVICON_IDS) {
    assert.equal(
      existsSync(`${iconsDir}/favicon-${id}.svg`),
      true,
      `missing public/icons/favicon-${id}.svg`,
    )
  }
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

test('share and install lookups tolerate trailing slashes from static hosts', () => {
  assert.equal(getShareEntryForPath('/projects/game-timer/')?.routePath, '/projects/game-timer')
  assert.equal(getInstallableAppForPath('/projects/game-timer/')?.routePath, '/projects/game-timer')
  assert.equal(getShareEntryForPath('/')?.routePath, '/')
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
