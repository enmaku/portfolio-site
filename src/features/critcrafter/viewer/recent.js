/** Recent row on the landing state: last 3 successfully loaded ids, labelled with the character name. */
import { safeLocalStorage } from '../safeLocalStorage.js'

export const RECENT_KEY = 'critcrafter:recent'
export const RECENT_MAX = 3

/**
 * @param {Pick<Storage, 'getItem'> | null} [storage]
 * @returns {{ id: string, name: string }[]}
 */
export function loadRecent(storage = safeLocalStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r) => r && typeof r.id === 'string' && typeof r.name === 'string')
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

/**
 * @param {string} id
 * @param {string} name
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null} [storage]
 */
export function rememberRecent(id, name, storage = safeLocalStorage()) {
  const next = [{ id, name }, ...loadRecent(storage).filter((r) => r.id !== id)].slice(0, RECENT_MAX)
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: Recent is a convenience only
  }
}
