import assert from 'node:assert/strict'
import test from 'node:test'
import {
  __resetStableClientIdForTests,
  deriveStableHostSuffix,
  getStableClientId,
} from './identity.js'

const STORAGE_KEY = 'portfolio-p2p-client-id'
const ROOM_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const WELL_FORMED_RE = /^[0-9A-Z]{8,64}$/
const GENERATED_ID_LENGTH = 16

/** @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void }} StorageLike */

/**
 * @param {Record<string, string>} [initial]
 * @returns {StorageLike & { store: Record<string, string> }}
 */
function createMemoryStorage(initial = {}) {
  const store = { ...initial }
  return {
    store,
    getItem(key) {
      return key in store ? store[key] : null
    },
    setItem(key, value) {
      store[key] = value
    },
    removeItem(key) {
      delete store[key]
    },
  }
}

/**
 * @param {number} byte
 */
function createDeterministicCrypto(byte) {
  return {
    getRandomValues(array) {
      for (let i = 0; i < array.length; i++) array[i] = byte
      return array
    },
  }
}

/**
 * @param {number} byte
 */
function setDeterministicCrypto(byte) {
  Object.defineProperty(globalThis, 'crypto', {
    value: createDeterministicCrypto(byte),
    configurable: true,
    writable: true,
  })
}

/**
 * @param {{ localStorage?: StorageLike, cryptoByte?: number }} [options]
 */
function installBrowserMocks(options = {}) {
  const originalWindow = globalThis.window
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const storage = options.localStorage ?? createMemoryStorage()
  globalThis.window = /** @type {Window} */ ({ localStorage: storage })
  setDeterministicCrypto(options.cryptoByte ?? 0)
  return {
    storage,
    restore() {
      globalThis.window = originalWindow
      if (originalCryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor)
      } else {
        delete globalThis.crypto
      }
    },
  }
}

/**
 * @param {{ localStorage?: StorageLike, cryptoByte?: number }} [options]
 * @param {(ctx: { storage: StorageLike & { store: Record<string, string> } }) => void} run
 */
function withIdentityEnv(options, run) {
  __resetStableClientIdForTests()
  const mocks = installBrowserMocks(options)
  try {
    run(mocks)
  } finally {
    __resetStableClientIdForTests()
    mocks.restore()
  }
}

function assertUsesRoomAlphabet(value) {
  for (const ch of value) {
    assert.ok(ROOM_ALPHABET.includes(ch), `unexpected character ${ch}`)
  }
  assert.equal(value.includes('I'), false)
  assert.equal(value.includes('O'), false)
  assert.equal(value.includes('L'), false)
}

test('getStableClientId returns the same opaque id on repeated calls in one session', () => {
  withIdentityEnv({ cryptoByte: 3 }, () => {
    const first = getStableClientId()
    const second = getStableClientId()
    assert.equal(second, first)
    assert.match(first, WELL_FORMED_RE)
    assertUsesRoomAlphabet(first)
  })
})

test('getStableClientId persists freshly generated principal to localStorage', () => {
  withIdentityEnv({ cryptoByte: 3 }, ({ storage }) => {
    const id = getStableClientId()
    assert.equal(storage.store[STORAGE_KEY], id)
    assert.match(id, WELL_FORMED_RE)
    assert.equal(id.length, GENERATED_ID_LENGTH)
    assertUsesRoomAlphabet(id)
  })
})

test('getStableClientId reuses a well-formed value already in localStorage', () => {
  const persisted = 'ABCDEFGH12345678'
  withIdentityEnv({ localStorage: createMemoryStorage({ [STORAGE_KEY]: persisted }) }, ({ storage }) => {
    assert.equal(getStableClientId(), persisted)
    assert.equal(getStableClientId(), persisted)
    assert.equal(storage.store[STORAGE_KEY], persisted)
  })
})

test('getStableClientId accepts minimum-length well-formed persisted principals', () => {
  const persisted = '12345678'
  withIdentityEnv({ localStorage: createMemoryStorage({ [STORAGE_KEY]: persisted }) }, () => {
    assert.equal(getStableClientId(), persisted)
  })
})

test('getStableClientId replaces malformed persisted values with a fresh principal', () => {
  const malformedValues = ['lowercase', 'SHORT', 'has-dash', 'has space', '', 'A'.repeat(65)]

  for (const malformed of malformedValues) {
    withIdentityEnv(
      { localStorage: createMemoryStorage({ [STORAGE_KEY]: malformed }), cryptoByte: 5 },
      ({ storage }) => {
        const fresh = getStableClientId()
        assert.notEqual(fresh, malformed)
        assert.match(fresh, WELL_FORMED_RE)
        assert.equal(storage.store[STORAGE_KEY], fresh)
      },
    )
  }
})

