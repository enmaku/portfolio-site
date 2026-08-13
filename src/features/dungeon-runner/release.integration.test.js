import assert from 'node:assert/strict'
import test from 'node:test'
import routes from '../../router/routes.js'
import { getShareEntryForPath, PASTE_UNFURL_ROUTES } from '../../share-metadata.js'

test('dungeon runner route is integrated with share metadata contract', () => {
  const route = routes.find((entry) => entry.path === '/projects/dungeon-runner')
  assert.ok(route)
  const page = route.children?.[0]
  assert.ok(page)
  assert.equal(page.meta, undefined)
  const catalogEntry = getShareEntryForPath('/projects/dungeon-runner')
  assert.ok(catalogEntry)
  assert.equal(catalogEntry.pasteUnfurl, true)
  assert.equal(PASTE_UNFURL_ROUTES.some((entry) => entry.routePath === '/projects/dungeon-runner'), true)
})
