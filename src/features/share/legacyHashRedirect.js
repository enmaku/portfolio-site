/**
 * Migrate legacy hash-routed URLs (`#/projects/game-timer`) into history-mode
 * paths. Old join links and bookmarks carry the route in the fragment; the
 * router cannot see it once history mode is active, so rewrite the address bar
 * before the router mounts.
 */

/**
 * Split a legacy hash URL into a router path plus query string.
 * @param {string} hash Location hash including the leading `#`.
 * @returns {string | null} Path with query, or null when the hash is not an app route.
 */
export function hashToRouteTarget(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#/')) return null
  const raw = hash.slice(1)
  const [pathname, query] = raw.split('?')
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return query ? `${normalized}?${query}` : normalized
}

/**
 * Replace a legacy hash URL with its history-mode equivalent.
 * @returns {boolean} Whether the location was rewritten.
 */
export function migrateHashUrl() {
  if (typeof window === 'undefined') return false
  const target = hashToRouteTarget(window.location.hash)
  if (!target) return false
  window.location.replace(target)
  return true
}
