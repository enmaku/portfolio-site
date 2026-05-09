/**
 * Opt-in only (avoids flooding the console during normal dev):
 *   localStorage.setItem('dungeonPresentationTrace', '1')
 */
export function isDungeonPresentationTraceEnabled() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage?.getItem('dungeonPresentationTrace') === '1') {
    return true
  }
  return false
}
