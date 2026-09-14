/**
 * Two-letter catalog search seeder helpers (aa–zz against bggSearch).
 */

export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
export const SHORT_SEARCH_GAP_MS = 5_000
export const SHORT_SEARCH_HTTP_TIMEOUT_MS = 60_000

/**
 * @returns {string[]}
 */
export function twoLetterQueries() {
  const out = []
  for (const a of LETTERS) {
    for (const b of LETTERS) {
      out.push(`${a}${b}`)
    }
  }
  return out
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolveBggSearchFunctionsBase(env = process.env) {
  const explicit = String(env.VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  const projectId = String(env.VITE_FIREBASE_PROJECT_ID || '').trim()
  if (projectId) return `https://us-central1-${projectId}.cloudfunctions.net`
  return ''
}

/**
 * @param {string} functionsBase
 * @param {string} query
 * @returns {string}
 */
export function bggSearchUrl(functionsBase, query) {
  const base = String(functionsBase || '').trim().replace(/\/$/, '')
  const url = new URL(`${base}/bggSearch`)
  url.searchParams.set('query', query)
  return url.toString()
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatSeedDurationMs(ms) {
  const sec = Math.max(0, Math.round(Number(ms) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

/**
 * @param {{ done: number, total: number, elapsedMs: number, query?: string, hitCount?: number }} info
 * @returns {string}
 */
export function formatSeedProgress({ done, total, elapsedMs, query, hitCount }) {
  const n = Math.min(done, total)
  const pct = total <= 0 ? 100 : (n / total) * 100
  const remaining = Math.max(0, total - n)
  const etaMs = n > 0 ? (elapsedMs / n) * remaining : 0
  const etaLabel = n > 0 ? formatSeedDurationMs(etaMs) : '—'
  const q = query ? `  ${query}` : ''
  const hits = Number.isFinite(hitCount) ? `  hits ${hitCount}` : ''
  return `${pct.toFixed(1)}%  ${n}/${total}${q}${hits}  elapsed ${formatSeedDurationMs(elapsedMs)}  eta ${etaLabel}`
}
