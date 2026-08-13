import assert from 'node:assert/strict'
import test from 'node:test'
import { attachExportAndTransitionToScoring } from './attachExportAndTransitionToScoring.js'

test('attachExportAndTransitionToScoring persists export then scoring', async () => {
  /** @type {object | null} */
  let stored = {
    id: 'ps-1',
    state: 'playing',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    score: null,
    timerExport: null,
  }
  const writes = []
  const result = await attachExportAndTransitionToScoring({
    uid: 'u1',
    playSessionId: 'ps-1',
    timerExport: {
      durationMs: 5000,
      seats: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111', bankedMs: 4000 }],
    },
    getSession: async () => stored,
    upsertSession: async (_uid, _id, session) => {
      writes.push(session.state)
      stored = session
    },
    newId: () => 'rp_new',
  })
  assert.equal(result.state, 'scoring')
  assert.ok(result.timerExport)
  assert.deepEqual(writes, ['playing', 'scoring'])
})
