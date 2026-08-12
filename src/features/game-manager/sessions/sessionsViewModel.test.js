import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SCORE_ENTRY_MODES,
  applyTimerExport,
  canCompletePlaySession,
  gameRefFromCollectionItem,
  includePresentPlayer,
  movePlaySession,
  replacePresentPlayers,
  startPlaySessionDraft,
  writePlaySessionScore,
} from './sessionsViewModel.js'

function withExport(session) {
  return applyTimerExport(session, {
    durationMs: 1_000,
    seats: session.presentPlayers.map((p) => ({
      recordedPlayerId: p.recordedPlayerId,
      name: p.name,
      color: p.color,
      bankedMs: 500,
    })),
  })
}

test('startPlaySessionDraft begins in setup and advances through playing', () => {
  let session = startPlaySessionDraft({
    id: 's1',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'Catan' },
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
  })
  assert.equal(session.state, 'setup')
  session = movePlaySession(session, 'playing')
  assert.equal(session.state, 'playing')
  session = withExport(session)
  session = movePlaySession(session, 'scoring')
  assert.equal(session.state, 'scoring')
})

test('gameRefFromCollectionItem maps shelf catalog and custom items', () => {
  assert.deepEqual(
    gameRefFromCollectionItem({
      kind: 'catalog',
      catalogEntryId: '9',
      title: 'X',
      thumbnailUrl: 'https://example.com/t.jpg',
    }),
    {
      kind: 'catalog',
      catalogEntryId: '9',
      title: 'X',
      thumbnailUrl: 'https://example.com/t.jpg',
      imageUrl: null,
      minPlayers: null,
      maxPlayers: null,
      playingTime: null,
      yearPublished: null,
    },
  )
  assert.deepEqual(gameRefFromCollectionItem({ kind: 'custom', id: 'c1', title: 'Home' }), {
    kind: 'custom',
    id: 'c1',
    title: 'Home',
  })
})

test('replacePresentPlayers and includePresentPlayer update attendance', () => {
  let session = startPlaySessionDraft({
    id: 's-attend',
    game: { kind: 'custom', id: 'c1', title: 'Home' },
  })
  session = replacePresentPlayers(session, [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }])
  session = includePresentPlayer(session, { recordedPlayerId: 'p2', name: 'Bob', color: '#222222' })
  assert.deepEqual(
    session.presentPlayers.map((p) => p.recordedPlayerId),
    ['p1', 'p2'],
  )
})

test('complete requires full score via sessions view model helpers', () => {
  let session = startPlaySessionDraft({
    id: 's2',
    game: { kind: 'custom', id: 'c1', title: 'Home' },
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
  })
  session = movePlaySession(session, 'playing')
  session = withExport(session)
  session = movePlaySession(session, 'scoring')
  session = writePlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.POINTS,
    perPlayer: { p1: 12 },
  })
  assert.equal(canCompletePlaySession(session), true)
  session = movePlaySession(session, 'complete')
  assert.equal(session.state, 'complete')
})
