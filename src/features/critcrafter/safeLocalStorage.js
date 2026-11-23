/**
 * `localStorage` when the browser lets us touch it, else null (private mode, blocked site data, no DOM).
 * Even reading the `localStorage` property can throw, so callers get one guarded accessor.
 * @returns {Storage | null}
 */
export function safeLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}
