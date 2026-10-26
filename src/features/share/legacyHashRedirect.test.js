import assert from 'node:assert/strict'
import test from 'node:test'
import { hashToRouteTarget, migrateHashUrl } from './legacyHashRedirect.js'

test('hashToRouteTarget maps hash routes onto paths', () => {
  assert.equal(hashToRouteTarget('#/'), '/')
  assert.equal(hashToRouteTarget('#/about'), '/about')
  assert.equal(hashToRouteTarget('#/projects/game-timer'), '/projects/game-timer')
})

test('hashToRouteTarget preserves the query string for join links', () => {
  assert.equal(hashToRouteTarget('#/projects/movie-vote?room=ZX90PQ'), '/projects/movie-vote?room=ZX90PQ')
  assert.equal(
    hashToRouteTarget('#/projects/time-tracker/c/abc123?x=1'),
    '/projects/time-tracker/c/abc123?x=1',
  )
})

test('hashToRouteTarget strips trailing slashes', () => {
  assert.equal(hashToRouteTarget('#/projects/game-timer/'), '/projects/game-timer')
})

test('hashToRouteTarget ignores non-route fragments', () => {
  for (const hash of ['', '#', '#section']) {
    assert.equal(hashToRouteTarget(hash), null, hash)
  }
  assert.equal(hashToRouteTarget(undefined), null)
})

test('hashToRouteTarget passes unknown paths through to the router', () => {
  assert.equal(hashToRouteTarget('#/nope-not-an-app-route'), '/nope-not-an-app-route')
})

test('migrateHashUrl replaces a legacy hash URL with its path', (t) => {
  /** @type {string[]} */
  const replaced = []
  globalThis.window = {
    location: {
      hash: '#/projects/game-timer?room=AB12CD',
      replace(target) {
        replaced.push(target)
      },
    },
  }
  t.after(() => {
    delete globalThis.window
  })

  assert.equal(migrateHashUrl(), true)
  assert.deepEqual(replaced, ['/projects/game-timer?room=AB12CD'])
})

test('migrateHashUrl is a noop without a route hash', (t) => {
  let replaceCount = 0
  globalThis.window = {
    location: {
      hash: '',
      replace() {
        replaceCount += 1
      },
    },
  }
  t.after(() => {
    delete globalThis.window
  })

  assert.equal(migrateHashUrl(), false)
  assert.equal(replaceCount, 0)
})
