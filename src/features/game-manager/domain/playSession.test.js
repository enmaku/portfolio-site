import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SCORE_ENTRY_MODES,
  addPresentPlayer,
  canCompletePlaySession,
  createPlaySession,
  dropOutPresentPlayer,
  reopenPlaySessionForScoring,
  setPlaySessionScore,
  setPresentPlayers,
  transitionPlaySessionState,
} from './playSession.js'

function present(id, name = id) {
  return { recordedPlayerId: id, name, color: '#112233' }
}

function toPlaying(session) {
  return transitionPlaySessionState(session, 'playing')
}

function toScoring(session) {
  let next = session
  if (next.state === 'setup') next = toPlaying(next)
  if (next.state === 'playing') next = transitionPlaySessionState(next, 'scoring')
  return next
}

test('cannot complete play session without full points scores', () => {
  let session = createPlaySession({
    id: 's1',
    game: { kind: 'catalog', catalogEntryId: '295947', title: 'Cascadia' },
    presentPlayers: [present('p1', 'Ada'), present('p2', 'Bob')],
  })
  session = toScoring(session)
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.POINTS,
    perPlayer: { p1: 40 },
  })

  assert.equal(canCompletePlaySession(session), false)
  assert.throws(() => transitionPlaySessionState(session, 'complete'), /complete/i)
})

test('can complete with full points scores through playing', () => {
  let session = createPlaySession({
    id: 's2',
    game: { kind: 'custom', title: 'Homebrew' },
    presentPlayers: [present('p1'), present('p2')],
  })
  session = toScoring(session)
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.POINTS,
    perPlayer: { p1: 10, p2: 12 },
  })
  session = transitionPlaySessionState(session, 'complete')
  assert.equal(session.state, 'complete')
  assert.equal(session.score.mode, SCORE_ENTRY_MODES.POINTS)
})

test('setup cannot skip directly to scoring', () => {
  const session = createPlaySession({
    id: 's-skip',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1')],
  })
  assert.throws(() => transitionPlaySessionState(session, 'scoring'), /Invalid play session transition/)
})

test('setup to playing requires at least one present player', () => {
  const session = createPlaySession({
    id: 's-empty',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
  })
  assert.throws(() => transitionPlaySessionState(session, 'playing'), /present player/i)
})

test('setPresentPlayers replaces attendance', () => {
  let session = createPlaySession({
    id: 's-set',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
  })
  session = setPresentPlayers(session, [present('p1'), present('p2')])
  assert.deepEqual(
    session.presentPlayers.map((p) => p.recordedPlayerId),
    ['p1', 'p2'],
  )
})

test('addPresentPlayer ignores duplicates', () => {
  let session = createPlaySession({
    id: 's-add',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1')],
  })
  session = addPresentPlayer(session, present('p1', 'Ada'))
  session = addPresentPlayer(session, present('p2', 'Bob'))
  assert.deepEqual(
    session.presentPlayers.map((p) => p.recordedPlayerId),
    ['p1', 'p2'],
  )
})

test('drop out removes present player and their draft score row', () => {
  let session = createPlaySession({
    id: 's3',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1'), present('p2')],
  })
  session = toScoring(session)
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.POINTS,
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
  session = toScoring(session)
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.POINTS,
    perPlayer: { p1: 42 },
  })
  session = transitionPlaySessionState(session, 'complete')
  session = reopenPlaySessionForScoring(session)
  assert.equal(session.state, 'scoring')
})

test('empty present players cannot complete even with points filled', () => {
  let session = createPlaySession({
    id: 's5',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1')],
  })
  session = toScoring(session)
  session = dropOutPresentPlayer(session, 'p1')
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.POINTS,
    perPlayer: { p1: 1 },
  })
  assert.equal(canCompletePlaySession(session), false)
})

test('outcomes require win loss or draw for every present player', () => {
  let session = createPlaySession({
    id: 's6',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1'), present('p2')],
  })
  session = toScoring(session)
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.OUTCOMES,
    outcomes: { p1: 'win', p2: 'maybe' },
  })
  assert.equal(canCompletePlaySession(session), false)
  session = setPlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.OUTCOMES,
    outcomes: { p1: 'win', p2: 'loss' },
  })
  assert.equal(canCompletePlaySession(session), true)
})

test('legacy per_player mode still completes as points', () => {
  let session = createPlaySession({
    id: 's-legacy',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
    presentPlayers: [present('p1')],
  })
  session = toScoring(session)
  session = {
    ...session,
    score: { mode: 'per_player', perPlayer: { p1: 9 } },
  }
  assert.equal(canCompletePlaySession(session), true)
})

test('createPlaySession does not include addToCollection', () => {
  const session = createPlaySession({
    id: 's7',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'X' },
  })
  assert.equal('addToCollection' in session, false)
})
