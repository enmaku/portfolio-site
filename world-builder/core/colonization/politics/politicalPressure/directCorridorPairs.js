/**
 * Direct corridor pairs for political pressure (no open-sea).
 * Domain: world-builder/CONTEXT.md — Political pressure; Road; Inland sail.
 */

import { undirectedSettlementPairKey } from './primaryClaimAdjacency.js'

const BUILT_OK = new Set(['land', 'inland_sail'])
const GRAPH_OK = new Set(['road', 'overland', 'inlandWater'])

/**
 * @param {{
 *   roads?: Array<{ settlementIds?: string[] | null, mode?: string | null }> | null,
 *   tradeGraphEdges?: Array<{
 *     a?: { id?: string } | null,
 *     b?: { id?: string } | null,
 *     mode?: string | null,
 *   }> | null,
 * }} params
 * @returns {Set<string>} undirected `a|b` keys
 */
export function buildDirectPressureCorridorPairSet(params) {
  /** @type {Set<string>} */
  const pairs = new Set()
  for (const road of params.roads ?? []) {
    if (!road || !BUILT_OK.has(road.mode ?? '')) continue
    const ids = road.settlementIds
    if (!Array.isArray(ids) || ids.length < 2) continue
    const a = ids[0]
    const b = ids[1]
    if (typeof a !== 'string' || typeof b !== 'string' || a === b) continue
    pairs.add(undirectedSettlementPairKey(a, b))
  }
  for (const edge of params.tradeGraphEdges ?? []) {
    if (!edge || !GRAPH_OK.has(edge.mode ?? '')) continue
    const a = edge.a?.id
    const b = edge.b?.id
    if (typeof a !== 'string' || typeof b !== 'string' || a === b) continue
    pairs.add(undirectedSettlementPairKey(a, b))
  }
  return pairs
}
