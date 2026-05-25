/**
 * Shared RTDB mocks for Movie Vote P2P lifecycle / bridge integration tests.
 * Requires `node --experimental-test-module-mocks`.
 */

import { mock } from 'node:test'

const REQUIRED_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://test-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
}

/** @param {() => void | Promise<void>} fn */
export async function withFirebaseEnv(fn) {
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
 * @param {string} dotPath
 * @returns {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null }}
 */
function buildRef(dotPath) {
  const parts = dotPath.split('/').filter(Boolean)
  /** @type {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null } | null} */
  let node = null
  for (const part of parts) {
    node = { key: part, parent: node }
  }
  return /** @type {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null }} */ (
    node ?? { key: null, parent: null }
  )
}

/**
 * @param {{
 *   getHostPing?: () => unknown,
 *   getEnded?: () => unknown,
 *   getHostClientId?: () => unknown,
 *   getState?: () => unknown,
 *   getWelcome?: () => unknown,
 *   getGuestOnline?: () => unknown,
 * }} [opts]
 * @returns {Promise<{
 *   listeners: Map<string, (snap: { val: () => unknown }) => void>,
 *   sets: Array<{ path: string, value: unknown }>,
 *   removes: Array<{ path: string }>,
 *   childAddedParentPaths: () => string[],
 *   emitChildAdded: (parentPath: string, childKey: string) => void,
 *   emitValue: (path: string, value: unknown) => void,
 * }>}
 */
export async function installRtdbLifecycleMocks(opts = {}) {
  /** @type {Map<string, (snap: { val: () => unknown }) => void>} */
  const listeners = new Map()
  /** @type {Map<string, Set<(snap: { key: string | null, ref: ReturnType<typeof buildRef> }) => void>>} */
  const childAddedHandlers = new Map()
  /** @type {Array<{ path: string, value: unknown }>} */
  const sets = []
  /** @type {Array<{ path: string }>} */
  const removes = []

  /**
   * @param {string} parentPath
   * @param {string} childKey
   */
  function emitChildAdded(parentPath, childKey) {
    const handlers = childAddedHandlers.get(parentPath)
    if (!handlers?.size) return
    const childPath = `${parentPath}/${childKey}`
    const snap = { key: childKey, ref: buildRef(childPath) }
    for (const handler of handlers) handler(snap)
  }

  /**
   * @param {string} path
   * @param {unknown} value
   */
  function emitValue(path, value) {
    const handler = listeners.get(path)
    if (handler) handler({ val: () => value })
  }

  const actual = await import('firebase/database')

  mock.module('firebase/database', {
    namedExports: {
      ...actual,
      get: async (ref) => {
        if (ref.key === 'hostPing') {
          return {
            val: () => (opts.getHostPing !== undefined ? opts.getHostPing() : Date.now()),
          }
        }
        if (ref.key === 'ended') {
          return { val: () => (opts.getEnded !== undefined ? opts.getEnded() : null) }
        }
        if (ref.key === 'hostClientId') {
          return {
            val: () => (opts.getHostClientId !== undefined ? opts.getHostClientId() : null),
          }
        }
        if (ref.key === 'state') {
          return { val: () => (opts.getState !== undefined ? opts.getState() : null) }
        }
        if (ref.key === 'welcome') {
          return { val: () => (opts.getWelcome !== undefined ? opts.getWelcome() : null) }
        }
        if (ref.key === 'guestOnline') {
          return {
            val: () => (opts.getGuestOnline !== undefined ? opts.getGuestOnline() : null),
          }
        }
        return { val: () => null }
      },
      set: async (ref, value) => {
        sets.push({ path: refPath(ref), value })
      },
      remove: async (ref) => {
        removes.push({ path: refPath(ref) })
      },
      onDisconnect: () => ({
        remove: () => Promise.resolve(),
        set: () => Promise.resolve(),
      }),
      onChildAdded: (ref, cb) => {
        const path = refPath(ref)
        if (!childAddedHandlers.has(path)) childAddedHandlers.set(path, new Set())
        childAddedHandlers.get(path)?.add(cb)
        return () => childAddedHandlers.get(path)?.delete(cb)
      },
      onValue: (ref, cb) => {
        const path = refPath(ref)
        listeners.set(path, cb)
        return () => listeners.delete(path)
      },
    },
  })

  return {
    listeners,
    sets,
    removes,
    childAddedParentPaths: () => [...childAddedHandlers.keys()],
    emitChildAdded,
    emitValue,
  }
}
