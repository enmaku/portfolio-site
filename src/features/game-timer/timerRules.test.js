import assert from 'node:assert/strict'
import test from 'node:test'
import { withFakeNow } from './test/withFakeNow.js'
import { createTestSession, testPlayer } from './test/fixtures.js'
import {
  applyPlayerOrder,
  endTurnNextSnapshot,
  goToNextRoundSnapshot,
  goToPreviousRoundSnapshot,
  registerHardPassSnapshot,
  removePlayerSnapshot,
  selectPlayerSnapshot,
  startNewGameSamePlayersSnapshot,
  undoHardPassSnapshot,
} from './timerRules.js'

test('startNewGameSamePlayersSnapshot keeps roster and clears clocks and rounds', () => {
  withFakeNow(1000, (advance) => {
    let session = createTestSession({
      players: [testPlayer('a', { name: 'Ada', color: '#ff0000' }), testPlayer('b', { name: 'Bob', color: '#00ff00' })],
      playerOrderByRound: { '1': ['a', 'b'] },
      hardPassEnabled: true,
      hardPassOrderNextRound: true,
    })

    session = selectPlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)
    advance(2000)
    session = selectPlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)
    session = goToNextRoundSnapshot(session, Date.now())
    assert.ok(session)
    session = selectPlayerSnapshot(session, 'b', Date.now())
    assert.ok(session)
    advance(1000)
    session = registerHardPassSnapshot(session, 'b', Date.now())
    assert.ok(session)

    const rosterSnapshot = session.players.map((p) => ({ id: p.id, name: p.name, color: p.color }))
    const orderAtReset = session.players.map((p) => p.id)
    assert.equal(session.round, 2)
    assert.ok(session.players[0].bankedMs > 0 || session.players[1].bankedMs > 0)
    assert.ok(Object.keys(session.hardPassOrderByRound).length > 0)

    const reset = startNewGameSamePlayersSnapshot(session, Date.now())
    assert.ok(reset)

    assert.deepEqual(
      reset.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
      rosterSnapshot,
    )
    assert.equal(reset.round, 1)
    assert.equal(reset.activePlayerId, null)
    assert.equal(reset.turnStartedAt, null)
    assert.equal(reset.turnStartedRound, null)
    assert.equal(reset.totalGameStartedAt, null)
    for (const p of reset.players) {
      assert.equal(p.bankedMs, 0)
      assert.deepEqual(p.bankedMsByRound, {})
    }
    assert.deepEqual(reset.hardPassOrderByRound, {})
    assert.equal(reset.hardPassEnabled, true)
    assert.equal(reset.hardPassOrderNextRound, true)
    assert.deepEqual(reset.playerOrderByRound['1'], orderAtReset)
  })
})

test('startNewGameSamePlayersSnapshot uses current list order as round 1 order', () => {
  const session = createTestSession({
    players: [testPlayer('a'), testPlayer('b')],
    playerOrderByRound: { '1': ['a', 'b'], '2': ['b', 'a'] },
    round: 2,
  })

  const reset = startNewGameSamePlayersSnapshot(session, Date.now())
  assert.ok(reset)
  assert.equal(reset.round, 1)
  assert.deepEqual(
    reset.players.map((p) => p.id),
    ['a', 'b'],
  )
  assert.deepEqual(reset.playerOrderByRound['1'], ['a', 'b'])
  assert.equal(Object.keys(reset.playerOrderByRound).length, 1)
})

test('startNewGameSamePlayersSnapshot is a no-op with no players', () => {
  assert.equal(startNewGameSamePlayersSnapshot(createTestSession(), Date.now()), null)
})

test('selectPlayerSnapshot sets totalGameStartedAt on first select', () => {
  const session = createTestSession({
    players: [testPlayer('a')],
    playerOrderByRound: { '1': ['a'] },
  })
  const next = selectPlayerSnapshot(session, 'a', 4000)
  assert.ok(next)
  assert.equal(next.totalGameStartedAt, 4000)
  assert.equal(next.activePlayerId, 'a')
  assert.equal(next.turnStartedAt, 4000)
})

