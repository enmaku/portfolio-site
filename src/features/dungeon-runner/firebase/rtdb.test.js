import assert from 'node:assert/strict'
import { test } from 'node:test'

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

test('dungeon runner RTDB module exposes the frozen public surface', async () => {
  const mod = await import('./rtdb.js')
  assert.equal(typeof mod.isDungeonRunnerFirebaseConfigured, 'function')
  assert.equal(typeof mod.getDungeonRunnerDatabase, 'function')
  assert.equal(typeof mod.dungeonRunnerCompletedMatchPath, 'function')
  assert.equal(typeof mod.dungeonRunnerCompletedMatchRef, 'function')
  assert.equal(typeof mod.sanitizeForRtdb, 'function')
  assert.equal(typeof mod.setRtdb, 'function')
})

test('sanitizeForRtdb is wired from shared RTDB core', async () => {
  const { createRtdbCore } = await import('../../p2p/firebase/createRtdbCore.js')
  const core = createRtdbCore({ configuredBehavior: 'null' })
  const { sanitizeForRtdb } = await import('./rtdb.js')
  assert.equal(sanitizeForRtdb(undefined), null)
  assert.equal(sanitizeForRtdb, core.sanitizeForRtdb)
})
