/**
 * Supply-chain independence latch predicates (land + maritime branches).
 * Domain: world-builder/CONTEXT.md — Supply-chain independence.
 */

import { computeHaulShedIsochrone } from '../computeHaulShedIsochrone.js'
import { buildCandidateTradeGraph } from '../tradeGraph/buildCandidateRoutes.js'
import { computeClaimProduction } from '../../economy/founding/computeClaimProduction.js'
import { survivalFoodDemandLb } from '../../economy/survivalDemand.js'
import { geometricHaulShedCirclesOverlap } from './computeLogisticsConnectivityComponents.js'

/**
 * @typedef {Object} SupplyChainIndependenceResult
 * @property {boolean} latched
 * @property {boolean} landBranch
 * @property {boolean} maritimeBranch
 * @property {string[]} maritimePeelSettlementIds Founding drain cities that meet maritime branch.
 */

/**
 * @param {{
 *   settlements: object[],
 *   worldDocument: object,
 *   threeDayHaulDistance: number,
 *   roads?: object[] | null,
 *   inlandSailExpeditionRange?: number,
 *   colonistSettings?: { yieldModifier?: string, populationDensity?: number },
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 * }} params
 * @returns {SupplyChainIndependenceResult}
 */
export function evaluateSupplyChainIndependence(params) {
  const settlements = resolveLiving(params?.settlements)
  const empty = {
    latched: false,
    landBranch: false,
    maritimeBranch: false,
    maritimePeelSettlementIds: /** @type {string[]} */ ([]),
  }
  if (settlements.length === 0) return empty

  const radius = Number(params?.threeDayHaulDistance)
  const doc = params?.worldDocument
  const roadOrSailPairs = collectRoadOrSailPairs({
    settlements,
    worldDocument: doc,
    threeDayHaulDistance: radius,
    roads: params?.roads,
    inlandSailExpeditionRange: params?.inlandSailExpeditionRange,
  })

  let landBranch = false
  if (settlements.length >= 2 && radius > 0) {
    for (let i = 0; i < settlements.length; i += 1) {
      for (let j = i + 1; j < settlements.length; j += 1) {
        const a = settlements[i]
        const b = settlements[j]
        if (geometricHaulShedCirclesOverlap(a, b, radius)) continue
        const pairKey = pairId(a.id, b.id)
        if (roadOrSailPairs.has(pairKey)) continue
        landBranch = true
        break
      }
      if (landBranch) break
    }
  }

  const maritimePeelSettlementIds = []
  const yieldModifier = params?.colonistSettings?.yieldModifier ?? 'typical'
  const populationDensity = params?.colonistSettings?.populationDensity ?? 1
  for (const settlement of settlements) {
    if (settlement.logisticsNodePrimaryType !== 'drain_city') continue
    if (!isTownTierOrHigher(settlement)) continue
    const foodNeed = survivalFoodDemandLb(settlement.population)
    if (!(foodNeed > 0) || !doc) continue
    const shedCells = resolveHaulShedCells({
      settlement,
      radius,
      worldDocument: doc,
      primaryClaim: params?.primaryClaim,
    })
    const production = computeClaimProduction({
      settlementId: settlement.id,
      claimedCells: shedCells,
      worldDocument: doc,
      yieldModifier,
      populationDensity,
    })
    const localArableFood = production.grain ?? 0
    if (localArableFood < foodNeed * 0.5) {
      maritimePeelSettlementIds.push(settlement.id)
    }
  }

  const maritimeBranch = maritimePeelSettlementIds.length > 0
  return {
    latched: landBranch || maritimeBranch,
    landBranch,
    maritimeBranch,
    maritimePeelSettlementIds,
  }
}

/**
 * @param {object[] | undefined} raw
 */
function resolveLiving(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s) =>
      s &&
      typeof s.id === 'string' &&
      Number.isFinite(s.x) &&
      Number.isFinite(s.y) &&
      (s.status === undefined || s.status === 'living') &&
      (s.population === undefined || s.population > 0),
  )
}

/**
 * @param {object} settlement
 * @returns {boolean}
 */
function isTownTierOrHigher(settlement) {
  const tier = settlement.tier
  return tier === 'town' || tier === 'city' || (settlement.population ?? 0) >= 1000
}

/**
 * @param {string} a
 * @param {string} b
 */
function pairId(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

/**
 * @param {{
 *   settlements: object[],
 *   worldDocument: object,
 *   threeDayHaulDistance: number,
 *   roads?: object[] | null,
 *   inlandSailExpeditionRange?: number,
 * }} params
 * @returns {Set<string>}
 */
function collectRoadOrSailPairs(params) {
  /** @type {Set<string>} */
  const pairs = new Set()
  const doc = params.worldDocument
  if (!doc || params.settlements.length < 2 || !(params.threeDayHaulDistance > 0)) {
    return pairs
  }
  const graph = buildCandidateTradeGraph({
    settlements: params.settlements,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    threeDayHaulDistance: params.threeDayHaulDistance,
    inlandSailExpeditionRange: params.inlandSailExpeditionRange ?? params.threeDayHaulDistance * 3,
    movementCost: doc.fields?.movementCost ?? doc.movementCost ?? null,
    elevation: doc.fields?.elevation ?? null,
    roads: params.roads ?? [],
    sailMask: doc.sailMask ?? null,
    lakeMask: doc.lakeMask ?? null,
    riverCorridorMask: doc.riverCorridorMask ?? null,
  })
  for (const edge of graph.edges) {
    if (edge.mode === 'road' || edge.mode === 'inland_sail' || edge.mode === 'open_sea') {
      pairs.add(pairId(edge.fromSettlementId, edge.toSettlementId))
    }
  }
  return pairs
}

/**
 * @param {{
 *   settlement: object,
 *   radius: number,
 *   worldDocument: object,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 * }} params
 */
function resolveHaulShedCells(params) {
  const claimed = params.primaryClaim?.[params.settlement.id]
  if (Array.isArray(claimed) && claimed.length > 0) return claimed
  const doc = params.worldDocument
  return computeHaulShedIsochrone({
    origin: { x: params.settlement.x, y: params.settlement.y },
    budget: params.radius,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    movementCost: doc.fields?.movementCost ?? doc.movementCost ?? null,
  })
}
