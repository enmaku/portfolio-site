import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import { MSG_HOST_ENDED } from './protocol.js'
import {
  handleGuestInbound,
  leaveSession,
  sessionPhase,
  sessionSuffix,
  teardownSession,
} from './session.js'

test('leaveSession clears room persistence but keeps game timer roster', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  const room = useGameTimerRoomSessionStore()
  store.addPlayer({ name: 'Ada', color: '#111111' })
  store.addPlayer({ name: 'Bob', color: '#222222' })
  const ids = store.players.map((p) => p.id)
  room.setHost('abc123')

  leaveSession()

  assert.equal(sessionPhase.value, 'idle')
  assert.equal(sessionSuffix.value, null)
  assert.equal(room.role, null)
  assert.equal(room.suffix, null)
  assert.equal(store.players.length, 2)
  assert.deepEqual(
    store.players.map((p) => p.id),
    ids,
  )
})

test('guest host-ended protocol notice clears room persistence but keeps roster', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  const room = useGameTimerRoomSessionStore()
  store.addPlayer({ name: 'Guest', color: '#333333' })
  room.setGuest('xyz789')

  handleGuestInbound({ type: MSG_HOST_ENDED })

  assert.equal(sessionPhase.value, 'idle')
  assert.equal(sessionSuffix.value, null)
  assert.equal(room.role, null)
  assert.equal(room.suffix, null)
  assert.equal(store.players.length, 1)
  assert.equal(store.players[0].name, 'Guest')
})

afterEach(() => {
  teardownSession()
})
