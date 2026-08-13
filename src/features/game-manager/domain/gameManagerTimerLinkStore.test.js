import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameManagerTimerLinkStore } from '../../../stores/gameManagerTimerLink.js'

test('timer link store begin and clear', () => {
  setActivePinia(createPinia())
  const store = useGameManagerTimerLinkStore()
  store.beginLink({
    playSessionId: 'ps-1',
    launchConfig: { seats: [{ recordedPlayerId: 'a', name: 'Ada', color: '#111' }] },
  })
  assert.equal(store.active, true)
  assert.equal(store.isManagerLinked, true)
  assert.equal(store.playSessionId, 'ps-1')
  store.clearLink()
  assert.equal(store.active, false)
  assert.equal(store.isManagerLinked, false)
  assert.equal(store.playSessionId, null)
})

test('timer link store lastSyncPosture defaults local and accepts host', () => {
  setActivePinia(createPinia())
  const store = useGameManagerTimerLinkStore()
  assert.equal(store.lastSyncPosture, 'local')
  store.setLastSyncPosture('host')
  assert.equal(store.lastSyncPosture, 'host')
  store.setLastSyncPosture('nope')
  assert.equal(store.lastSyncPosture, 'local')
})
