import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import routes from '../../router/routes.js'
import { getShareEntryForPath } from '../../share-metadata.js'

test('game manager route is registered under project shell layout', () => {
  const route = routes.find((entry) => entry.path === '/projects/game-manager')
  assert.ok(route)
  assert.equal(typeof route.component, 'function')
  const page = route.children?.[0]
  assert.ok(page)
  assert.equal(page.path, '')
  assert.equal(typeof page.component, 'function')
})

test('game manager route record imports layout and page modules', () => {
  const routesSource = readFileSync(new URL('../../router/routes.js', import.meta.url), 'utf8')
  const gmIdx = routesSource.indexOf("path: '/projects/game-manager'")
  assert.ok(gmIdx >= 0)
  const window = routesSource.slice(gmIdx, gmIdx + 900)
  assert.equal(window.includes("import('layouts/projects/ProjectShellLayout.vue')"), true)
  assert.equal(window.includes("import('pages/projects/GameManagerPage.vue')"), true)
})

test('game manager share catalog row is paste-unfurl eligible', () => {
  const entry = getShareEntryForPath('/projects/game-manager')
  assert.ok(entry)
  assert.equal(entry.pasteUnfurl, true)
  assert.equal(entry.shareSlug, 'projects/game-manager')
})