test('getStableClientId keeps an in-memory principal when storage is unavailable', () => {
  const blockedStorage = {
    getItem() {
      throw new Error('storage blocked')
    },
    setItem() {
      throw new Error('storage blocked')
    },
    removeItem() {
      throw new Error('storage blocked')
    },
  }

  withIdentityEnv({ localStorage: blockedStorage, cryptoByte: 7 }, () => {
    const first = getStableClientId()
    const second = getStableClientId()
    assert.equal(second, first)
    assert.match(first, WELL_FORMED_RE)
  })
})

test('getStableClientId does not persist across reset when storage is unavailable', () => {
  const blockedStorage = {
    getItem() {
      throw new Error('storage blocked')
    },
    setItem() {
      throw new Error('storage blocked')
    },
    removeItem() {
      throw new Error('storage blocked')
    },
  }

  withIdentityEnv({ localStorage: blockedStorage, cryptoByte: 9 }, () => {
    const beforeReset = getStableClientId()
    __resetStableClientIdForTests()
    setDeterministicCrypto(10)
    const afterReset = getStableClientId()
    assert.notEqual(afterReset, beforeReset)
  })
})

test('deriveStableHostSuffix is deterministic for the same principal and app tag', () => {
  const persisted = 'STABLECLIENTID01'
  withIdentityEnv({ localStorage: createMemoryStorage({ [STORAGE_KEY]: persisted }) }, () => {
    const first = deriveStableHostSuffix('movievote', 6)
    const second = deriveStableHostSuffix('movievote', 6)
    assert.equal(second, first)
    assert.equal(first, '05VBBW')
  })
})

test('deriveStableHostSuffix defaults length to 6 when omitted', () => {
  const persisted = 'STABLECLIENTID01'
  withIdentityEnv({ localStorage: createMemoryStorage({ [STORAGE_KEY]: persisted }) }, () => {
    assert.equal(deriveStableHostSuffix('movievote').length, 6)
    assert.equal(deriveStableHostSuffix('movievote'), deriveStableHostSuffix('movievote', 6))
  })
})

test('deriveStableHostSuffix varies by app tag for the same principal', () => {
  const persisted = 'STABLECLIENTID01'
  withIdentityEnv({ localStorage: createMemoryStorage({ [STORAGE_KEY]: persisted }) }, () => {
    const movieVote = deriveStableHostSuffix('movievote', 6)
    const gameTimer = deriveStableHostSuffix('gametimer', 6)
    assert.notEqual(movieVote, gameTimer)
  })
})

test('deriveStableHostSuffix uses the unambiguous room alphabet', () => {
  const persisted = 'STABLECLIENTID01'
  withIdentityEnv({ localStorage: createMemoryStorage({ [STORAGE_KEY]: persisted }) }, () => {
    const suffix = deriveStableHostSuffix('movievote', 12)
    assertUsesRoomAlphabet(suffix)
  })
})

test('deriveStableHostSuffix respects the length parameter', () => {
  const persisted = 'STABLECLIENTID01'
  withIdentityEnv({ localStorage: createMemoryStorage({ [STORAGE_KEY]: persisted }) }, () => {
    assert.equal(deriveStableHostSuffix('movievote', 4).length, 4)
    assert.equal(deriveStableHostSuffix('movievote', 6).length, 6)
    assert.equal(deriveStableHostSuffix('movievote', 10).length, 10)
  })
})

test('__resetStableClientIdForTests clears cached identity and storage between cases', () => {
  withIdentityEnv({ cryptoByte: 2 }, ({ storage }) => {
    const first = getStableClientId()
    assert.equal(storage.store[STORAGE_KEY], first)

    __resetStableClientIdForTests()
    assert.equal(storage.store[STORAGE_KEY], undefined)

    setDeterministicCrypto(4)
    const second = getStableClientId()
    assert.notEqual(second, first)
    assert.equal(storage.store[STORAGE_KEY], second)
  })
})

test('withIdentityEnv isolates module state between contract cases', () => {
  let firstCaseId = ''
  withIdentityEnv({ cryptoByte: 1 }, () => {
    firstCaseId = getStableClientId()
  })
  withIdentityEnv({ cryptoByte: 2 }, () => {
    const secondCaseId = getStableClientId()
    assert.notEqual(secondCaseId, firstCaseId)
  })
})
