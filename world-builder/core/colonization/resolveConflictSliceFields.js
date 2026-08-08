/**
 * Persist/rehydrate helpers for conflict-engine and rivalry slice fields.
 */

/**
 * @param {unknown} value
 * @returns {Array<{
 *   aFactionId: string,
 *   bFactionId: string,
 *   cause: 'legacy' | 'resource' | 'logistics' | 'territory' | 'belief',
 *   createdEpoch: number,
 * }>}
 */
export function resolveRivalryEdges(value) {
  if (!Array.isArray(value)) return []
  const causes = new Set(['legacy', 'resource', 'logistics', 'territory', 'belief'])
  return value
    .filter(
      (row) =>
        row &&
        typeof row.aFactionId === 'string' &&
        typeof row.bFactionId === 'string' &&
        causes.has(row.cause) &&
        typeof row.createdEpoch === 'number' &&
        Number.isFinite(row.createdEpoch),
    )
    .map((row) => ({
      aFactionId: row.aFactionId,
      bFactionId: row.bFactionId,
      cause: row.cause,
      createdEpoch: row.createdEpoch,
    }))
}

/**
 * @param {unknown} value
 * @returns {Record<string, { penalty: number, expiresEpoch: number }>}
 */
export function resolveWarExhaustionMap(value) {
  if (!value || typeof value !== 'object') return {}
  /** @type {Record<string, { penalty: number, expiresEpoch: number }>} */
  const resolved = {}
  for (const [settlementId, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object') continue
    const penalty = Number(/** @type {{ penalty?: unknown }} */ (entry).penalty)
    const expiresEpoch = Number(/** @type {{ expiresEpoch?: unknown }} */ (entry).expiresEpoch)
    if (!Number.isFinite(penalty) || !Number.isFinite(expiresEpoch)) continue
    resolved[settlementId] = { penalty, expiresEpoch }
  }
  return resolved
}

/**
 * @param {unknown} value
 * @returns {import('../politics/conflict/belligerentTradeBlocks.js').BelligerentTradeBlock[]}
 */
export function resolveBelligerentTradeBlocks(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (row) =>
        row &&
        typeof row.aFactionId === 'string' &&
        typeof row.bFactionId === 'string' &&
        Number.isFinite(row.openedEpoch) &&
        Number.isFinite(row.peaceEligibleEpoch),
    )
    .map((row) => ({
      aFactionId: row.aFactionId,
      bFactionId: row.bFactionId,
      openedEpoch: row.openedEpoch,
      peaceEligibleEpoch: row.peaceEligibleEpoch,
    }))
}

/**
 * @param {unknown} value
 * @returns {Record<string, { conqueredEpoch: number, priorFactionId?: string | null, cause?: string }>}
 */
export function resolveRecentConquestMap(value) {
  if (!value || typeof value !== 'object') return {}
  /** @type {Record<string, { conqueredEpoch: number, priorFactionId?: string | null, cause?: string }>} */
  const resolved = {}
  for (const [settlementId, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object') continue
    const conqueredEpoch = Number(
      /** @type {{ conqueredEpoch?: unknown }} */ (entry).conqueredEpoch,
    )
    if (!Number.isFinite(conqueredEpoch)) continue
    const priorFactionId = /** @type {{ priorFactionId?: unknown }} */ (entry).priorFactionId
    const cause = /** @type {{ cause?: unknown }} */ (entry).cause
    resolved[settlementId] = {
      conqueredEpoch,
      ...(typeof priorFactionId === 'string' || priorFactionId == null
        ? { priorFactionId: /** @type {string | null | undefined} */ (priorFactionId) }
        : {}),
      ...(typeof cause === 'string' && cause.length > 0 ? { cause } : {}),
    }
  }
  return resolved
}
