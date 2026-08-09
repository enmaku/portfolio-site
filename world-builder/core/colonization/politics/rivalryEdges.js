/**
 * Sticky rivalry edges between living factions.
 * Domain: world-builder/CONTEXT.md — Rivalry, Strategic overstretch.
 */

/**
 * @param {import('../createDefaultColonizationSlice.js').RivalryEdge[]} edges
 * @param {{
 *   aFactionId: string,
 *   bFactionId: string,
 *   cause?: import('../createDefaultColonizationSlice.js').RivalryEdge['cause'],
 *   createdEpoch: number,
 * }} params
 * @returns {import('../createDefaultColonizationSlice.js').RivalryEdge[]}
 */
export function openLegacyRivalry(edges, params) {
  const a = params.aFactionId
  const b = params.bFactionId
  if (!a || !b || a === b) return edges ?? []
  const next = [...(edges ?? [])]
  if (next.some((e) => (e.aFactionId === a && e.bFactionId === b) || (e.aFactionId === b && e.bFactionId === a))) {
    return next
  }
  next.push({
    aFactionId: a,
    bFactionId: b,
    cause: params.cause ?? 'legacy',
    createdEpoch: params.createdEpoch,
  })
  return next
}

/**
 * Drop edges involving an extinct faction; retarget edges that pointed at the loser onto the survivor.
 *
 * @param {import('../createDefaultColonizationSlice.js').RivalryEdge[]} edges
 * @param {{ loserFactionId: string, survivorFactionId: string, createdEpoch: number }} params
 * @returns {import('../createDefaultColonizationSlice.js').RivalryEdge[]}
 */
export function transferRivalryOnAbsorb(edges, params) {
  const { loserFactionId, survivorFactionId, createdEpoch } = params
  /** @type {import('../createDefaultColonizationSlice.js').RivalryEdge[]} */
  const out = []
  for (const edge of edges ?? []) {
    const touchesLoser =
      edge.aFactionId === loserFactionId || edge.bFactionId === loserFactionId
    if (!touchesLoser) {
      out.push(edge)
      continue
    }
    const other =
      edge.aFactionId === loserFactionId ? edge.bFactionId : edge.aFactionId
    if (other === survivorFactionId) continue
    const already = out.some(
      (e) =>
        (e.aFactionId === survivorFactionId && e.bFactionId === other) ||
        (e.aFactionId === other && e.bFactionId === survivorFactionId),
    )
    if (already) continue
    out.push({
      aFactionId: survivorFactionId,
      bFactionId: other,
      cause: edge.cause,
      createdEpoch,
    })
  }
  return out
}
