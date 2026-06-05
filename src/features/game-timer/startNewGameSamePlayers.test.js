import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerStore } from '../../stores/gameTimer.js'

function withFakeNow(startMs, run) {
  const originalNow = Date.now
  let now = startMs
  Date.now = () => now
  const advance = (ms) => {
    now += ms
  }
  try {
    run(advance)
  } finally {
    Date.now = originalNow
  }
}

test('startNewGameSamePlayers keeps roster and clears clocks and rounds', () => {
  withFakeNow(1000, (advance) => {
    setActivePinia(createPinia())
    const store = useGameTimerStore()
    const a = store.addPlayer({ name: 'Ada', color: '#ff0000' })
    const b = store.addPlayer({ name: 'Bob', color: '#00ff00' })
    store.setHardPassEnabled(true)
    store.setHardPassOrderNextRound(true)
    store.setFullscreenEnabled(true)
    store.setTimingStripMode('non-player')
    store.selectPlayer(a)
    advance(2000)
    store.selectPlayer(a)
    store.goToNextRound()
    store.selectPlayer(b)
    advance(1000)
    store.registerHardPass(b)

    const rosterSnapshot = store.players.map((p) => ({ id: p.id, name: p.name, color: p.color }))
    const orderAtReset = store.players.map((p) => p.id)
    assert.equal(store.round, 2)
    assert.ok(store.players[0].bankedMs > 0 || store.players[1].bankedMs > 0)
    assert.ok(Object.keys(store.hardPassOrderByRound).length > 0)

    store.startNewGameSamePlayers()

    assert.deepEqual(
      store.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
      rosterSnapshot,
    )
    assert.equal(store.round, 1)
    assert.equal(store.activePlayerId, null)
    assert.equal(store.turnStartedAt, null)
    assert.equal(store.turnStartedRound, null)
    assert.equal(store.totalGameStartedAt, null)
    assert.equal(store.totalGameElapsedMs, 0)
    for (const p of store.players) {
      assert.equal(p.bankedMs, 0)
      assert.deepEqual(p.bankedMsByRound, {})
    }
    assert.deepEqual(store.hardPassOrderByRound, {})
    assert.equal(store.hardPassEnabled, true)
    assert.equal(store.hardPassOrderNextRound, true)
    assert.equal(store.fullscreenEnabled, true)
    assert.equal(store.timingStripMode, 'non-player')
    assert.deepEqual(store.playerOrderByRound['1'], orderAtReset)
  })
})

test('startNewGameSamePlayers uses current list order as round 1 order', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  const a = store.addPlayer({ name: 'A' })
  const b = store.addPlayer({ name: 'B' })
  store.reorderPlayers([store.players[1], store.players[0]])
  store.goToNextRound()
  assert.equal(store.round, 2)

  store.startNewGameSamePlayers()

  assert.equal(store.round, 1)
  assert.deepEqual(
    store.players.map((p) => p.id),
    [b, a],
  )
  assert.deepEqual(store.playerOrderByRound['1'], [b, a])
  assert.equal(Object.keys(store.playerOrderByRound).length, 1)
})

test('startNewGameSamePlayers is a no-op with no players', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  store.startNewGameSamePlayers()
  assert.equal(store.players.length, 0)
  assert.equal(store.round, 1)
})
