import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'

const REQUIRED_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://test-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
}

const TEST_LABEL = 'Test Firebase RTDB'

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

test('createRtdbCore returns the core RTDB contract', async () => {
  const { createRtdbCore } = await import('./createRtdbCore.js')
  const core = createRtdbCore({ configuredBehavior: 'throw', label: TEST_LABEL })
  assert.equal(typeof core.getDatabase, 'function')
  assert.equal(typeof core.isConfigured, 'function')
  assert.equal(typeof core.sanitizeForRtdb, 'function')
  assert.equal(typeof core.setRtdb, 'function')
})

test('isConfigured is false when all required Firebase env keys are missing', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?missing=${Date.now()}`
      )
      const { isConfigured } = createRtdbCore({ configuredBehavior: 'null' })
      assert.equal(isConfigured(), false)
    },
  )
})

test('isConfigured is false when required Firebase env is partial', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?partial=${Date.now()}`
      )
      const { isConfigured } = createRtdbCore({ configuredBehavior: 'null' })
      assert.equal(isConfigured(), false)
    },
  )
})

test('isConfigured is false when required Firebase env is whitespace only', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: '   ',
      VITE_FIREBASE_AUTH_DOMAIN: '\t',
      VITE_FIREBASE_DATABASE_URL: ' ',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_APP_ID: '  \n  ',
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?ws=${Date.now()}`
      )
      const { isConfigured } = createRtdbCore({ configuredBehavior: 'null' })
      assert.equal(isConfigured(), false)
    },
  )
})

test('isConfigured is true when all required Firebase env keys are set', async () => {
  await withFirebaseEnv({}, async () => {
    const { createRtdbCore } = await import(`./createRtdbCore.js?ok=${Date.now()}`)
    const { isConfigured } = createRtdbCore({ configuredBehavior: 'null' })
    assert.equal(isConfigured(), true)
  })
})

test('sanitizeForRtdb drops undefined keys and maps top-level undefined to null', async () => {
  const { createRtdbCore } = await import('./createRtdbCore.js')
  const { sanitizeForRtdb } = createRtdbCore({ configuredBehavior: 'null' })
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

test('sanitizeForRtdb preserves null and sanitizes nested arrays', async () => {
  const { createRtdbCore } = await import('./createRtdbCore.js')
  const { sanitizeForRtdb } = createRtdbCore({ configuredBehavior: 'null' })
  assert.deepEqual(sanitizeForRtdb({ kept: null, dropped: undefined }), { kept: null })
  assert.deepEqual(
    sanitizeForRtdb({
      items: [{ a: undefined, b: 1 }, undefined],
    }),
    { items: [{ b: 1 }, null] },
  )
})

test('getDatabase with throw behavior throws when Firebase env is missing', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?throw-missing=${Date.now()}`
      )
      const { getDatabase } = createRtdbCore({
        configuredBehavior: 'throw',
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

test('getDatabase with throw behavior throws when Firebase env is whitespace only', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: ' ',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_DATABASE_URL: '\t',
      VITE_FIREBASE_PROJECT_ID: '  ',
      VITE_FIREBASE_APP_ID: '\n',
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?throw-ws=${Date.now()}`
      )
      const { getDatabase } = createRtdbCore({
        configuredBehavior: 'throw',
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

test('getDatabase with throw behavior lists missing VITE_FIREBASE_* keys', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?throw-partial=${Date.now()}`
      )
      const { getDatabase } = createRtdbCore({
        configuredBehavior: 'throw',
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

test('getDatabase with null behavior returns null when Firebase env is missing', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?null-missing=${Date.now()}`
      )
      const { getDatabase } = createRtdbCore({ configuredBehavior: 'null' })
      assert.equal(getDatabase(), null)
    },
  )
})

test('getDatabase with null behavior returns null when Firebase env is whitespace only', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: ' ',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_DATABASE_URL: '\t',
      VITE_FIREBASE_PROJECT_ID: '  ',
      VITE_FIREBASE_APP_ID: '\n',
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?null-ws=${Date.now()}`
      )
      const { getDatabase } = createRtdbCore({ configuredBehavior: 'null' })
      assert.equal(getDatabase(), null)
    },
  )
})

test('getDatabase with throw behavior omits label prefix when label is omitted', async () => {
  await withFirebaseEnv(
    {
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_DATABASE_URL: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_APP_ID: undefined,
    },
    async () => {
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?throw-nolabel=${Date.now()}`
      )
      const { getDatabase } = createRtdbCore({ configuredBehavior: 'throw' })
      assert.throws(
        () => getDatabase(),
        (err) => {
          assert.ok(err instanceof Error)
          assert.doesNotMatch(err.message, /is not configured/)
          assert.match(err.message, /Set VITE_FIREBASE_\*/)
          return true
        },
      )
    },
  )
})

test('two core bindings share the same getDatabase singleton when configured', async () => {
  await withFirebaseEnv({}, async () => {
    const { createRtdbCore } = await import(
      `./createRtdbCore.js?singleton=${Date.now()}`
    )
    const throwCore = createRtdbCore({
      configuredBehavior: 'throw',
      label: 'Throw binding',
    })
    const nullCore = createRtdbCore({ configuredBehavior: 'null' })
    assert.equal(throwCore.getDatabase(), nullCore.getDatabase())
    assert.equal(throwCore.getDatabase(), throwCore.getDatabase())
  })
})

test('star-room RTDB shims share the core app-wide singleton', async () => {
  await withFirebaseEnv({}, async () => {
    const nonce = Date.now()
    const { getGameTimerDatabase } = await import(
      `../../game-timer/firebase/rtdb.js?gt=${nonce}`,
    )
    const { getMovieVoteDatabase } = await import(
      `../../movie-vote/firebase/rtdb.js?mv=${nonce}`,
    )
    assert.equal(getGameTimerDatabase(), getMovieVoteDatabase())
  })
})

test('setRtdb returns a promise without throwing synchronously when configured', async () => {
  await withFirebaseEnv({}, async () => {
    const actual = await import('firebase/database')
    const { createRtdbCore } = await import(
      `./createRtdbCore.js?setp=${Date.now()}`
    )
    const { setRtdb, getDatabase } = createRtdbCore({
      configuredBehavior: 'throw',
      label: TEST_LABEL,
    })
    const ref = actual.ref(getDatabase(), 'test/set-promise')
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

afterEach(() => {
  mock.reset()
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
      const { createRtdbCore } = await import(
        `./createRtdbCore.js?set=${Date.now()}`
      )
      const { setRtdb, getDatabase } = createRtdbCore({
        configuredBehavior: 'throw',
        label: TEST_LABEL,
      })
      const ref = actual.ref(getDatabase(), 'test/set-sanitize')
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
