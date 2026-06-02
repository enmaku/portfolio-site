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

test('getDungeonRunnerFirestore does not throw when Firebase env is missing', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { getDungeonRunnerFirestore } = await import(`./firestore.js?nothrow=${Date.now()}`)
    assert.doesNotThrow(() => {
      assert.equal(getDungeonRunnerFirestore(), null)
    })
  })
})

test('dungeonRunnerMatchOutcomePath maps matchId under dungeonRunnerMatchOutcomes', async () => {
  const { dungeonRunnerMatchOutcomePath } = await import('./firestore.js')
  assert.equal(
    dungeonRunnerMatchOutcomePath('match-abc123'),
    'dungeonRunnerMatchOutcomes/match-abc123',
  )
})

test('dungeonRunnerMatchOutcomeRef returns null when Firebase is not configured', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { dungeonRunnerMatchOutcomeRef } = await import(`./firestore.js?ref-null=${Date.now()}`)
    assert.equal(dungeonRunnerMatchOutcomeRef('match-abc123'), null)
  })
})

test('dungeonRunnerMatchOutcomeRef points at dungeonRunnerMatchOutcomes/{matchId}', async () => {
  await withFirebaseEnv({}, async () => {
    const { dungeonRunnerMatchOutcomeRef } = await import(`./firestore.js?ref=${Date.now()}`)
    const docRef = dungeonRunnerMatchOutcomeRef('match-abc123')
    assert.ok(docRef)
    assert.equal(docRef.id, 'match-abc123')
    assert.equal(docRef.path, 'dungeonRunnerMatchOutcomes/match-abc123')
  })
})

test('dungeon runner Firestore module exposes the frozen public surface', async () => {
  const mod = await import('./firestore.js')
  assert.equal(mod.MATCH_OUTCOMES_COLLECTION, 'dungeonRunnerMatchOutcomes')
  assert.equal(typeof mod.isDungeonRunnerFirebaseConfigured, 'function')
  assert.equal(typeof mod.getDungeonRunnerFirestore, 'function')
  assert.equal(typeof mod.dungeonRunnerMatchOutcomePath, 'function')
  assert.equal(typeof mod.dungeonRunnerMatchOutcomeRef, 'function')
  assert.equal(typeof mod.createFirestoreDoc, 'function')
})
