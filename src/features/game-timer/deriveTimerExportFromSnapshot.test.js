import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveTimerExportFromSnapshot } from './deriveTimerExportFromSnapshot.js'

test('deriveTimerExportFromSnapshot uses total game elapsed and per-seat banked including open turn', () => {
  const snapshot = {
    totalGameStartedAt: 1_000,
    activePlayerId: 'p1',
    turnStartedAt: 4_000,
    players: [
      {
        id: 'p1',
        name: 'Ada',
        color: '#ff0000',
        recordedPlayerId: 'rp-ada',
        bankedMs: 2_000,
        bankedMsByRound: { '1': 2_000 },
      },
      {
        id: 'p2',
        name: 'Bob',
        color: '#00ff00',
        recordedPlayerId: 'rp-bob',
        bankedMs: 5_000,
        bankedMsByRound: { '1': 5_000 },
      },
    ],
  }

  const exp = deriveTimerExportFromSnapshot(snapshot, 7_000)

  assert.equal(exp.durationMs, 6_000)
  assert.deepEqual(exp.seats, [
    {
      recordedPlayerId: 'rp-ada',
      name: 'Ada',
      color: '#ff0000',
      bankedMs: 5_000,
    },
    {
      recordedPlayerId: 'rp-bob',
      name: 'Bob',
      color: '#00ff00',
      bankedMs: 5_000,
    },
  ])
})

test('deriveTimerExportFromSnapshot omits recordedPlayerId when seat has none', () => {
  const snapshot = {
    totalGameStartedAt: null,
    activePlayerId: null,
    turnStartedAt: null,
    players: [{ id: 'p9', name: 'Guest', color: '#111111', bankedMs: 0, bankedMsByRound: {} }],
  }

  const exp = deriveTimerExportFromSnapshot(snapshot, 10_000)
  assert.equal(exp.durationMs, 0)
  assert.equal(exp.seats.length, 1)
  assert.equal(exp.seats[0].name, 'Guest')
  assert.equal(exp.seats[0].bankedMs, 0)
  assert.equal('recordedPlayerId' in exp.seats[0], false)
})
