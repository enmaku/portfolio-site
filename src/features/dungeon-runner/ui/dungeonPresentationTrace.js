/**
 * Enable with Vite dev server, `?debug=true` on localhost (see debugMode in page), or:
 *   localStorage.setItem('dungeonPresentationTrace', '1')
 */
export function isDungeonPresentationTraceEnabled() {
  try {
    if (import.meta.env?.DEV === true) return true
  } catch {
    /* not a Vite bundle */
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage?.getItem('dungeonPresentationTrace') === '1') {
    return true
  }
  return false
}
