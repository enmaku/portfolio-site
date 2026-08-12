/**
 * Annotate survival results with cross-faction dependence for politics absorption pressure.
 */

import { computeLogisticsConnectivityComponents } from './computeLogisticsConnectivityComponents.js'

/**
 * @param {{
 *   settlements: object[],
 *   factions: object[],
 *   survivalBySettlementId: Record<string, object>,
 *   worldDocument: object,
 *   threeDayHaulDistance: number,
 *   roads?: object[] | null,
 *   inlandSailExpeditionRange?: number,
 *   graphCache?: import('../tradeGraph/candidateTradeGraphCache.js').CandidateTradeGraphCache,
 * }} params
 * @param {{
 *   onItem?: () => void,
 *   yieldToUi?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<Record<string, object>>}
 */
export async function annotateSurvivalFactionDependence(params, options = {}) {
  const { onItem, yieldToUi } = options
  const survival = { ...(params.survivalBySettlementId ?? {}) }
  const activeFactions = (params.factions ?? []).filter((f) => f.status === 'active')
  if (activeFactions.length === 0) {
    const skipCount = countAnnotateSurvivalProgressItems(params.settlements)
    for (let i = 0; i < skipCount; i += 1) {
      onItem?.()
      await yieldToUi?.()
    }
    return survival
  }

  // Connectivity graph build is the expensive prelude — tick first so UI can paint 1/n.
  onItem?.()
  await yieldToUi?.()
  const components = computeLogisticsConnectivityComponents({
    settlements: params.settlements,
    worldDocument: params.worldDocument,
    threeDayHaulDistance: params.threeDayHaulDistance,
    roads: params.roads,
    inlandSailExpeditionRange: params.inlandSailExpeditionRange,
    graphCache: params.graphCache,
  }).components

  /** @type {Map<string, string>} */
  const componentBySettlement = new Map()
  for (const component of components) {
    for (const id of component.settlementIds) {
      componentBySettlement.set(id, component.key)
    }
  }

  for (const settlement of params.settlements ?? []) {
    if (!settlement?.id || settlement.status === 'ruin' || !settlement.factionId) {
      onItem?.()
      await yieldToUi?.()
      continue
    }
    const existing = survival[settlement.id] ?? {}
    if (existing.dependsOnFactionId) {
      onItem?.()
      await yieldToUi?.()
      continue
    }
    const surplus = existing.foodSurplus
    if (!(typeof surplus === 'number' && surplus < 0) && existing.ok !== false) {
      onItem?.()
      await yieldToUi?.()
      continue
    }

    const ownComponent = componentBySettlement.get(settlement.id)
    if (!ownComponent) {
      onItem?.()
      await yieldToUi?.()
      continue
    }

    for (const other of params.settlements ?? []) {
      if (!other?.factionId || other.factionId === settlement.factionId) continue
      if (other.status === 'ruin') continue
      if (componentBySettlement.get(other.id) !== ownComponent) continue
      const otherSurvival = survival[other.id] ?? {}
      if (typeof otherSurvival.foodSurplus === 'number' && otherSurvival.foodSurplus > 0) {
        survival[settlement.id] = {
          ...existing,
          ok: false,
          dependsOnFactionId: other.factionId,
        }
        break
      }
    }
    onItem?.()
    await yieldToUi?.()
  }

  return survival
}

/**
 * Progress ticks emitted by {@link annotateSurvivalFactionDependence} (prelude + one per settlement).
 *
 * @param {Array<object> | null | undefined} settlements
 * @returns {number}
 */
export function countAnnotateSurvivalProgressItems(settlements) {
  return 1 + (Array.isArray(settlements) ? settlements.length : 0)
}
