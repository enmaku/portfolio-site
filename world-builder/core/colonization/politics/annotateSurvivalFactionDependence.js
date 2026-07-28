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
 * }} params
 * @returns {Record<string, object>}
 */
export function annotateSurvivalFactionDependence(params) {
  const survival = { ...(params.survivalBySettlementId ?? {}) }
  const activeFactions = (params.factions ?? []).filter((f) => f.status === 'active')
  if (activeFactions.length === 0) return survival

  const components = computeLogisticsConnectivityComponents({
    settlements: params.settlements,
    worldDocument: params.worldDocument,
    threeDayHaulDistance: params.threeDayHaulDistance,
    roads: params.roads,
    inlandSailExpeditionRange: params.inlandSailExpeditionRange,
  }).components

  /** @type {Map<string, string>} */
  const componentBySettlement = new Map()
  for (const component of components) {
    for (const id of component.settlementIds) {
      componentBySettlement.set(id, component.key)
    }
  }

  for (const settlement of params.settlements ?? []) {
    if (!settlement?.id || settlement.status === 'ruin' || !settlement.factionId) continue
    const existing = survival[settlement.id] ?? {}
    if (existing.dependsOnFactionId) continue
    const surplus = existing.foodSurplus
    if (!(typeof surplus === 'number' && surplus < 0) && existing.ok !== false) continue

    const ownComponent = componentBySettlement.get(settlement.id)
    if (!ownComponent) continue

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
  }

  return survival
}
