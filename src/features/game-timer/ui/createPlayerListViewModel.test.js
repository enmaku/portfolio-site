import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlayerListViewModel } from './createPlayerListViewModel.js'
import { testPlayer } from '../test/fixtures.js'

test('player list view model exposes row ms totals and flags', () => {
  const players = [testPlayer('a', { bankedMs: 3000 }), testPlayer('b', { bankedMs: 1000 })]
  const session = {
    activePlayerId: 'a',
    turnStartedAt: 5000,
    turnStartedRound: 1,
  }
  const rows = createPlayerListViewModel({
    players,
    session,
    round: 1,
    hardPassEnabled: true,
    hardPassOrderByRound: { '1': ['b'] },
    hasMultipleRounds: false,
    nowMs: 8000,
  })

  const rowA = rows.get('a')
  const rowB = rows.get('b')
  assert.ok(rowA)
  assert.ok(rowB)
  assert.equal(rowA.displayedMs, 6000)
  assert.equal(rowB.displayedMs, 1000)
  assert.equal(rowA.isActive, true)
  assert.equal(rowB.isHardPassed, true)
  assert.equal(rowA.isHardPassed, false)
  assert.equal(rowA.progress, 1)
  assert.equal(rowB.progress, 1000 / 6000)
})

test('player list view model marks paused held turn', () => {
  const players = [testPlayer('a')]
  const rows = createPlayerListViewModel({
    players,
    session: { activePlayerId: 'a', turnStartedAt: null, turnStartedRound: null },
    round: 1,
    hardPassEnabled: false,
    hardPassOrderByRound: {},
    hasMultipleRounds: false,
    nowMs: 1000,
  })
  const row = rows.get('a')
  assert.ok(row)
  assert.equal(row.isPausedHeldTurn, true)
  assert.equal(row.isHardPassed, false)
})

test('player list view model includes round-scoped totals when multi-round', () => {
  const players = [
    testPlayer('a', { bankedMs: 5000, bankedMsByRound: { '1': 2000, '2': 3000 } }),
    testPlayer('b', { bankedMs: 1000, bankedMsByRound: { '2': 1000 } }),
  ]
  const rows = createPlayerListViewModel({
    players,
    session: { activePlayerId: null, turnStartedAt: null, turnStartedRound: null },
    round: 2,
    hardPassEnabled: false,
    hardPassOrderByRound: {},
    hasMultipleRounds: true,
    nowMs: 10_000,
  })
  const rowA = rows.get('a')
  assert.ok(rowA)
  assert.equal(rowA.displayedMsRound, 3000)
  assert.equal(rowA.progressRound, 1)
})
