/**
 * Opt-in only (avoids flooding the console during normal dev):
 *   localStorage.setItem('dungeonPresentationTrace', '1')
 *
 * When enabled, logs extra `[dungeon-runner][card-flight]` and
 * `[DungeonRunner][card-flight][refs]` lines for pile/deck → card motion, plus
 * `[dungeon-runner][presentation-motion]` teardown / watch lines (GSAP clear vs queue head).
 */
export function isDungeonPresentationTraceEnabled() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage?.getItem('dungeonPresentationTrace') === '1') {
    return true
  }
  return false
}
