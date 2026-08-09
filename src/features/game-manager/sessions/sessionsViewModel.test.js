import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SCORE_ENTRY_MODES,
  canCompletePlaySession,
  maybeAddSessionGameToCollection,
  movePlaySession,
  startPlaySessionDraft,
  writePlaySessionScore,
} from './sessionsViewModel.js'

test('startPlaySessionDraft begins in setup and can skip to scoring', () => {
  let session = startPlaySessionDraft({
    id: 's1',
    game: { kind: 'catalog', catalogEntryId: '1', title: 'Catan' },
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
  })
  assert.equal(session.state, 'setup')
  session = movePlaySession(session, 'scoring')
  assert.equal(session.state, 'scoring')
})

test('maybeAddSessionGameToCollection respects addToCollection flag', () => {
  const game = { kind: 'catalog', catalogEntryId: '9', title: 'X' }
  const skipped = maybeAddSessionGameToCollection([], {
    game,
    addToCollection: false,
  })
  assert.equal(skipped.changed, false)

  const added = maybeAddSessionGameToCollection([], {
    game,
    addToCollection: true,
  })
  assert.equal(added.changed, true)
  assert.equal(added.items.length, 1)
})

test('complete requires full score via sessions view model helpers', () => {
  let session = startPlaySessionDraft({
    id: 's2',
    game: { kind: 'custom', id: 'c1', title: 'Home' },
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
  })
  session = movePlaySession(session, 'scoring')
  session = writePlaySessionScore(session, {
    mode: SCORE_ENTRY_MODES.PER_PLAYER,
    perPlayer: { p1: 12 },
  })
  assert.equal(canCompletePlaySession(session), true)
  session = movePlaySession(session, 'complete')
  assert.equal(session.state, 'complete')
})
