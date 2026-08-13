import assert from 'node:assert/strict'
import test from 'node:test'
import { SCORE_ENTRY_MODES } from '../domain/playSession.js'
import { buildPersonStatisticsViewModel } from './personStatisticsViewModel.js'

const gameA = { kind: 'catalog', catalogEntryId: 'a', title: 'Alpha' }
const gameB = { kind: 'catalog', catalogEntryId: 'b', title: 'Beta' }

function session(partial) {
  return {
    id: 's1',
    state: 'complete',
    game: gameA,
    presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 40 } },
    timerExport: {
      durationMs: 60_000,
      seats: [{ recordedPlayerId: 'ada', bankedMs: 30_000 }],
    },
    createdAt: 1,
    ...partial,
  }
}

test('person statistics is null when person has no sittings', () => {
  const vm = buildPersonStatisticsViewModel({
    person: { id: 'ada', name: 'Ada', color: '#1' },
    sessions: [],
  })
  assert.equal(vm, null)
})

test('person statistics headlines and per-game rows', () => {
  const person = { id: 'ada', name: 'Ada', color: '#1' }
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
      game: gameB,
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 20 } },
      timerExport: {
        durationMs: 40_000,
        seats: [{ recordedPlayerId: 'ada', bankedMs: 20_000 }],
      },
    }),
    session({
      id: '3',
      game: gameB,
      state: 'playing',
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
      score: null,
      timerExport: { durationMs: 10_000, seats: [{ recordedPlayerId: 'ada', bankedMs: 5_000 }] },
    }),
  ]
  const vm = buildPersonStatisticsViewModel({ person, sessions })
  assert.ok(vm)
  assert.equal(vm.personId, 'ada')
  assert.equal(vm.name, 'Ada')
  assert.equal(vm.sittingsPlayed, 3)
  assert.equal(vm.gamesPlayed, 2)
  assert.equal(vm.bankedTimeMs, 55_000)
  assert.equal(vm.sessionWins, 2)
  assert.equal(vm.winPercentage, 1)
  assert.equal(vm.hIndex, 1)
  assert.equal(vm.games.length, 2)
  // Beta has 2 sittings, Alpha 1 → Beta first
  assert.equal(vm.games[0].gameTitle, 'Beta')
  assert.equal(vm.games[0].playCount, 2)
  assert.equal(vm.games[1].gameTitle, 'Alpha')
  assert.equal(vm.games[1].playCount, 1)
  assert.equal(vm.games[1].personalBest, 50)
})

test('person statistics history is complete sittings newest-first with callouts', () => {
  const person = { id: 'ada', name: 'Ada', color: '#1' }
  const sessions = [
    session({
      id: 'old',
      createdAt: 100,
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 30, sam: 40 } },
    }),
    session({
      id: 'pb',
      createdAt: 300,
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 55, sam: 40 } },
    }),
    session({
      id: 'mid',
      createdAt: 200,
      presentPlayers: [
        { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
        { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
      ],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 45, sam: 40 } },
    }),
    session({
      id: 'open',
      createdAt: 400,
      state: 'playing',
      score: null,
      timerExport: { durationMs: 10_000, seats: [{ recordedPlayerId: 'ada', bankedMs: 5_000 }] },
    }),
  ]
  const vm = buildPersonStatisticsViewModel({ person, sessions })
  assert.deepEqual(
    vm.history.map((row) => row.sessionId),
    ['pb', 'mid', 'old'],
  )
  assert.equal(vm.history[0].isWinner, true)
  assert.equal(vm.history[0].isPersonalBest, true)
  assert.equal(vm.history[0].isFirstPlay, false)
  assert.equal(vm.history[2].isWinner, false)
  assert.equal(vm.history[2].isFirstPlay, true)
  assert.equal(vm.history[2].isPersonalBest, false)
})
