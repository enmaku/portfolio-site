import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { nonPlayerElapsedMs, totalGameElapsedMs } from './core.js'
import { withFakeNow } from './test/withFakeNow.js'
import { useGameTimerStore } from '../../stores/gameTimer.js'

function timingSnapshot(store) {
  return {
    totalGameStartedAt: store.totalGameStartedAt,
    players: store.players,
    activePlayerId: store.activePlayerId,
    turnStartedAt: store.turnStartedAt,
  }
}

test('game timer session timing starts on first selectPlayer only', () => {
  withFakeNow(1_000, (advance) => {
    setActivePinia(createPinia())
    const store = useGameTimerStore()
    const p1 = store.addPlayer({ name: 'A' })

    assert.equal(store.totalGameStartedAt, null)
    assert.equal(totalGameElapsedMs(timingSnapshot(store), Date.now()), 0)
    assert.equal(nonPlayerElapsedMs(timingSnapshot(store), Date.now()), 0)

    advance(3_000)
    store.selectPlayer(p1)
    assert.equal(store.totalGameStartedAt, 4_000)
    assert.equal(totalGameElapsedMs(timingSnapshot(store), Date.now()), 0)
  })
})

test('non-player time is total minus players and clamps at zero', () => {
  withFakeNow(10_000, (advance) => {
    setActivePinia(createPinia())
    const store = useGameTimerStore()
    const p1 = store.addPlayer({ name: 'A' })

    store.selectPlayer(p1)
    advance(5_000)
    store.selectPlayer(p1)

    const snapshot = timingSnapshot(store)
    assert.equal(totalGameElapsedMs(snapshot, Date.now()), 5_000)
    assert.equal(nonPlayerElapsedMs(snapshot, Date.now()), 0)

    store.players[0].bankedMs = 12_000
    assert.equal(nonPlayerElapsedMs(timingSnapshot(store), Date.now()), 0)
  })
})

test('clear all players resets session timing baseline', () => {
  withFakeNow(20_000, (advance) => {
    setActivePinia(createPinia())
    const store = useGameTimerStore()
    const p1 = store.addPlayer({ name: 'A' })
    store.selectPlayer(p1)
    advance(2_000)

    store.clearAllPlayers()
    assert.equal(store.totalGameStartedAt, null)
    assert.equal(totalGameElapsedMs(timingSnapshot(store), Date.now()), 0)
    assert.equal(nonPlayerElapsedMs(timingSnapshot(store), Date.now()), 0)
  })
})
