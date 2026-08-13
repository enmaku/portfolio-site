import assert from 'node:assert/strict'
import test from 'node:test'
import { SCORE_ENTRY_MODES } from '../domain/playSession.js'
import { buildSessionStatisticsViewModel } from './sessionStatisticsViewModel.js'

const game = { kind: 'catalog', catalogEntryId: '295947', title: 'Cascadia' }

function session(partial) {
  return {
    id: 's-current',
    state: 'complete',
    game,
    presentPlayers: [
      { recordedPlayerId: 'ada', name: 'Ada', color: '#1' },
      { recordedPlayerId: 'sam', name: 'Sam', color: '#2' },
    ],
    score: null,
    timerExport: null,
    createdAt: 200,
    ...partial,
  }
}

test('points session statistics: per-person scores, times, PPM, callouts; no table sum', () => {
  const prior = session({
    id: 's-old',
    createdAt: 100,
    presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 30 } },
    timerExport: {
      durationMs: 60_000,
      seats: [{ recordedPlayerId: 'ada', bankedMs: 30_000 }],
    },
  })
  const current = session({
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 60, sam: 40 } },
    timerExport: {
      durationMs: 120_000,
      seats: [
        { recordedPlayerId: 'ada', bankedMs: 60_000 },
        { recordedPlayerId: 'sam', bankedMs: 60_000 },
      ],
    },
  })
  const vm = buildSessionStatisticsViewModel({ session: current, sessions: [prior, current] })
  assert.equal(vm.mode, SCORE_ENTRY_MODES.POINTS)
  assert.equal(vm.playTimeMs, 120_000)
  assert.deepEqual(vm.winnerIds.sort(), ['ada'])
  assert.equal(vm.totalPoints, undefined)
  assert.equal(vm.players.length, 2)
  const ada = vm.players.find((p) => p.personId === 'ada')
  const sam = vm.players.find((p) => p.personId === 'sam')
  assert.equal(ada.score, 60)
  assert.equal(ada.bankedMs, 60_000)
  assert.equal(ada.pointsPerMinute, 60)
  assert.equal(ada.isPersonalBest, true)
  assert.equal(ada.isFirstPlay, false)
  assert.equal(sam.isFirstPlay, true)
  assert.equal(sam.isPersonalBest, false)
  assert.equal(sam.outcome, undefined)
})

test('session statistics points per minute is 0 for zero or negative scores', () => {
  const current = session({
    score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: -4, sam: 0 } },
    timerExport: {
      durationMs: 120_000,
      seats: [
        { recordedPlayerId: 'ada', bankedMs: 60_000 },
        { recordedPlayerId: 'sam', bankedMs: 60_000 },
      ],
    },
  })
  const vm = buildSessionStatisticsViewModel({ session: current, sessions: [current] })
  const ada = vm.players.find((p) => p.personId === 'ada')
  const sam = vm.players.find((p) => p.personId === 'sam')
  assert.equal(ada.pointsPerMinute, 0)
  assert.equal(sam.pointsPerMinute, 0)
})

test('outcomes session statistics: outcomes and winners; no points chrome', () => {
  const current = session({
    score: {
      mode: SCORE_ENTRY_MODES.OUTCOMES,
      outcomes: { ada: 'win', sam: 'loss' },
    },
    timerExport: { durationMs: 90_000, seats: [{ recordedPlayerId: 'ada', bankedMs: 40_000 }] },
  })
  const vm = buildSessionStatisticsViewModel({ session: current, sessions: [current] })
  assert.equal(vm.mode, SCORE_ENTRY_MODES.OUTCOMES)
  assert.deepEqual(vm.winnerIds, ['ada'])
  assert.equal(vm.players[0].outcome, 'win')
  assert.equal(vm.players[0].score, undefined)
  assert.equal(vm.players[0].pointsPerMinute, undefined)
  assert.equal(vm.players[0].isPersonalBest, false)
  assert.equal(vm.players[0].isFirstPlay, true)
  assert.equal(vm.playTimeMs, 90_000)
})
