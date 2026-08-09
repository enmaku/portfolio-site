/**
 * Shared clearing-state mutators (leaf — no orchestrator imports).
 * Domain: world-builder/CONTEXT.md — mutual credit, port toll, off-map trade.
 */

import { roundMoneyCp } from '../formatMoneyCp.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @typedef {Object} ObligationDelta
 * @property {string} fromSettlementId
 * @property {string} toSettlementId
 * @property {number} amountCp
 * @property {'goods' | 'toll'} kind
 */

/**
 * @typedef {{
 *   obligationDeltas: ObligationDelta[],
 *   netOwed: Map<string, number>,
 *   roles: Record<string, Record<CommodityId, string>>,
 *   externalAccounts: Map<string, number>,
 *   offMapPortTollIncomeCp: Map<string, number>,
 *   offMapTrades: Array<{
 *     settlementId: string,
 *     originSettlementId: string,
 *     commodityId: CommodityId,
 *     direction: 'import' | 'export',
 *     amount: number,
 *     unitPriceCp: number,
 *   }>,
 * }} ClearingMutatorState
 */

/**
 * @param {ClearingMutatorState} state
 * @param {ObligationDelta} delta
 */
export function addObligation(state, delta) {
  if (delta.fromSettlementId === delta.toSettlementId) return
  const amountCp = roundMoneyCp(delta.amountCp)
  if (!(amountCp > 0)) return
  const rounded = { ...delta, amountCp }
  state.obligationDeltas.push(rounded)
  state.netOwed.set(
    delta.fromSettlementId,
    roundMoneyCp((state.netOwed.get(delta.fromSettlementId) ?? 0) + amountCp),
  )
  state.netOwed.set(
    delta.toSettlementId,
    roundMoneyCp((state.netOwed.get(delta.toSettlementId) ?? 0) - amountCp),
  )
}

/**
 * @param {ClearingMutatorState} state
 * @param {string} id
 * @param {CommodityId} commodityId
 * @param {'import' | 'export'} direction
 */
export function markRole(state, id, commodityId, direction) {
  const current = state.roles[id]?.[commodityId]
  if (!current) return
  if (current === 'neither') state.roles[id][commodityId] = direction
  else if (current !== direction) state.roles[id][commodityId] = 'both'
}

/**
 * @param {ClearingMutatorState} state
 * @param {string} id
 * @param {number} deltaCp
 */
export function creditExternal(state, id, deltaCp) {
  const next = Math.max(0, roundMoneyCp((state.externalAccounts.get(id) ?? 0) + deltaCp))
  state.externalAccounts.set(id, next)
}

/**
 * Credit an external account with a port toll and record it for inspect totals.
 *
 * @param {ClearingMutatorState} state
 * @param {string} id
 * @param {number} tollCp
 */
export function creditExternalPortToll(state, id, tollCp) {
  const roundedToll = roundMoneyCp(tollCp)
  if (!(roundedToll > 0)) return
  creditExternal(state, id, roundedToll)
  state.offMapPortTollIncomeCp.set(
    id,
    roundMoneyCp((state.offMapPortTollIncomeCp.get(id) ?? 0) + roundedToll),
  )
}

/**
 * @param {ClearingMutatorState} state
 * @param {{
 *   settlementId: string,
 *   originSettlementId: string,
 *   commodityId: CommodityId,
 *   direction: 'import' | 'export',
 *   amount: number,
 *   unitPriceCp: number,
 * }} row
 */
export function recordOffMap(state, row) {
  state.offMapTrades.push(row)
  markRole(state, row.originSettlementId, row.commodityId, row.direction)
}
