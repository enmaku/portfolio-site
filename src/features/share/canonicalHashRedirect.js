import { SHARE_CATALOG } from '../../share-metadata.js'

const CANONICAL_TO_HASH_PATH = Object.fromEntries(
  SHARE_CATALOG.filter((entry) => entry.pasteUnfurl && entry.routePath !== '/').map(
    (entry) => [entry.routePath, entry.routePath],
  ),
)

/**
 * @param {string} pathname
 * @param {string} [search]
 * @returns {string | null}
 */
export function toHashRouteTarget(pathname, search = '') {
  const routePath = CANONICAL_TO_HASH_PATH[pathname]
  if (!routePath) return null
  return search ? `/#${routePath}${search}` : `/#${routePath}`
}

/**
 * Redirect canonical non-hash app URLs into hash routes for SPA runtime.
 */
export function redirectCanonicalPathToHashRoute() {
  if (typeof window === 'undefined') return
  if (window.location.hash) return
  const target = toHashRouteTarget(window.location.pathname, window.location.search)
  if (!target) return
  window.location.replace(target)
}
