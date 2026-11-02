/**
 * Offline Firebase RTDB mocks for plain unit tests.
 * Requires `node --experimental-test-module-mocks`.
 *
 * Real `ref()` resolves the Database and initializes the RTDB repo, which opens a
 * socket. With no network the connection never settles and the test process hangs
 * forever after its assertions pass.
 */

import { mock } from 'node:test'

const FIREBASE_DATABASE = 'firebase/database'

/**
 * @param {string} dotPath
 * @returns {{ key?: string | null, parent?: unknown }}
 */
function buildRef(dotPath) {
  const parts = String(dotPath).split('/').filter(Boolean)
  /** @type {{ key?: string | null, parent?: unknown } | null} */
  let node = null
  for (const part of parts) {
    node = { key: part, parent: node }
  }
  return node ?? { key: null, parent: null }
}

/**
 * @param {{ key?: string | null, parent?: unknown }} ref
 * @returns {string}
 */
export function refPath(ref) {
  const parts = []
  let cur = ref
  while (cur) {
    if (cur.key) parts.unshift(cur.key)
    cur = cur.parent ?? null
  }
  return parts.join('/')
}

/**
 * @param {{ refs?: Array<{ path: string, value: unknown }>, removes?: Array<{ path: string }> }} [log]
 * @returns {Promise<{ refs: Array<{ path: string, value: unknown }>, removes: Array<{ path: string }> }>}
 */
export async function installOfflineFirebaseMocks(log = { refs: [], removes: [] }) {
  const sets = log.refs ?? []
  const removes = log.removes ?? []
  const actual = await import(FIREBASE_DATABASE)

  mock.module(FIREBASE_DATABASE, {
    namedExports: {
      ...actual,
      ref: (dbOrPath, maybePath) => buildRef(maybePath ?? dbOrPath),
      child: (parent, path) => buildRef(`${refPath(parent)}/${path}`),
      get: async () => ({ val: () => null, exists: () => false }),
      set: async (ref, value) => {
        sets.push({ path: refPath(ref), value })
      },
      remove: async (ref) => {
        removes.push({ path: refPath(ref) })
      },
      onValue: () => () => {},
      onChildAdded: () => () => {},
      onDisconnect: () => ({
        remove: () => Promise.resolve(),
        set: () => Promise.resolve(),
        cancel: () => Promise.resolve(),
      }),
    },
  })

  return { refs: sets, removes }
}

/**
 * @param {typeof import('node:test').mock} mockRef
 * @returns {() => void}
 */
export function createOfflineFirebaseAfterEach(mockRef) {
  return () => {
    mockRef.timers?.reset?.()
    mockRef.reset()
  }
}
