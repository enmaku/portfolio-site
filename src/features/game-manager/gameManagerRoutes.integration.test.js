import assert from 'node:assert/strict'
import test from 'node:test'
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

test('game manager share catalog row is paste-unfurl eligible', () => {
  const entry = getShareEntryForPath('/projects/game-manager')
  assert.ok(entry)
  assert.equal(entry.pasteUnfurl, true)
  assert.equal(entry.shareSlug, 'projects/game-manager')
  assert.equal(entry.favicon, 'meeple')
  assert.equal(entry.ogImage, 'icons/favicon-meeple.svg')
})
