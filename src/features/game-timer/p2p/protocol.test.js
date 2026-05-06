import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidSnapshot } from './protocol.js'

function baseSnapshot() {
  return {
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  }
}

test('snapshot accepts missing or numeric totalGameStartedAt', () => {
  assert.equal(isValidSnapshot(baseSnapshot()), true)
  assert.equal(isValidSnapshot({ ...baseSnapshot(), totalGameStartedAt: null }), true)
  assert.equal(isValidSnapshot({ ...baseSnapshot(), totalGameStartedAt: 1234 }), true)
})

test('snapshot rejects invalid totalGameStartedAt type', () => {
  assert.equal(isValidSnapshot({ ...baseSnapshot(), totalGameStartedAt: '1234' }), false)
})
