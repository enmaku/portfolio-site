import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerStore } from '../../stores/gameTimer.js'

test('applyLaunchConfig replaces leftover roster and keeps session option prefs', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  store.addPlayer({ name: 'Old', color: '#000000' })
  store.setHardPassEnabled(true)
  store.setHardPassOrderNextRound(true)
  store.setFullscreenEnabled(true)
  store.setTimingStripMode('non-player')

  store.applyLaunchConfig({
    seats: [
      { recordedPlayerId: 'rp-a', name: 'Ada', color: '#aa0000' },
      { recordedPlayerId: 'rp-b', name: 'Bob', color: '#00aa00' },
    ],
  })

  assert.equal(store.players.length, 2)
  assert.equal(store.players[0].name, 'Ada')
  assert.equal(store.players[0].recordedPlayerId, 'rp-a')
  assert.equal(store.players[1].recordedPlayerId, 'rp-b')
  assert.equal(store.activePlayerId, null)
  assert.equal(store.turnStartedAt, null)
  assert.equal(store.round, 1)
  assert.equal(store.totalGameStartedAt, null)
  assert.equal(store.hardPassEnabled, true)
  assert.equal(store.hardPassOrderNextRound, true)
  assert.equal(store.fullscreenEnabled, true)
  assert.equal(store.timingStripMode, 'non-player')
})

test('applyLaunchConfig restores bankedMs and durationMs from timer export', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  const before = Date.now()
  store.applyLaunchConfig({
    durationMs: 15_000,
    seats: [
      { recordedPlayerId: 'rp-a', name: 'Ada', color: '#aa0000', bankedMs: 7_000 },
      { recordedPlayerId: 'rp-b', name: 'Bob', color: '#00aa00', bankedMs: 0 },
    ],
  })
  const after = Date.now()
  assert.equal(store.players[0].bankedMs, 7_000)
  assert.deepEqual(store.players[0].bankedMsByRound, { '1': 7_000 })
  assert.equal(store.players[1].bankedMs, 0)
  assert.ok(typeof store.totalGameStartedAt === 'number')
  assert.ok(store.totalGameStartedAt <= before - 15_000 + 5)
  assert.ok(store.totalGameStartedAt >= after - 15_000 - 5)
})

test('addPlayer can carry recordedPlayerId when provided', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  const id = store.addPlayer({ name: 'Sam', color: '#123456', recordedPlayerId: 'rp-sam' })
  const player = store.players.find((p) => p.id === id)
  assert.equal(player.recordedPlayerId, 'rp-sam')
})
