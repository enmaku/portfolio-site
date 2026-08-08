/**
 * Political-pressure slice field resolvers.
 * Domain: world-builder/CONTEXT.md — Political pressure.
 */

/**
 * @returns {{
 *   politicalPressureStreak: Record<string, number>,
 *   politicalPressureClearStreak: Record<string, number>,
 *   politicalPressureArmedBySettlementId: Record<string, string>,
 *   recentAllianceBySettlementId: Record<string, { allianceEpoch: number, factionId?: string | null, kind?: string | null }>,
 * }}
 */
export function createEmptyPoliticalPressureSliceFields() {
  return {
    politicalPressureStreak: {},
    politicalPressureClearStreak: {},
    politicalPressureArmedBySettlementId: {},
    recentAllianceBySettlementId: {},
  }
}

/**
 * @param {unknown} value
 * @returns {Record<string, { allianceEpoch: number, factionId?: string | null, kind?: string | null }>}
 */
export function resolveRecentAllianceMap(value) {
  if (!value || typeof value !== 'object') return {}
  /** @type {Record<string, { allianceEpoch: number, factionId?: string | null, kind?: string | null }>} */
  const resolved = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object') continue
    const row = /** @type {{ allianceEpoch?: unknown, factionId?: unknown, kind?: unknown }} */ (
      entry
    )
    if (typeof row.allianceEpoch !== 'number' || !Number.isFinite(row.allianceEpoch)) continue
    resolved[id] = {
      allianceEpoch: Math.floor(row.allianceEpoch),
      factionId: typeof row.factionId === 'string' ? row.factionId : null,
      kind: typeof row.kind === 'string' ? row.kind : null,
    }
  }
  return resolved
}

/**
 * @param {object} incoming
 * @param {(value: unknown) => Record<string, number>} resolveStreakMap
 * @param {(value: unknown) => Record<string, string>} resolveStringMap
 */
export function resolvePoliticalPressureSliceFields(incoming, resolveStreakMap, resolveStringMap) {
  return {
    politicalPressureStreak: resolveStreakMap(incoming.politicalPressureStreak),
    politicalPressureClearStreak: resolveStreakMap(incoming.politicalPressureClearStreak),
    politicalPressureArmedBySettlementId: resolveStringMap(
      incoming.politicalPressureArmedBySettlementId,
    ),
    recentAllianceBySettlementId: resolveRecentAllianceMap(incoming.recentAllianceBySettlementId),
  }
}
