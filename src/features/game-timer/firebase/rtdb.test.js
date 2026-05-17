import assert from 'node:assert/strict'
import test from 'node:test'

const REQUIRED_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://test-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
}

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

test('getGameTimerDatabase throws when Firebase env is missing', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { getGameTimerDatabase } = await import(`./rtdb.js?missing=${Date.now()}`)
      assert.throws(
        () => getGameTimerDatabase(),
        (err) => {
          assert.ok(err instanceof Error)
          assert.match(err.message, /Game Timer Firebase RTDB/)
          assert.match(err.message, /VITE_FIREBASE_\*/)
          assert.match(err.message, /\.env\.example/)
          return true
        },
      )
    },
  )
})

test('gameTimerRoomPath maps suffix under gameTimerRooms', async () => {
  const { gameTimerRoomPath } = await import('./rtdb.js')
  assert.equal(gameTimerRoomPath('abc123'), 'gameTimerRooms/abc123')
})

test('getGameTimerDatabase returns the same instance (lazy singleton)', async () => {
  await withFirebaseEnv({}, async () => {
    const { getGameTimerDatabase } = await import(`./rtdb.js?singleton=${Date.now()}`)
    const first = getGameTimerDatabase()
    const second = getGameTimerDatabase()
    assert.equal(first, second)
  })
})

test('gameTimerRoomRef points at gameTimerRooms/{suffix}', async () => {
  await withFirebaseEnv({}, async () => {
    const { gameTimerRoomRef } = await import(`./rtdb.js?ref=${Date.now()}`)
    const roomRef = gameTimerRoomRef('abc123')
    assert.equal(roomRef.key, 'abc123')
    assert.equal(roomRef.parent?.key, 'gameTimerRooms')
  })
})

test('sanitizeForRtdb drops undefined keys (RTDB rejects undefined)', async () => {
  const { sanitizeForRtdb } = await import('./rtdb.js')
  const out = sanitizeForRtdb({
    players: [{ id: 'a', name: 'Alice', bankedMsByRound: undefined }],
    activePlayerId: null,
    totalGameStartedAt: undefined,
    round: 1,
  })
  assert.deepEqual(out, {
    players: [{ id: 'a', name: 'Alice' }],
    activePlayerId: null,
    round: 1,
  })
})
