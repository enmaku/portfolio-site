import assert from 'node:assert/strict'
import test from 'node:test'

const REQUIRED_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://test-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
}

const TEST_LABEL = 'Star Room Firebase RTDB'

/** @param {Record<string, string | undefined>} overrides */
async function withFirebaseEnv(overrides, fn) {
  const saved = {}
  for (const key of Object.keys(REQUIRED_FIREBASE_ENV)) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  for (const [key, value] of Object.entries({ ...REQUIRED_FIREBASE_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return await fn()
  } finally {
    for (const key of Object.keys(REQUIRED_FIREBASE_ENV)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

test('createRoomRtdbApi returns the room RTDB contract', async () => {
  const { createRoomRtdbApi } = await import('./createRoomRtdbApi.js')
  const api = createRoomRtdbApi({
    roomsRoot: 'gameTimerRooms',
    label: TEST_LABEL,
  })
  assert.equal(typeof api.getDatabase, 'function')
  assert.equal(typeof api.roomPath, 'function')
  assert.equal(typeof api.roomRef, 'function')
  assert.equal(typeof api.sanitizeForRtdb, 'function')
  assert.equal(typeof api.setRtdb, 'function')
})

test('getDatabase throws with product label when Firebase env is missing', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRoomRtdbApi } = await import(
        `./createRoomRtdbApi.js?missing=${Date.now()}`
      )
      const { getDatabase } = createRoomRtdbApi({
        roomsRoot: 'gameTimerRooms',
        label: TEST_LABEL,
      })
      assert.throws(
        () => getDatabase(),
        (err) => {
          assert.ok(err instanceof Error)
          assert.match(err.message, new RegExp(TEST_LABEL))
          return true
        },
      )
    },
  )
})

test('roomPath and roomRef use the supplied roomsRoot', async () => {
  await withFirebaseEnv({}, async () => {
    const { createRoomRtdbApi } = await import(
      `./createRoomRtdbApi.js?ref=${Date.now()}`
    )
    const { roomPath, roomRef } = createRoomRtdbApi({
      roomsRoot: 'movieVoteRooms',
      label: TEST_LABEL,
    })
    assert.equal(roomPath('abc123'), 'movieVoteRooms/abc123')
    const ref = roomRef('abc123')
    assert.equal(ref.key, 'abc123')
    assert.equal(ref.parent?.key, 'movieVoteRooms')
  })
})

test('sanitizeForRtdb matches game-timer shim semantics', async () => {
  const { sanitizeForRtdb: gameTimerSanitize } = await import(
    '../../game-timer/firebase/rtdb.js',
  )
  const { createRoomRtdbApi } = await import('./createRoomRtdbApi.js')
  const { sanitizeForRtdb } = createRoomRtdbApi({
    roomsRoot: 'gameTimerRooms',
    label: TEST_LABEL,
  })
  const fixture = {
    players: [{ id: 'a', name: 'Alice', bankedMsByRound: undefined }],
    activePlayerId: null,
    totalGameStartedAt: undefined,
    round: 1,
  }
  assert.deepEqual(sanitizeForRtdb(fixture), gameTimerSanitize(fixture))
})