test('selectPlayerSnapshot pauses and resumes same player', () => {
  withFakeNow(1000, (advance) => {
    let session = createTestSession({
      players: [testPlayer('a')],
      playerOrderByRound: { '1': ['a'] },
    })
    session = selectPlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)
    advance(3000)
    session = selectPlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)
    assert.equal(session.turnStartedAt, null)
    assert.equal(session.activePlayerId, 'a')
    assert.equal(session.players[0].bankedMs, 3000)

    session = selectPlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)
    assert.equal(session.turnStartedAt, 4000)
    assert.equal(session.turnStartedRound, 1)
  })
})

test('selectPlayerSnapshot banks previous player when switching', () => {
  withFakeNow(1000, (advance) => {
    let session = createTestSession({
      players: [testPlayer('a'), testPlayer('b')],
      playerOrderByRound: { '1': ['a', 'b'] },
    })
    session = selectPlayerSnapshot(session, 'a', Date.now())
    advance(2000)
    session = selectPlayerSnapshot(session, 'b', Date.now())
    assert.ok(session)
    assert.equal(session.players[0].bankedMs, 2000)
    assert.equal(session.activePlayerId, 'b')
    assert.equal(session.turnStartedAt, 3000)
  })
})

test('endTurnNextSnapshot wraps and skips hard-passed players', () => {
  withFakeNow(5000, () => {
    const session = createTestSession({
      players: [testPlayer('a'), testPlayer('b'), testPlayer('c')],
      playerOrderByRound: { '1': ['a', 'b', 'c'] },
      hardPassEnabled: true,
      hardPassOrderByRound: { '1': ['b'] },
      activePlayerId: 'a',
      turnStartedAt: 5000,
      turnStartedRound: 1,
    })
    const next = endTurnNextSnapshot(session, 6000)
    assert.ok(next)
    assert.equal(next.activePlayerId, 'c')
    assert.equal(next.turnStartedAt, 6000)
    assert.equal(next.players[0].bankedMs, 1000)
  })
})

test('endTurnNextSnapshot clears turn when every player is hard-passed', () => {
  const session = createTestSession({
    players: [testPlayer('a'), testPlayer('b')],
    playerOrderByRound: { '1': ['a', 'b'] },
    hardPassEnabled: true,
    hardPassOrderByRound: { '1': ['a', 'b'] },
    activePlayerId: 'a',
    turnStartedAt: 1000,
    turnStartedRound: 1,
  })
  const next = endTurnNextSnapshot(session, 2000)
  assert.ok(next)
  assert.equal(next.activePlayerId, null)
  assert.equal(next.turnStartedAt, null)
})

test('registerHardPassSnapshot banks running clock and auto-advances', () => {
  withFakeNow(1000, () => {
    const session = createTestSession({
      players: [testPlayer('a'), testPlayer('b')],
      playerOrderByRound: { '1': ['a', 'b'] },
      hardPassEnabled: true,
      activePlayerId: 'a',
      turnStartedAt: 1000,
      turnStartedRound: 1,
    })
    const next = registerHardPassSnapshot(session, 'a', 4000)
    assert.ok(next)
    assert.deepEqual(next.hardPassOrderByRound['1'], ['a'])
    assert.equal(next.players[0].bankedMs, 3000)
    assert.equal(next.activePlayerId, 'b')
    assert.equal(next.turnStartedAt, 4000)
  })
})

test('registerHardPassSnapshot advances round when all players hard-passed', () => {
  withFakeNow(1000, () => {
    let session = createTestSession({
      players: [testPlayer('a'), testPlayer('b')],
      playerOrderByRound: { '1': ['a', 'b'] },
      hardPassEnabled: true,
    })
    session = registerHardPassSnapshot(session, 'a', Date.now())
    assert.ok(session)
    assert.equal(session.round, 1)
    session = registerHardPassSnapshot(session, 'b', Date.now())
    assert.ok(session)
    assert.equal(session.round, 2)
    assert.equal(session.activePlayerId, null)
  })
})

