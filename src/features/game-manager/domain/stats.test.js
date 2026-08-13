import assert from 'node:assert/strict'
import test from 'node:test'
import { SCORE_ENTRY_MODES } from './playSession.js'
import {
  averageScoreForPersonAtGame,
  bankedTimeMsForPerson,
  hIndexForPerson,
  hIndexFromSessions,
  isFirstPlayAtGame,
  isPersonalBestInSession,
  personalBestForPersonAtGame,
  playCountForPersonAtGame,
  playTimeMsFromSessions,
  pointsPerMinuteForPersonAtGame,
  sessionWinPersonIds,
  winPercentageForPerson,
  winShareRows,
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

test('points per minute uses that person banked time from timer export', () => {
  const withoutBanked = [
    session({
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 45 } },
      timerExport: { durationMs: 45 * 60 * 1000, seats: [{ name: 'Ada', color: '#1', bankedMs: 0 }] },
    }),
  ]
  assert.equal(pointsPerMinuteForPersonAtGame(withoutBanked, 'ada', gameKey), null)

  const withBanked = [
    session({
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 45 } },
      timerExport: {
        durationMs: 90 * 60 * 1000,
        seats: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1', bankedMs: 45 * 60 * 1000 }],
      },
    }),
  ]
  assert.equal(pointsPerMinuteForPersonAtGame(withBanked, 'ada', gameKey), 1)
})

test('sessionWinPersonIds: incomplete sessions yield no winners', () => {
  const s = session({
    state: 'scoring',
    presentPlayers: [
      { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
    ],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50, sam: 40 } },
  })
  assert.deepEqual(sessionWinPersonIds(s), [])
})

test('sessionWinPersonIds: points highest score wins; ties share', () => {
  const sole = session({
    presentPlayers: [
      { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
    ],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50, sam: 40 } },
  })
  assert.deepEqual(sessionWinPersonIds(sole), ['ada'])

  const tied = session({
    presentPlayers: [
      { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
    ],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 45, sam: 45 } },
  })
  assert.deepEqual(sessionWinPersonIds(tied).sort(), ['ada', 'sam'])
})

test('sessionWinPersonIds: outcomes win marks only; draws are not wins', () => {
  const s = session({
    presentPlayers: [
      { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      { recordedPlayerId: 'lee', name: 'Lee', color: '#3' },
    ],
    score: {
      mode: SCORE_ENTRY_MODES.OUTCOMES,
      outcomes: { ada: 'win', sam: 'loss', lee: 'draw' },
    },
  })
  assert.deepEqual(sessionWinPersonIds(s), ['ada'])
})

test('sessionWinPersonIds: removed seats never win', () => {
  const s = session({
    presentPlayers: [
      { recordedPlayerId: null, name: null, color: null, removed: true },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
    ],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { sam: 10 } },
  })
  assert.deepEqual(sessionWinPersonIds(s), ['sam'])
})

test('winShareRows: credits from complete sittings; removed excluded; shares sum to 1', () => {
  const people = [
    { id: 'ada', name: 'Ada', color: '#1' },
    { id: 'sam', name: 'Sam', color: '#2' },
  ]
  const sessions = [
    session({
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50, sam: 40 } },
    }),
    session({
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 30, sam: 30 } },
    }),
    session({
      state: 'playing',
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
      score: null,
    }),
    session({
      presentPlayers: [
        { recordedPlayerId: null, name: null, color: null, removed: true },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.OUTCOMES, outcomes: { sam: 'win' } },
    }),
  ]
  const rows = winShareRows(sessions, people)
  assert.equal(rows.length, 2)
  const byId = Object.fromEntries(rows.map((r) => [r.personId, r]))
  // ada: 1 sole + 1 shared tie = 2; sam: 1 shared tie + 1 outcomes = 2; total credits 4
  assert.equal(byId.ada.credits, 2)
  assert.equal(byId.sam.credits, 2)
  assert.equal(byId.ada.share + byId.sam.share, 1)
})

test('winPercentageForPerson: wins divided by complete sittings present', () => {
  const sessions = [
    session({
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50, sam: 40 } },
    }),
    session({
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 20, sam: 40 } },
    }),
    session({
      state: 'scoring',
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 99 } },
    }),
  ]
  assert.equal(winPercentageForPerson(sessions, 'ada'), 0.5)
  assert.equal(winPercentageForPerson(sessions, 'sam'), 0.5)
  assert.equal(winPercentageForPerson(sessions, 'nobody'), null)
})

