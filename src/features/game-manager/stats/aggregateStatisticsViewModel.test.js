import assert from 'node:assert/strict'
import test from 'node:test'
import { SCORE_ENTRY_MODES } from '../domain/playSession.js'
import { buildAggregateStatisticsViewModel } from './aggregateStatisticsViewModel.js'
import { buildWinShareChart } from './buildWinShareChart.js'

const gameA = { kind: 'catalog', catalogEntryId: 'a', title: 'Alpha' }
const gameB = { kind: 'catalog', catalogEntryId: 'b', title: 'Beta' }

function session(partial) {
  return {
    id: 's1',
    state: 'complete',
    game: gameA,
    presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 10 } },
    timerExport: null,
    createdAt: 1,
    ...partial,
  }
}

test('aggregate statistics with collection only shows zeros and empty win share', () => {
  const vm = buildAggregateStatisticsViewModel({
    people: [{ id: 'ada', name: 'Ada', color: '#1' }],
    sessions: [],
    gamesInCollection: 4,
  })
  assert.equal(vm.sessionsRecorded, 0)
  assert.equal(vm.gamesPlayed, 0)
  assert.equal(vm.gamesInCollection, 4)
  assert.equal(vm.playTimeMs, 0)
  assert.equal(vm.hIndex, 0)
  assert.deepEqual(vm.winShareRows, [])
  assert.deepEqual(vm.people, [])
})

test('aggregate statistics headlines, win share, h-index, and per-person rows', () => {
  const people = [
    { id: 'ada', name: 'Ada', color: '#1' },
    { id: 'sam', name: 'Sam', color: '#2' },
  ]
  const sessions = [
    session({
      id: '1',
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 50, sam: 40 } },
      timerExport: {
        durationMs: 60_000,
        seats: [
          { recordedPlayerId: 'ada', bankedMs: 25_000 },
          { recordedPlayerId: 'sam', bankedMs: 35_000 },
        ],
      },
    }),
    session({
      id: '2',
      game: gameB,
      state: 'playing',
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
      score: null,
      timerExport: { durationMs: 30_000, seats: [{ recordedPlayerId: 'ada', bankedMs: 10_000 }] },
    }),
    session({
      id: '3',
      game: gameB,
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 20, sam: 40 } },
      timerExport: {
        durationMs: 40_000,
        seats: [
          { recordedPlayerId: 'ada', bankedMs: 15_000 },
          { recordedPlayerId: 'sam', bankedMs: 25_000 },
        ],
      },
    }),
  ]
  const vm = buildAggregateStatisticsViewModel({ people, sessions, gamesInCollection: 5 })
  assert.equal(vm.sessionsRecorded, 3)
  assert.equal(vm.gamesPlayed, 2)
  assert.equal(vm.gamesInCollection, 5)
  assert.equal(vm.playTimeMs, 130_000)
  assert.equal(vm.hIndex, 1)
  assert.equal(vm.winShareRows.length, 2)
  assert.equal(vm.people.length, 2)
  const ada = vm.people.find((p) => p.personId === 'ada')
  assert.equal(ada.sittingsPlayed, 3)
  assert.equal(ada.gamesPlayed, 2)
  assert.equal(ada.bankedTimeMs, 50_000)
  assert.equal(ada.sessionWins, 1)
  assert.equal(ada.winPercentage, 0.5)
  assert.equal(ada.hIndex, 1)
  assert.equal(ada.averageScore, undefined)
  assert.equal(ada.pointsPerMinute, undefined)
})

test('aggregate people ordered by sessions desc, then wins desc, then name', () => {
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
  // zoe: 3 sessions, 3 wins; ada: 2 sessions, 1 win; sam: 2 sessions, 1 win; ben: 1 session, 0 wins
  // tie ada/sam on sessions+wins → alphabetical Ada before Sam
  const vm = buildAggregateStatisticsViewModel({ people, sessions, gamesInCollection: 1 })
  assert.deepEqual(
    vm.people.map((p) => p.personId),
    ['zoe', 'ada', 'sam', 'ben'],
  )
})

test('buildWinShareChart maps win share rows to chart contract', () => {
  const chart = buildWinShareChart([
    { personId: 'ada', name: 'Ada', credits: 2, share: 0.5 },
    { personId: 'sam', name: 'Sam', credits: 2, share: 0.5 },
  ])
  assert.equal(chart.status, 'ok')
  assert.deepEqual(chart.chart.keys, ['Ada', 'Sam'])
  assert.deepEqual(chart.chart.counts, [2, 2])
  assert.equal(chart.chart.total, 4)
  assert.equal(buildWinShareChart([]).status, 'error')
})