test('registerHardPassSnapshot drafts next-round order from pass sequence', () => {
  const session = createTestSession({
    players: [testPlayer('a'), testPlayer('b'), testPlayer('c')],
    playerOrderByRound: { '1': ['a', 'b', 'c'] },
    hardPassEnabled: true,
    hardPassOrderNextRound: true,
  })
  let next = registerHardPassSnapshot(session, 'b', 1000)
  assert.ok(next)
  next = registerHardPassSnapshot(next, 'a', 2000)
  assert.ok(next)
  assert.deepEqual(next.playerOrderByRound['2'], ['b', 'a', 'c'])
})

test('undoHardPassSnapshot removes pass without restoring banked time', () => {
  withFakeNow(1000, () => {
    let session = createTestSession({
      players: [testPlayer('a'), testPlayer('b')],
      playerOrderByRound: { '1': ['a', 'b'] },
      hardPassEnabled: true,
      hardPassOrderNextRound: true,
      activePlayerId: 'a',
      turnStartedAt: 1000,
      turnStartedRound: 1,
    })
    session = registerHardPassSnapshot(session, 'a', 5000)
    assert.ok(session)
    const bankedBeforeUndo = session.players[0].bankedMs
    assert.ok(bankedBeforeUndo > 0)

    session = undoHardPassSnapshot(session, 'a')
    assert.ok(session)
    assert.equal(session.hardPassOrderByRound['1']?.includes('a'), false)
    assert.equal(session.players[0].bankedMs, bankedBeforeUndo)
  })
})

test('goToNextRoundSnapshot pauses live turn and preserves lifetime banked time', () => {
  withFakeNow(1000, (advance) => {
    let session = createTestSession({
      players: [testPlayer('a', { bankedMs: 5000, bankedMsByRound: { '1': 5000 } }), testPlayer('b')],
      playerOrderByRound: { '1': ['a', 'b'], '2': ['b', 'a'] },
      activePlayerId: 'a',
      turnStartedAt: 1000,
      turnStartedRound: 1,
    })
    advance(2000)
    session = goToNextRoundSnapshot(session, Date.now())
    assert.ok(session)
    assert.equal(session.round, 2)
    assert.equal(session.activePlayerId, null)
    const playerA = session.players.find((p) => p.id === 'a')
    assert.ok(playerA)
    assert.equal(playerA.bankedMs, 7000)
    assert.equal(session.players.map((p) => p.id).join(','), 'b,a')
  })
})

test('goToPreviousRoundSnapshot applies saved order for prior round', () => {
  const session = createTestSession({
    players: [testPlayer('a'), testPlayer('b')],
    playerOrderByRound: { '1': ['a', 'b'], '2': ['b', 'a'] },
    round: 2,
  })
  const prev = goToPreviousRoundSnapshot(session, Date.now())
  assert.ok(prev)
  assert.equal(prev.round, 1)
  assert.deepEqual(prev.players.map((p) => p.id), ['a', 'b'])
})

test('removePlayerSnapshot banks active segment and clears live turn', () => {
  withFakeNow(1000, (advance) => {
    let session = createTestSession({
      players: [testPlayer('a'), testPlayer('b')],
      playerOrderByRound: { '1': ['a', 'b'] },
      hardPassEnabled: true,
      hardPassOrderNextRound: true,
      hardPassOrderByRound: { '1': ['b'] },
      activePlayerId: 'a',
      turnStartedAt: 1000,
      turnStartedRound: 1,
    })
    advance(2500)
    session = removePlayerSnapshot(session, 'a', Date.now())
    assert.ok(session)
    assert.equal(session.players.length, 1)
    assert.equal(session.players[0].id, 'b')
    assert.equal(session.activePlayerId, null)
    assert.equal(session.hardPassOrderByRound['1']?.includes('b'), true)
  })
})

test('applyPlayerOrder appends players missing from id order', () => {
  const players = [testPlayer('a'), testPlayer('b'), testPlayer('c')]
  const ordered = applyPlayerOrder(players, ['c', 'a'])
  assert.deepEqual(ordered.map((p) => p.id), ['c', 'a', 'b'])
})
