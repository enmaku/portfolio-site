/**
 * Persisted inspect/status/kit snapshot from one trade clear.
 * Domain: world-builder/CONTEXT.md — settlement trade tooltip, realm economy status.
 */

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('./tradeClearing/clearingState.js').CommodityTradeRole} CommodityTradeRole
 * @typedef {import('./tradeClearing/clearingState.js').OffMapTrade} OffMapTrade
 * @typedef {import('./tradeClearing/runTradeClearing.js').TradeClearingResult} TradeClearingResult
 */

/**
 * Stable colonization↔UI inspect contract. Clearing internals (flows, obligation
 * deltas, netted obligations) stay ephemeral on `TradeClearingResult`.
 *
 * @typedef {Object} EconomyEpochSnapshot
 * @property {Record<string, Record<CommodityId, CommodityTradeRole>>} settlementCommodityRoles
 * @property {Record<string, Record<CommodityId, number>>} localPricesBySettlementId
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDelivered
 * @property {Record<string, number>} realmBalancesCp
 * @property {OffMapTrade[]} offMapTrades
 * @property {Record<string, number>} portTollIncomeCpBySettlementId
 * @property {Record<string, number>} factionTaxNetCpBySettlementId Signed last-epoch faction tax net.
 */

/**
 * @param {TradeClearingResult} result
 * @returns {EconomyEpochSnapshot}
 */
export function projectEconomyEpochSnapshot(result) {
  return {
    settlementCommodityRoles: { ...result.settlementCommodityRoles },
    localPricesBySettlementId: { ...result.localPricesBySettlementId },
    effectiveDelivered: { ...result.effectiveDelivered },
    realmBalancesCp: { ...result.realmBalancesCp },
    offMapTrades: [...(result.offMapTrades ?? [])],
    portTollIncomeCpBySettlementId: { ...(result.portTollIncomeCpBySettlementId ?? {}) },
    factionTaxNetCpBySettlementId: {},
  }
}

/**
 * @param {unknown} value
 * @returns {EconomyEpochSnapshot | null}
 */
export function resolveEconomyEpochSnapshot(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const incoming = /** @type {Partial<EconomyEpochSnapshot>} */ (value)
  return {
    settlementCommodityRoles:
      incoming.settlementCommodityRoles && typeof incoming.settlementCommodityRoles === 'object'
        ? { ...incoming.settlementCommodityRoles }
        : {},
    localPricesBySettlementId:
      incoming.localPricesBySettlementId && typeof incoming.localPricesBySettlementId === 'object'
        ? { ...incoming.localPricesBySettlementId }
        : {},
    effectiveDelivered:
      incoming.effectiveDelivered && typeof incoming.effectiveDelivered === 'object'
        ? { ...incoming.effectiveDelivered }
        : {},
    realmBalancesCp:
      incoming.realmBalancesCp && typeof incoming.realmBalancesCp === 'object'
        ? { ...incoming.realmBalancesCp }
        : {},
    offMapTrades: Array.isArray(incoming.offMapTrades) ? [...incoming.offMapTrades] : [],
    portTollIncomeCpBySettlementId:
      incoming.portTollIncomeCpBySettlementId &&
      typeof incoming.portTollIncomeCpBySettlementId === 'object'
        ? { ...incoming.portTollIncomeCpBySettlementId }
        : {},
    factionTaxNetCpBySettlementId:
      incoming.factionTaxNetCpBySettlementId &&
      typeof incoming.factionTaxNetCpBySettlementId === 'object'
        ? { ...incoming.factionTaxNetCpBySettlementId }
        : {},
  }
}
