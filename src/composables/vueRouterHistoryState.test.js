import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mergeHistoryState,
  repairedVueRouterHistoryState,
} from './vueRouterHistoryState.js'

test('mergeHistoryState keeps vue-router current when adding a back-trap flag', () => {
  const merged = mergeHistoryState(
    { current: '/projects/game-manager', position: 3 },
    { portfolioGameManagerBrowserBack: true },
  )
  assert.equal(merged.current, '/projects/game-manager')
  assert.equal(merged.position, 3)
  assert.equal(merged.portfolioGameManagerBrowserBack, true)
})

test('mergeHistoryState treats a missing existing state as empty', () => {
  const merged = mergeHistoryState(null, { portfolioProjectBrowserBackTrap: true })
  assert.equal(merged.portfolioProjectBrowserBackTrap, true)
})

test('repairedVueRouterHistoryState fills current from location when a sentinel wiped it', () => {
  const next = repairedVueRouterHistoryState(
    { portfolioGameManagerBrowserBack: true },
    { pathname: '/projects/game-manager/', search: '', hash: '' },
  )
  assert.ok(next)
  assert.equal(next.current, '/projects/game-manager/')
  assert.equal(next.portfolioGameManagerBrowserBack, true)
  assert.equal(next.back, null)
})

test('repairedVueRouterHistoryState no-ops when current is already a string', () => {
  const existing = { current: '/projects/game-manager', portfolioProjectBrowserBackTrap: true }
  assert.equal(
    repairedVueRouterHistoryState(existing, { pathname: '/other', search: '', hash: '' }),
    null,
  )
})
