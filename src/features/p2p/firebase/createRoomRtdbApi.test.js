import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

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

test('sanitizeForRtdb drops undefined keys and maps top-level undefined to null', async () => {
  const { createRoomRtdbApi } = await import('./createRoomRtdbApi.js')
  const { sanitizeForRtdb } = createRoomRtdbApi({
    roomsRoot: 'gameTimerRooms',
    label: TEST_LABEL,
  })
  assert.equal(sanitizeForRtdb(undefined), null)
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

test('sanitizeForRtdb preserves null and matches game-timer semantics', async () => {
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
  assert.equal(sanitizeForRtdb(undefined), null)
  assert.deepEqual(sanitizeForRtdb({ kept: null, dropped: undefined }), { kept: null })
  assert.deepEqual(sanitizeForRtdb(fixture), gameTimerSanitize(fixture))
})

test('getDatabase throws when Firebase env is missing', async () => {
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
          assert.match(err.message, /VITE_FIREBASE_\*/)
          assert.match(err.message, /\.env\.example/)
          return true
        },
      )
    },
  )
})

test('getDatabase error lists missing VITE_FIREBASE_* keys', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRoomRtdbApi } = await import(
        `./createRoomRtdbApi.js?partial=${Date.now()}`,
      )
      const { getDatabase } = createRoomRtdbApi({
        roomsRoot: 'gameTimerRooms',
        label: TEST_LABEL,
      })
      assert.throws(
        () => getDatabase(),
        (err) => {
          assert.ok(err instanceof Error)
          assert.match(err.message, /Missing:/)
          assert.match(err.message, /VITE_FIREBASE_AUTH_DOMAIN/)
          assert.match(err.message, /VITE_FIREBASE_DATABASE_URL/)
          assert.match(err.message, /VITE_FIREBASE_PROJECT_ID/)
          assert.match(err.message, /VITE_FIREBASE_APP_ID/)
          assert.doesNotMatch(err.message, /VITE_FIREBASE_API_KEY/)
          return true
        },
      )
    },
  )
})

test('two factory instances share the same getDatabase singleton', async () => {
  await withFirebaseEnv({}, async () => {
    const { createRoomRtdbApi } = await import(
      `./createRoomRtdbApi.js?singleton=${Date.now()}`
    )
    const timerApi = createRoomRtdbApi({
      roomsRoot: 'gameTimerRooms',
      label: TEST_LABEL,
    })
    const voteApi = createRoomRtdbApi({
      roomsRoot: 'movieVoteRooms',
      label: 'Movie Vote Firebase RTDB',
    })
    assert.equal(timerApi.getDatabase(), voteApi.getDatabase())
    assert.equal(timerApi.getDatabase(), timerApi.getDatabase())
  })
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

test('setRtdb returns a promise without throwing synchronously when configured', async () => {
  await withFirebaseEnv({}, async () => {
    const { createRoomRtdbApi } = await import(
      `./createRoomRtdbApi.js?setp=${Date.now()}`,
    )
    const { setRtdb, roomRef } = createRoomRtdbApi({
      roomsRoot: 'gameTimerRooms',
      label: TEST_LABEL,
    })
    const ref = roomRef('promise-room')
    let result
    assert.doesNotThrow(() => {
      result = setRtdb(ref, {
        round: 1,
        totalGameStartedAt: undefined,
      })
    })
    assert.ok(result instanceof Promise)
  })
})

test(
  'setRtdb calls Firebase set with sanitized payload',
  { skip: !mock.module },
  async () => {
    const actual = await import('firebase/database')
    /** @type {Array<{ value: unknown }>} */
    const setCalls = []
    mock.module('firebase/database', {
      namedExports: {
        ...actual,
        set: async (_ref, value) => {
          setCalls.push({ value })
        },
      },
    })

    await withFirebaseEnv({}, async () => {
      const { createRoomRtdbApi } = await import(
        `./createRoomRtdbApi.js?set=${Date.now()}`,
      )
      const { setRtdb, roomRef } = createRoomRtdbApi({
        roomsRoot: 'gameTimerRooms',
        label: TEST_LABEL,
      })
      const ref = roomRef('set-test')
      await setRtdb(ref, {
        players: [{ id: 'a', bankedMsByRound: undefined }],
        activePlayerId: null,
        totalGameStartedAt: undefined,
        round: 1,
      })
      assert.equal(setCalls.length, 1)
      assert.deepEqual(setCalls[0].value, {
        players: [{ id: 'a' }],
        activePlayerId: null,
        round: 1,
      })
    })
  },
)
