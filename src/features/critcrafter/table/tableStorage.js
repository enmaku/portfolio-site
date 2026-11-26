/**
 * Per-character table-state persistence: `localStorage` keyed by Pathbuilder id, with an
 * in-memory fallback when storage is unavailable (private mode, blocked, quota). The memory copy is
 * kept for the page session either way, so a failed write never loses the current session.
 */
import { safeLocalStorage } from '../safeLocalStorage.js'

export const TABLE_KEY_PREFIX = 'critcrafter:table:'

/**
 * @param {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null} [storage]
 */
export function createTableStorage(storage = safeLocalStorage()) {
  /** @type {Map<string, object>} */
  const memory = new Map()
  const key = (id) => `${TABLE_KEY_PREFIX}${id}`

  return {
    /** @returns {object | null} Stored deltas, or null when there is none. */
    load(id) {
      if (memory.has(id)) return memory.get(id) ?? null
      try {
        const raw = storage?.getItem(key(id))
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },
    /** An empty object removes the entry: a pristine character stores nothing. */
    save(id, deltas) {
      memory.set(id, deltas)
      try {
        if (Object.keys(deltas).length === 0) storage?.removeItem(key(id))
        else storage?.setItem(key(id), JSON.stringify(deltas))
      } catch {
        // storage unavailable: the memory copy carries this session
      }
    },
    clear(id) {
      memory.delete(id)
      try {
        storage?.removeItem(key(id))
      } catch {
        // nothing to clear
      }
    },
  }
}

let shared = null
/** The app-wide instance over `localStorage`. */
export function defaultTableStorage() {
  shared ??= createTableStorage()
  return shared
}