test('playTimeMsFromSessions sums wall-clock durationMs; missing export credits nothing', () => {
  const sessions = [
    session({ timerExport: { durationMs: 60_000, seats: [] } }),
    session({ timerExport: { durationMs: 30_000, seats: [] } }),
    session({ timerExport: null }),
    session({ timerExport: { durationMs: 'bad', seats: [] } }),
  ]
  assert.equal(playTimeMsFromSessions(sessions), 90_000)
})

test('bankedTimeMsForPerson sums that person seat bankedMs across sittings', () => {
  const sessions = [
    session({
      timerExport: {
        durationMs: 90_000,
        seats: [
          { recordedPlayerId: 'ada', bankedMs: 40_000 },
          { recordedPlayerId: 'sam', bankedMs: 50_000 },
        ],
      },
    }),
    session({
      timerExport: {
        durationMs: 60_000,
        seats: [{ recordedPlayerId: 'ada', bankedMs: 20_000 }],
      },
    }),
    session({ timerExport: null }),
  ]
  assert.equal(bankedTimeMsForPerson(sessions, 'ada'), 60_000)
  assert.equal(bankedTimeMsForPerson(sessions, 'sam'), 50_000)
  assert.equal(bankedTimeMsForPerson(sessions, 'nobody'), 0)
})

test('hIndexFromSessions is largest N with N games each having at least N sittings', () => {
  const g = (id) => ({ kind: 'catalog', catalogEntryId: id, title: id })
  const sessions = [
    session({ game: g('a') }),
    session({ game: g('a') }),
    session({ game: g('a') }),
    session({ game: g('b') }),
    session({ game: g('b') }),
    session({ game: g('c') }),
    session({ state: 'playing', game: g('b') }),
  ]
  // a:3, b:3 (incl partial), c:1 → N=2 (two games with ≥2)
  assert.equal(hIndexFromSessions(sessions), 2)
  assert.equal(hIndexFromSessions([]), 0)
})

test('hIndexForPerson only counts sittings where that person was present', () => {
  const g = (id) => ({ kind: 'catalog', catalogEntryId: id, title: id })
  const sessions = [
    session({
      game: g('a'),
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
    }),
    session({
      game: g('a'),
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
    }),
    session({
      game: g('b'),
      presentPlayers: [{ recordedPlayerId: 'sam', name: 'Sam', color: '#2' }],
    }),
    session({
      game: g('b'),
      presentPlayers: [{ recordedPlayerId: 'sam', name: 'Sam', color: '#2' }],
    }),
  ]
  assert.equal(hIndexForPerson(sessions, 'ada'), 1)
  assert.equal(hIndexForPerson(sessions, 'sam'), 1)
})

test('isFirstPlayAtGame: earliest sitting at title including partials', () => {
  const sessions = [
    session({ id: 's1', createdAt: 100, state: 'playing' }),
    session({ id: 's2', createdAt: 200, score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 10 } } }),
  ]
  assert.equal(isFirstPlayAtGame(sessions, 'ada', gameKey, 's1'), true)
  assert.equal(isFirstPlayAtGame(sessions, 'ada', gameKey, 's2'), false)
  assert.equal(isFirstPlayAtGame(sessions, 'sam', gameKey, 's1'), false)
})

test('isPersonalBestInSession: true when this complete points sitting sets a new high', () => {
  const prior = session({
    id: 'old',
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 40 } },
  })
  const current = session({
    id: 'new',
    presentPlayers: [
      { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
    ],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 55, sam: 10 } },
  })
  assert.equal(isPersonalBestInSession([prior, current], 'ada', gameKey, current), true)
  assert.equal(isPersonalBestInSession([prior, current], 'sam', gameKey, current), false)

  const notBest = session({
    id: 'later',
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 30 } },
  })
  assert.equal(isPersonalBestInSession([prior, current, notBest], 'ada', gameKey, notBest), false)

  const outcomes = session({
    id: 'out',
    score: { mode: SCORE_ENTRY_MODES.OUTCOMES, outcomes: { ada: 'win' } },
  })
  assert.equal(isPersonalBestInSession([outcomes], 'ada', gameKey, outcomes), false)
})

test('isPersonalBestInSession: first play is never a personal best callout', () => {
  const debut = session({
    id: 'debut',
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 99 } },
  })
  assert.equal(isFirstPlayAtGame([debut], 'ada', gameKey, 'debut'), true)
  assert.equal(isPersonalBestInSession([debut], 'ada', gameKey, debut), false)
})
