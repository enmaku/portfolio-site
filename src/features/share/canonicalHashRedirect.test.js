import assert from 'node:assert/strict'
import test from 'node:test'
import { toHashRouteTarget } from './canonicalHashRedirect.js'

test('toHashRouteTarget maps canonical game timer path with query', () => {
  const target = toHashRouteTarget('/projects/game-timer', '?room=AB12CD')
  assert.equal(target, '/#/projects/game-timer?room=AB12CD')
})

test('toHashRouteTarget maps canonical movie vote path with query', () => {
  const target = toHashRouteTarget('/projects/movie-vote', '?room=ZX90PQ')
  assert.equal(target, '/#/projects/movie-vote?room=ZX90PQ')
})

test('toHashRouteTarget ignores unrelated paths', () => {
  const target = toHashRouteTarget('/about', '?room=AB12CD')
  assert.equal(target, null)
})
