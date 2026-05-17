import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'

const REQUIRED_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://test-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
}

/** @param {() => void | Promise<void>} fn */
async function withFirebaseEnv(fn) {
  const saved = {}
  for (const key of Object.keys(REQUIRED_FIREBASE_ENV)) {
    saved[key] = process.env[key]
    process.env[key] = REQUIRED_FIREBASE_ENV[key]
  }
  try {
    await fn()
  } finally {
    for (const key of Object.keys(REQUIRED_FIREBASE_ENV)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

/**
 * @param {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null }} ref
 * @returns {string}
 */
function refPath(ref) {
  const parts = []
  let cur = ref
  while (cur) {
    if (cur.key) parts.unshift(cur.key)
    cur = cur.parent ?? null
  }
  return parts.join('/')
}

/**
 * @returns {Promise<{
 *   listeners: Map<string, (snap: { val: () => unknown }) => void>,
 * }>}
 */
async function installRtdbLifecycleMocks() {
  /** @type {Map<string, (snap: { val: () => unknown }) => void>} */
  const listeners = new Map()
  const actual = await import('firebase/database')

  mock.module('firebase/database', {
    namedExports: {
      ...actual,
      get: async (ref) => {
        if (ref.key === 'hostPing') return { val: () => Date.now() }
        if (ref.key === 'ended') return { val: () => null }
        return { val: () => null }
      },
      set: async () => {},
      remove: async () => {},
      onDisconnect: () => ({
        remove: () => Promise.resolve(),
        set: () => Promise.resolve(),
      }),
      onChildAdded: () => () => {},
      onValue: (ref, cb) => {
        listeners.set(refPath(ref), cb)
        return () => {}
      },
    },
  })

  return { listeners }
}

/** @param {string} nonce */
async function importSession(nonce) {
  return import(`./session.js?rtdb-lifecycle=${nonce}`)
}

test('guest RTDB ended marker clears room persistence but keeps roster', async () => {
  mock.reset()
  const { listeners } = await installRtdbLifecycleMocks()

  await withFirebaseEnv(async () => {
    const { joinRoom, sessionPhase, sessionSuffix } = await importSession(
      String(Date.now()),
    )
    setActivePinia(createPinia())
    const store = useGameTimerStore()
    const room = useGameTimerRoomSessionStore()
    store.addPlayer({ name: 'Guest', color: '#444444' })
    const playerIds = store.players.map((p) => p.id)

    await joinRoom('ABC123')
    assert.equal(sessionPhase.value, 'guest_connected')
    assert.equal(room.role, 'guest')

    const endedPath = [...listeners.keys()].find((p) => p.endsWith('ended'))
    assert.ok(endedPath, 'guest wire should subscribe to ended')
    const onEnded = listeners.get(endedPath)
    assert.ok(onEnded)
    onEnded({ val: () => 1_700_000_000_000 })

    assert.equal(sessionPhase.value, 'idle')
    assert.equal(sessionSuffix.value, null)
    assert.equal(room.role, null)
    assert.equal(room.suffix, null)
    assert.equal(store.players.length, 1)
    assert.deepEqual(store.players.map((p) => p.id), playerIds)
  })
})

test('guest RTDB hostPing removal clears room persistence but keeps roster', async () => {
  mock.reset()
  const { listeners } = await installRtdbLifecycleMocks()

  await withFirebaseEnv(async () => {
    const { joinRoom, sessionPhase, sessionSuffix } = await importSession(
      String(Date.now()),
    )
    setActivePinia(createPinia())
    const store = useGameTimerStore()
    const room = useGameTimerRoomSessionStore()
    store.addPlayer({ name: 'Guest', color: '#555555' })

    await joinRoom('ABC123')
    assert.equal(sessionPhase.value, 'guest_connected')

    const hostPingPath = [...listeners.keys()].find((p) => p.endsWith('hostPing'))
    assert.ok(hostPingPath, 'guest wire should subscribe to hostPing')
    const onHostPing = listeners.get(hostPingPath)
    assert.ok(onHostPing)
    onHostPing({ val: () => Date.now() })
    onHostPing({ val: () => null })

    assert.equal(sessionPhase.value, 'idle')
    assert.equal(sessionSuffix.value, null)
    assert.equal(room.role, null)
    assert.equal(room.suffix, null)
    assert.equal(store.players.length, 1)
    assert.equal(store.players[0].name, 'Guest')
  })
})

afterEach(async () => {
  mock.reset()
})
