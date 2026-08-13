import assert from 'node:assert/strict'
import test from 'node:test'
import { SCORE_ENTRY_MODES } from '../domain/playSession.js'
import { buildStatsRows } from './statsViewModel.js'

test('buildStatsRows lists per person per game with play counts', () => {
  const people = [{ id: 'ada', name: 'Ada', color: '#1', saved: true }]
  const sessions = [
    {
      state: 'playing',
      game: { kind: 'catalog', catalogEntryId: '1', title: 'Catan' },
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
      score: null,
    },
    {
      state: 'complete',
      game: { kind: 'catalog', catalogEntryId: '1', title: 'Catan' },
      presentPlayers: [{ recordedPlayerId: 'ada', name: 'Ada', color: '#1' }],
      score: { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ada: 10 } },
    },
  ]
  const rows = buildStatsRows(people, sessions)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].playCount, 2)
  assert.equal(rows[0].personalBest, 10)
  assert.equal(rows[0].personColor, '#1')
  assert.equal(rows[0].pointsPerMinute, null)
})
