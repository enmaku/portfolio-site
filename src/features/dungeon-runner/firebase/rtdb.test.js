import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'

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

const MISSING_ENV = {
  VITE_FIREBASE_API_KEY: undefined,
  VITE_FIREBASE_AUTH_DOMAIN: undefined,
  VITE_FIREBASE_DATABASE_URL: undefined,
  VITE_FIREBASE_PROJECT_ID: undefined,
  VITE_FIREBASE_APP_ID: undefined,
}

test('isDungeonRunnerFirebaseConfigured is false when Firebase env is missing', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { isDungeonRunnerFirebaseConfigured, getDungeonRunnerDatabase } =
      await import(`./rtdb.js?missing=${Date.now()}`)
    assert.equal(isDungeonRunnerFirebaseConfigured(), false)
    assert.equal(getDungeonRunnerDatabase(), null)
  })
})

test('isDungeonRunnerFirebaseConfigured is false when any required key is missing', async () => {
  await withFirebaseEnv({ VITE_FIREBASE_DATABASE_URL: undefined }, async () => {
    const { isDungeonRunnerFirebaseConfigured } = await import(`./rtdb.js?partial=${Date.now()}`)
    assert.equal(isDungeonRunnerFirebaseConfigured(), false)
  })
})

test('isDungeonRunnerFirebaseConfigured is false for whitespace-only env values', async () => {
  await withFirebaseEnv({ VITE_FIREBASE_API_KEY: '   ' }, async () => {
    const { isDungeonRunnerFirebaseConfigured } = await import(`./rtdb.js?blank=${Date.now()}`)
    assert.equal(isDungeonRunnerFirebaseConfigured(), false)
  })
})

test('isDungeonRunnerFirebaseConfigured is true when required Firebase env is set', async () => {
  await withFirebaseEnv({}, async () => {
    const { isDungeonRunnerFirebaseConfigured } = await import(`./rtdb.js?configured=${Date.now()}`)
    assert.equal(isDungeonRunnerFirebaseConfigured(), true)
  })
})

test('getDungeonRunnerDatabase does not throw when Firebase env is missing', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { getDungeonRunnerDatabase } = await import(`./rtdb.js?nothrow=${Date.now()}`)
    assert.doesNotThrow(() => {
      assert.equal(getDungeonRunnerDatabase(), null)
    })
  })
})

test('dungeonRunnerCompletedMatchPath maps matchId under dungeonRunnerCompletedMatches', async () => {
  const { dungeonRunnerCompletedMatchPath } = await import('./rtdb.js')
  assert.equal(
    dungeonRunnerCompletedMatchPath('match-abc123'),
    'dungeonRunnerCompletedMatches/match-abc123',
  )
  assert.equal(
    dungeonRunnerCompletedMatchPath('match-1715875200000'),
    'dungeonRunnerCompletedMatches/match-1715875200000',
  )
})

test('getDungeonRunnerDatabase returns the same instance (lazy singleton)', async () => {
  await withFirebaseEnv({}, async () => {
    const { getDungeonRunnerDatabase } = await import(`./rtdb.js?singleton=${Date.now()}`)
    const first = getDungeonRunnerDatabase()
    const second = getDungeonRunnerDatabase()
    assert.ok(first)
    assert.equal(first, second)
  })
})

test('dungeonRunnerCompletedMatchRef points at dungeonRunnerCompletedMatches/{matchId}', async () => {
  await withFirebaseEnv({}, async () => {
    const { dungeonRunnerCompletedMatchRef } = await import(`./rtdb.js?ref=${Date.now()}`)
    const matchRef = dungeonRunnerCompletedMatchRef('match-abc123')
    assert.ok(matchRef)
    assert.equal(matchRef.key, 'match-abc123')
    assert.equal(matchRef.parent?.key, 'dungeonRunnerCompletedMatches')
  })
})

test('dungeonRunnerCompletedMatchRef returns null when Firebase is not configured', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { dungeonRunnerCompletedMatchRef } = await import(`./rtdb.js?ref-null=${Date.now()}`)
    assert.equal(dungeonRunnerCompletedMatchRef('match-abc123'), null)
  })
})

test('sanitizeForRtdb drops undefined keys (RTDB rejects undefined)', async () => {
  const { sanitizeForRtdb } = await import('./rtdb.js')
  const out = sanitizeForRtdb({
    version: 1,
    seed: 4242,
    setup: { totalSeats: 2, opponents: [{ role: 'random' }] },
    history: [{ type: 'bid', value: undefined }],
    presentationSpeedProfile: undefined,
  })
  assert.deepEqual(out, {
    version: 1,
    seed: 4242,
    setup: { totalSeats: 2, opponents: [{ role: 'random' }] },
    history: [{ type: 'bid' }],
  })
})

test('sanitizeForRtdb preserves null and nested undefined removal', async () => {
  const { sanitizeForRtdb } = await import('./rtdb.js')
  assert.equal(sanitizeForRtdb(undefined), null)
  assert.deepEqual(sanitizeForRtdb({ kept: null, dropped: undefined }), { kept: null })
})

test('setRtdb returns a promise without throwing synchronously when configured', async () => {
  await withFirebaseEnv({}, async () => {
    const { setRtdb, dungeonRunnerCompletedMatchRef } = await import(`./rtdb.js?setp=${Date.now()}`)
    const matchRef = dungeonRunnerCompletedMatchRef('match-promise')
    assert.ok(matchRef)
    let result
    assert.doesNotThrow(() => {
      result = setRtdb(matchRef, {
        version: 1,
        seed: 1,
        presentationSpeedProfile: undefined,
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
      const { setRtdb, dungeonRunnerCompletedMatchRef } = await import(
        `./rtdb.js?set=${Date.now()}`,
      )
      const matchRef = dungeonRunnerCompletedMatchRef('match-set-test')
      assert.ok(matchRef)
      await setRtdb(matchRef, {
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        seed: 42,
        setup: { totalSeats: 2, opponents: [] },
        history: [],
        presentationSpeedProfile: undefined,
      })
      assert.equal(setCalls.length, 1)
      assert.deepEqual(setCalls[0].value, {
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        seed: 42,
        setup: { totalSeats: 2, opponents: [] },
        history: [],
      })
    })
  },
)

afterEach(() => {
  mock.reset()
})
