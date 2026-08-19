/**
 * Run: node --experimental-test-module-mocks --test src/features/game-manager/firebase/auth.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'

const REQUIRED_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://test-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
}

const MISSING_ENV = {
  VITE_FIREBASE_API_KEY: undefined,
  VITE_FIREBASE_AUTH_DOMAIN: undefined,
  VITE_FIREBASE_DATABASE_URL: undefined,
  VITE_FIREBASE_PROJECT_ID: undefined,
  VITE_FIREBASE_APP_ID: undefined,
}

const authMockTests = { skip: !mock.module }

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

test('isGameManagerFirebaseConfigured is false when Firebase env is missing', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { isGameManagerFirebaseConfigured } = await import(`./auth.js?missing=${Date.now()}`)
    assert.equal(isGameManagerFirebaseConfigured(), false)
  })
})

test('getGameManagerAuth returns null when Firebase env is missing', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { getGameManagerAuth } = await import(`./auth.js?auth-null=${Date.now()}`)
    assert.doesNotThrow(() => {
      assert.equal(getGameManagerAuth(), null)
    })
  })
})

test('isAccountOwnerUser rejects null, anonymous, and unsupported providers', async () => {
  const { isAccountOwnerUser } = await import('./auth.js')

  assert.equal(isAccountOwnerUser(null), false)
  assert.equal(isAccountOwnerUser(undefined), false)
  assert.equal(
    isAccountOwnerUser(
      /** @type {import('firebase/auth').User} */ ({
        isAnonymous: true,
        providerData: [{ providerId: 'anonymous' }],
      }),
    ),
    false,
  )
  assert.equal(
    isAccountOwnerUser(
      /** @type {import('firebase/auth').User} */ ({
        isAnonymous: false,
        providerData: [],
      }),
    ),
    false,
  )
  assert.equal(
    isAccountOwnerUser(
      /** @type {import('firebase/auth').User} */ ({
        isAnonymous: false,
        providerData: [{ providerId: 'facebook.com' }],
      }),
    ),
    false,
  )
})

test('isAccountOwnerUser accepts Google and email/password providers', async () => {
  const { isAccountOwnerUser } = await import('./auth.js')

  assert.equal(
    isAccountOwnerUser(
      /** @type {import('firebase/auth').User} */ ({
        isAnonymous: false,
        providerData: [{ providerId: 'google.com' }],
      }),
    ),
    true,
  )
  assert.equal(
    isAccountOwnerUser(
      /** @type {import('firebase/auth').User} */ ({
        isAnonymous: false,
        providerData: [{ providerId: 'password' }],
      }),
    ),
    true,
  )
})

test('sign-in helpers return null when Firebase is not configured', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const mod = await import(`./auth.js?helpers-null=${Date.now()}`)
    assert.equal(await mod.signInWithGooglePopup(), null)
    assert.equal(await mod.createAccountWithEmailPassword('a@b.c', 'secret'), null)
    assert.equal(await mod.signInWithEmailPassword('a@b.c', 'secret'), null)
  })
})

test('signOutGameManager is a no-op when Firebase is not configured', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { signOutGameManager } = await import(`./auth.js?signout=${Date.now()}`)
    await assert.doesNotReject(async () => {
      await signOutGameManager()
    })
  })
})

test('subscribeGameManagerAuthState invokes callback with null when unconfigured', async () => {
  await withFirebaseEnv(MISSING_ENV, async () => {
    const { subscribeGameManagerAuthState } = await import(`./auth.js?subscribe=${Date.now()}`)
    let seen = /** @type {import('firebase/auth').User | null | undefined} */ (undefined)
    const unsubscribe = subscribeGameManagerAuthState((user) => {
      seen = user
    })
    assert.equal(seen, null)
    assert.doesNotThrow(unsubscribe)
  })
})

test('game manager auth module exposes the frozen public surface', async () => {
  const mod = await import('./auth.js')
  assert.equal(typeof mod.isGameManagerFirebaseConfigured, 'function')
  assert.equal(typeof mod.getGameManagerAuth, 'function')
  assert.equal(typeof mod.isAccountOwnerUser, 'function')
  assert.equal(typeof mod.subscribeGameManagerAuthState, 'function')
  assert.equal(typeof mod.signInWithGooglePopup, 'function')
  assert.equal(typeof mod.createAccountWithEmailPassword, 'function')
  assert.equal(typeof mod.signInWithEmailPassword, 'function')
  assert.equal(typeof mod.signOutGameManager, 'function')
})

test('getGameManagerAuth returns auth when Firebase is configured', authMockTests, async () => {
  mock.reset()

  /** @type {import('firebase/auth').Auth} */
  const mockAuth = { currentUser: null }

  mock.module('firebase/auth', {
    namedExports: {
      getAuth: () => mockAuth,
      GoogleAuthProvider: class GoogleAuthProvider {},
      createUserWithEmailAndPassword: async () => ({ user: { uid: 'created' } }),
      signInWithEmailAndPassword: async () => ({ user: { uid: 'signed-in' } }),
      signInWithPopup: async () => ({ user: { uid: 'google' } }),
      signOut: async () => {},
      onAuthStateChanged: (_auth, cb) => {
        cb(null)
        return () => {}
      },
    },
  })

  await withFirebaseEnv({}, async () => {
    const { getPortfolioAuth } = await import(
      `../../account-owner/firebase/auth.js?configured=${Date.now()}`
    )
    assert.equal(getPortfolioAuth(), mockAuth)
    assert.equal(getPortfolioAuth(), mockAuth, 'returns cached auth instance')
  })
})

test('signInWithGooglePopup delegates to firebase/auth when configured', authMockTests, async () => {
  mock.reset()

  let popupCalled = false
  /** @type {import('firebase/auth').Auth} */
  const mockAuth = { currentUser: null }

  mock.module('firebase/auth', {
    namedExports: {
      getAuth: () => mockAuth,
      GoogleAuthProvider: class GoogleAuthProvider {},
      createUserWithEmailAndPassword: async () => ({ user: { uid: 'created' } }),
      signInWithEmailAndPassword: async () => ({ user: { uid: 'signed-in' } }),
      signInWithPopup: async () => {
        popupCalled = true
        return { user: { uid: 'google-user', providerData: [{ providerId: 'google.com' }] } }
      },
      signOut: async () => {},
      onAuthStateChanged: (_auth, cb) => {
        cb(null)
        return () => {}
      },
    },
  })

  await withFirebaseEnv({}, async () => {
    const { signInWithGooglePopup } = await import(
      `../../account-owner/firebase/auth.js?google=${Date.now()}`
    )
    const user = await signInWithGooglePopup()
    assert.equal(popupCalled, true)
    assert.equal(user?.uid, 'google-user')
  })
})

afterEach(() => {
  if (mock.module) mock.reset()
})
