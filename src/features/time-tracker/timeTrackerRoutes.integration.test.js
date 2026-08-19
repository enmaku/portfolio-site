import assert from 'node:assert/strict'
import test from 'node:test'
import routes from '../../router/routes.js'
import { getShareEntryForPath } from '../../share-metadata.js'

function findRoute(records, path) {
  return records.find((entry) => entry.path === path)
}

test('time tracker route is registered under project shell layout', () => {
  const route = findRoute(routes, '/projects/time-tracker')
  assert.ok(route)
  assert.equal(typeof route.component, 'function')
  const page = route.children?.find((child) => child.path === '')
  assert.ok(page)
  assert.equal(typeof page.component, 'function')
})

test('time tracker share catalog row is paste-unfurl eligible with generic product copy', () => {
  const entry = getShareEntryForPath('/projects/time-tracker')
  assert.ok(entry)
  assert.equal(entry.pasteUnfurl, true)
  assert.equal(entry.shareSlug, 'projects/time-tracker')
  assert.equal(entry.favicon, 'schedule')
  assert.equal(entry.ogImage, 'icons/favicon-schedule.svg')
  assert.equal(entry.description.toLowerCase().includes('david'), false)
  assert.equal(entry.description.toLowerCase().includes('focus disorder'), false)
})

test('client invoice page is a project-shell child route and is not paste-unfurl eligible', () => {
  const route = findRoute(routes, '/projects/time-tracker')
  const invoicePage = route?.children?.find((child) => child.path === 'c/:secret')
  assert.ok(invoicePage)
  assert.equal(typeof invoicePage.component, 'function')
  assert.equal(getShareEntryForPath('/projects/time-tracker/c/:secret'), null)
  assert.equal(getShareEntryForPath('/projects/time-tracker/c/example-secret'), null)
})
