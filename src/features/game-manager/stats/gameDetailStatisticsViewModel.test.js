import assert from 'node:assert/strict'
import test from 'node:test'
import { SCORE_ENTRY_MODES } from '../domain/playSession.js'
import { buildGameDetailStatisticsViewModel } from './gameDetailStatisticsViewModel.js'

const gameKey = { kind: 'catalog', catalogEntryId: '295947' }
const game = { kind: 'catalog', catalogEntryId: '295947', title: 'Cascadia' }

function session(partial) {
  return {
    id: 's1',
    state: 'complete',
    game,
    presentPlayers: [
      { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
    ],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50, sam: 40 } },
    timerExport: {
      durationMs: 60_000,
      seats: [
        { recordedPlayerId: 'ada', bankedMs: 30_000 },
        { recordedPlayerId: 'sam', bankedMs: 30_000 },
      ],
    },
    createdAt: 1,
    ...partial,
  }
}

test('game detail statistics is null when title has no play sessions', () => {
  const vm = buildGameDetailStatisticsViewModel({
    gameKey,
    people: [{ id: 'ada', name: 'Ada', color: '#1' }],
    sessions: [],
  })
  assert.equal(vm, null)
})

test('game detail statistics includes sittings, play time, win share, and person figures', () => {
  const people = [
    { id: 'ada', name: 'Ada', color: '#1' },
    { id: 'sam', name: 'Sam', color: '#2' },
  ]
  const sessions = [
    session({ id: '1' }),
    session({
      id: '2',
      state: 'playing',
      score: null,
      timerExport: { durationMs: 20_000, seats: [{ recordedPlayerId: 'ada', bankedMs: 10_000 }] },
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
    }),
    session({
      id: 'other',
      game: { kind: 'catalog', catalogEntryId: '13', title: 'Catan' },
    }),
  ]
  const vm = buildGameDetailStatisticsViewModel({ gameKey, people, sessions })
  assert.ok(vm)
  assert.equal(vm.sittings, 2)
  assert.equal(vm.playTimeMs, 80_000)
  assert.equal(vm.winShareRows.length, 1)
  assert.equal(vm.winShareRows[0].personId, 'ada')
  assert.equal(vm.people.length, 2)
  const ada = vm.people.find((p) => p.personId === 'ada')
  assert.equal(ada.playCount, 2)
  assert.equal(ada.personalBest, 50)
  assert.equal(ada.averageScore, 50)
  assert.ok(typeof ada.pointsPerMinute === 'number')
  assert.equal(ada.sessionWins, 1)
  assert.equal(ada.winPercentage, 1)
})

test('game detail people ordered by sessions desc, then wins desc, then name', () => {
  const people = [
    { id: 'zoe', name: 'Zoe', color: '#3' },
    { id: 'ada', name: 'Ada', color: '#1' },
    { id: 'sam', name: 'Sam', color: '#2' },
    { id: 'ben', name: 'Ben', color: '#4' },
  ]
  const sessions = [
    session({
      id: '1',
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50, sam: 40 } },
    }),
    session({
      id: '2',
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 20, sam: 40 } },
    }),
    session({
      id: '3',
      presentPlayers: [
        { recordedPlayerId: 'zoe', name: 'Zoe', color: '#3' },
        { recordedPlayerId: 'ben', name: 'Ben', color: '#4' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { zoe: 10, ben: 5 } },
    }),
    session({
      id: '4',
      presentPlayers: [{ recordedPlayerId: 'zoe', name: 'Zoe', color: '#3' }],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { zoe: 1 } },
    }),
    session({
      id: '5',
      presentPlayers: [{ recordedPlayerId: 'zoe', name: 'Zoe', color: '#3' }],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { zoe: 2 } },
    }),
  ]
  const vm = buildGameDetailStatisticsViewModel({ gameKey, people, sessions })
  assert.deepEqual(
    vm.people.map((p) => p.personId),
    ['zoe', 'ada', 'sam', 'ben'],
  )
})
