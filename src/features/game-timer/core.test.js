import assert from 'node:assert/strict'
import test from 'node:test'
import { withFakeNow } from './test/withFakeNow.js'
import { createTestSession, testPlayer } from './test/fixtures.js'
import {
  hasMultipleRounds,
  nonPlayerElapsedMs,
  totalGameElapsedMs,
} from './core.js'
import { selectPlayerSnapshot } from './timerRules.js'

test('hasMultipleRounds is false for single-round session', () => {
  assert.equal(
    hasMultipleRounds(
      createTestSession({
        round: 1,
        players: [testPlayer('a')],
        playerOrderByRound: { '1': ['a'] },
      }),
    ),
    false,
  )
})

test('hasMultipleRounds is true when round index exceeds one', () => {
  assert.equal(
    hasMultipleRounds(
      createTestSession({
        round: 2,
        players: [testPlayer('a')],
        playerOrderByRound: { '1': ['a'], '2': ['a'] },
      }),
    ),
    true,
  )
})

test('hasMultipleRounds is true when player has banked time in round 2', () => {
  assert.equal(
    hasMultipleRounds(
      createTestSession({
        round: 1,
        players: [testPlayer('a', { bankedMsByRound: { '2': 1000 } })],
      }),
    ),
    true,
  )
})

test('totalGameElapsedMs is zero before first selectPlayer', () => {
  const snapshot = createTestSession({ totalGameStartedAt: null })
  assert.equal(totalGameElapsedMs(snapshot, 5000), 0)
})

test('totalGameElapsedMs tracks wall clock after session start', () => {
  const snapshot = createTestSession({ totalGameStartedAt: 10_000 })
  assert.equal(totalGameElapsedMs(snapshot, 15_000), 5_000)
})

test('nonPlayerElapsedMs is total minus player displayed totals', () => {
  withFakeNow(10_000, (advance) => {
    let session = createTestSession({
      players: [testPlayer('a')],
      playerOrderByRound: { '1': ['a'] },
    })
    session = selectPlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)
    advance(5_000)
    session = selectPlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)

    const snapshot = {
      totalGameStartedAt: session.totalGameStartedAt,
      players: session.players,
      activePlayerId: session.activePlayerId,
      turnStartedAt: session.turnStartedAt,
    }
    assert.equal(totalGameElapsedMs(snapshot, 15_000), 5_000)
    assert.equal(nonPlayerElapsedMs(snapshot, 15_000), 0)

    snapshot.players[0].bankedMs = 12_000
    assert.equal(nonPlayerElapsedMs(snapshot, 15_000), 0)
  })
})
