import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import routes from '../src/router/routes.js'
import { getShareEntryForPath, PASTE_UNFURL_ROUTES } from '../src/share-metadata.js'

const WORLD_BUILDER_PATH = '/projects/world-builder'

test('world builder route is a MainLayout child', () => {
  const mainLayout = routes.find((entry) => entry.path === '/')
  assert.ok(mainLayout)
  const worldBuilderRoute = mainLayout.children?.find(
    (child) => child.path === 'projects/world-builder',
  )
  assert.ok(worldBuilderRoute)
  assert.match(String(worldBuilderRoute.component), /WorldBuilderPage\.vue/)
})

test('world builder route is not under ProjectShellLayout', () => {
  const shellRoute = routes.find((entry) => entry.path === '/projects/world-builder')
  assert.equal(shellRoute, undefined)
})

test('world builder share catalog row is paste-unfurl eligible', () => {
  const entry = getShareEntryForPath(WORLD_BUILDER_PATH)
  assert.ok(entry)
  assert.equal(entry.pasteUnfurl, true)
  assert.equal(entry.title, 'World Builder')
  assert.equal(entry.title.includes('—'), false)
  assert.equal(PASTE_UNFURL_ROUTES.some((row) => row.routePath === WORLD_BUILDER_PATH), true)
})

test('main layout desktop section links world builder in-tab with globe icon', () => {
  const mainLayout = readFileSync(new URL('../src/layouts/MainLayout.vue', import.meta.url), 'utf8')
  assert.equal(mainLayout.includes(`'${WORLD_BUILDER_PATH}'`), true)
  assert.equal(mainLayout.includes("'World Builder'"), true)
  assert.equal(mainLayout.includes("'public'"), true)
  assert.equal(mainLayout.includes('navigateInTab: true'), true)
})

test('world builder page is a blank portfolio shell surface', () => {
  const page = readFileSync(
    new URL('../src/pages/projects/WorldBuilderPage.vue', import.meta.url),
    'utf8',
  )
  assert.equal(page.includes('World Builder'), true)
  assert.equal(page.includes('q-page'), true)
})
