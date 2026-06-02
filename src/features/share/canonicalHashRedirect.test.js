import assert from 'node:assert/strict'
import test from 'node:test'
import { PASTE_UNFURL_ROUTES, SHARE_CATALOG } from '../../share-metadata.js'
import {
  redirectCanonicalPathToHashRoute,
  toHashRouteTarget,
} from './canonicalHashRedirect.js'

const RUNTIME_CANONICAL_PATHS = SHARE_CATALOG.filter(
  (entry) => entry.pasteUnfurl && entry.routePath !== '/',
).map((entry) => entry.routePath)

test('toHashRouteTarget maps every paste-unfurl catalog path except home', () => {
  assert.equal(RUNTIME_CANONICAL_PATHS.length, 5)
  for (const routePath of RUNTIME_CANONICAL_PATHS) {
    assert.equal(toHashRouteTarget(routePath), `/#${routePath}`)
    assert.equal(toHashRouteTarget(routePath, '?room=AB12CD'), `/#${routePath}?room=AB12CD`)
  }
})

test('PASTE_UNFURL_ROUTES paths are canonical redirect targets', () => {
  for (const entry of PASTE_UNFURL_ROUTES) {
    assert.notEqual(toHashRouteTarget(entry.routePath), null, entry.routePath)
  }
})

test('toHashRouteTarget maps dungeon runner canonical path', () => {
  assert.equal(toHashRouteTarget('/projects/dungeon-runner'), '/#/projects/dungeon-runner')
})

test('toHashRouteTarget ignores unrelated paths', () => {
  for (const pathname of ['/cardpreview', '/does-not-exist', '/']) {
    assert.equal(toHashRouteTarget(pathname, '?room=AB12CD'), null)
  }
})

test('redirectCanonicalPathToHashRoute replaces location for catalog pathname', (t) => {
  /** @type {string[]} */
  const replaced = []
  globalThis.window = {
    location: {
      pathname: '/projects/movie-vote',
      search: '?room=ZX90PQ',
      hash: '',
      replace(target) {
        replaced.push(target)
      },
    },
  }
  t.after(() => {
    delete globalThis.window
  })
  redirectCanonicalPathToHashRoute()
  assert.deepEqual(replaced, ['/#/projects/movie-vote?room=ZX90PQ'])
})

test('redirectCanonicalPathToHashRoute is noop when hash is already set', (t) => {
  let replaceCount = 0
  globalThis.window = {
    location: {
      pathname: '/projects/game-timer',
      search: '',
      hash: '#/projects/game-timer',
      replace() {
        replaceCount += 1
      },
    },
  }
  t.after(() => {
    delete globalThis.window
  })
  redirectCanonicalPathToHashRoute()
  assert.equal(replaceCount, 0)
})
