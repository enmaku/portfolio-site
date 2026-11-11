/**
 * Vue Router HTML5 history stores `{ current, back, forward, position }` on
 * `history.state`. Extra pushState sentinels must merge into that object.
 *
 * If `current` is missing, vue-router's changeLocation concatenates
 * `location.protocol + '//' + location.host + base + to`. With `to` undefined
 * that becomes `https://example.comundefined`; pushState throws (cross-origin)
 * and the catch path does location.assign of that host.
 */

/**
 * @param {object | null | undefined} existing
 * @param {object | null | undefined} extra
 * @returns {object}
 */
export function mergeHistoryState(existing, extra) {
  const prev = existing && typeof existing === 'object' ? existing : {}
  const patch = extra && typeof extra === 'object' ? extra : {}
  return { ...prev, ...patch }
}

/**
 * @param {object | null | undefined} existing
 * @param {{ pathname?: string, search?: string, hash?: string }} locationLike
 * @returns {object | null} replacement state, or null when no repair is needed
 */
export function repairedVueRouterHistoryState(existing, locationLike) {
  const prev = existing && typeof existing === 'object' ? existing : {}
  if (typeof prev.current === 'string') return null
  const pathname = typeof locationLike?.pathname === 'string' ? locationLike.pathname : '/'
  const search = typeof locationLike?.search === 'string' ? locationLike.search : ''
  const hash = typeof locationLike?.hash === 'string' ? locationLike.hash : ''
  return mergeHistoryState(prev, {
    back: prev.back ?? null,
    current: `${pathname}${search}${hash}`,
    forward: prev.forward ?? null,
    replaced: true,
    position: typeof prev.position === 'number' ? prev.position : 0,
    scroll: prev.scroll ?? null,
  })
}

/**
 * @param {object} extra
 */
export function pushMergedHistoryState(extra) {
  if (typeof history === 'undefined') return
  history.pushState(mergeHistoryState(history.state, extra), '')
}

export function repairVueRouterHistoryState() {
  if (typeof window === 'undefined' || typeof history === 'undefined') return false
  const next = repairedVueRouterHistoryState(history.state, window.location)
  if (!next) return false
  history.replaceState(next, '')
  return true
}
