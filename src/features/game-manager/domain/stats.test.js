import assert from 'node:assert/strict'
import test from 'node:test'
import { SCORE_ENTRY_MODES } from './playSession.js'
import {
  averageScoreForPersonAtGame,
  personalBestForPersonAtGame,
  playCountForPersonAtGame,
  pointsPerMinuteForPersonAtGame,
} from './stats.js'

const gameKey = { kind: 'catalog', catalogEntryId: '295947' }

function session(partial) {
  return {
    state: 'complete',
    game: { kind: 'catalog', catalogEntryId: '295947', title: 'Cascadia' },
    presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
    score: null,
    timerExport: null,
    ...partial,
  }
}

test('play count includes partial sessions for that person and game', () => {
  const sessions = [
    session({ state: 'playing', score: null }),
    session({
      state: 'complete',
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 40 } },
    }),
    session({
      state: 'complete',
      game: { kind: 'catalog', catalogEntryId: '13', title: 'Catan' },
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 10 } },
    }),
  ]
  assert.equal(playCountForPersonAtGame(sessions, 'ada', gameKey), 2)
})

test('personal best and average use only points scores', () => {
  const sessions = [
    session({
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 40 } },
    }),
    session({
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50 } },
    }),
    session({
      score: { mode: 'shared', shared: 99 },
    }),
    session({
      score: { mode: SCORE_ENTRY_MODES.OUTCOMES, outcomes: { ada: 'win' } },
    }),
    session({
      score: { mode: 'per_player', perPlayer: { ada: 60 } },
    }),
  ]
  assert.equal(personalBestForPersonAtGame(sessions, 'ada', gameKey), 60)
  assert.equal(averageScoreForPersonAtGame(sessions, 'ada', gameKey), 50)
})

test('points per minute requires timer export duration', () => {
  const withoutDuration = [
    session({
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 45 } },
    }),
  ]
  assert.equal(pointsPerMinuteForPersonAtGame(withoutDuration, 'ada', gameKey), null)

  const withDuration = [
    session({
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 45 } },
      timerExport: { durationMs: 45 * 60 * 1000 },
    }),
  ]
  assert.equal(pointsPerMinuteForPersonAtGame(withDuration, 'ada', gameKey), 1)
})
