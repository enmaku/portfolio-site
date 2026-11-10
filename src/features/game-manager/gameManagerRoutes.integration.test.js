import assert from 'node:assert/strict'
import test from 'node:test'
import routes from '../../router/routes.js'
import { getShareEntryForPath } from '../../share-metadata.js'

function findRoute(records, path) {
  return records.find((entry) => entry.path === path)
}

test('game manager route is registered under project shell layout', () => {
  const route = findRoute(routes, '/projects/game-manager')
  assert.ok(route)
  assert.equal(typeof route.component, 'function')
  const page = route.children?.find((child) => child.path === '')
  assert.ok(page)
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

test('manager-linked timer is a project-shell child route and is not paste-unfurl eligible', () => {
  const route = findRoute(routes, '/projects/game-manager')
  const timerPage = route?.children?.find((child) => child.path === 'timer')
  assert.ok(timerPage)
  assert.equal(typeof timerPage.component, 'function')
  assert.equal(getShareEntryForPath('/projects/game-manager/timer'), null)
})
