import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SCORE_ENTRY_MODES,
  canCompletePlaySession,
  createPlaySession,
  dropOutPresentPlayer,
  reopenPlaySessionForScoring,
  setPlaySessionScore,
  transitionPlaySessionState,
} from './playSession.js'

function present(id, name = id) {
  return { recordedPlayerId: id, name, color: '#112233' }
}

test('cannot complete play session without full per-player scores', () => {
  let session = createPlaySession({
    id: 's1',
    game: { kind: 'catalog', catalogEntryId: '295947', title: 'Cascadia' },
  })
  session = transitionPlaySessionState(session, 'scoring')
  session = {
    ...session,
    presentPlayers: [present('p1', 'Ada'), present('p2', 'Bob')],
  }
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.PER_PLAYER,
    perPlayer: { p1: 40 },
  })

  assert.equal(canCompletePlaySession(session), false)
  assert.throws(() => transitionPlaySessionState(session, 'complete'), /complete/i)
})

test('can complete with full per-player scores after setup to scoring skip', () => {
  let session = createPlaySession({
    id: 's2',
    game: { kind: 'custom', title: 'Homebrew' },
    presentPlayers: [present('p1'), present('p2')],
  })
  session = transitionPlaySessionState(session, 'scoring')
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.PER_PLAYER,
    perPlayer: { p1: 10, p2: 12 },
  })
  session = transitionPlaySessionState(session, 'complete')
  assert.equal(session.state, 'complete')
})

test('drop out removes present player and their draft score row', () => {
  let session = createPlaySession({
    id: 's3',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1'), present('p2')],
  })
  session = transitionPlaySessionState(session, 'scoring')
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.PER_PLAYER,
    perPlayer: { p1: 5, p2: 8 },
  })
  session = dropOutPresentPlayer(session, 'p2')
  assert.deepEqual(
    session.presentPlayers.map((p) => p.recordedPlayerId),
    ['p1'],
  )
  assert.deepEqual(session.score.perPlayer, { p1: 5 })
})

test('complete session can reopen to scoring', () => {
  let session = createPlaySession({
    id: 's4',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1')],
  })
  session = transitionPlaySessionState(session, 'scoring')
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.SHARED,
    shared: 42,
  })
  session = transitionPlaySessionState(session, 'complete')
  session = reopenPlaySessionForScoring(session)
  assert.equal(session.state, 'scoring')
})

test('empty present players cannot complete even with shared score', () => {
  let session = createPlaySession({
    id: 's5',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
  })
  session = transitionPlaySessionState(session, 'scoring')
  session = setPlaySessionScore(session, { mode: SCORE_ENTRY_MODES.SHARED, shared: 1 })
  assert.equal(canCompletePlaySession(session), false)
})

test('outcome marks require win loss or draw for every present player', () => {
  let session = createPlaySession({
    id: 's6',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1'), present('p2')],
  })
  session = transitionPlaySessionState(session, 'scoring')
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.OUTCOME_MARKS,
    outcomes: { p1: 'win', p2: 'maybe' },
  })
  assert.equal(canCompletePlaySession(session), false)
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.OUTCOME_MARKS,
    outcomes: { p1: 'win', p2: 'loss' },
  })
  assert.equal(canCompletePlaySession(session), true)
})
