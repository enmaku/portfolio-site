import { computeHaulShedTravelTimes } from '../computeHaulShedIsochrone.js'
import { computePrimaryClaimMap, serializeClaimMap } from '../computePrimaryClaimMap.js'
import {
  claimedCellsHaveFreshwater,
  deriveFreshwaterAvailabilityFromDocument,
} from '../freshwater/deriveFreshwaterAvailability.js'
import { findLogisticsNodeAt } from '../logisticsNodes/scoreLogisticsNodes.js'
import { buildLandRouteCellMask } from '../roads/roadNetwork.js'
import { computeClaimProduction } from '../../economy/founding/computeClaimProduction.js'
import { computeLocalPrices, priceFormationDemand } from '../../economy/localPrices.js'
import { buildCandidateTradeGraph } from '../../economy/tradeGraph/buildCandidateRoutes.js'
import { modeGroup } from '../../economy/tradeClearing/pathSearch.js'
import { evaluateTradeAwareFounding } from '../../economy/founding/evaluateTradeAwareFounding.js'
import {
  DAUGHTER_OUTPOST_HEADCOUNT,
  isMaritimeExpeditionMode,
  resolveExpeditionMode,
} from './expeditionConstants.js'
import { classifySettlementMaritimeRole } from './classifySettlementMaritimeRole.js'
import { isSettlementSailReachable } from './selectSailExpeditionStep.js'

/** Minimum travel-time separation for a new pin: one day of the three-day haul budget. */
export const SETTLEMENT_FOUNDING_MIN_HAUL_DAY_FRACTION = 1 / 3

/**
 * @typedef {Object} FoundingCandidate
 * @property {number} x
 * @property {number} y
 * @property {import('../logisticsNodes/scoreLogisticsNodes.js').LogisticsNodeSurveyEntry} node
 */

/**
 * Ordered corridor cells in travel order for founding evaluation.
 *
 * @param {Array<{ x: number, y: number }>} traveledCells
 * @param {import('../logisticsNodes/scoreLogisticsNodes.js').LogisticsNodeSurveyEntry[]} survey
 * @returns {FoundingCandidate[]}
 */
export function listCorridorFoundingCandidates(traveledCells, survey) {
  /** @type {FoundingCandidate[]} */
  const candidates = []
  const seen = new Set()
  for (const cell of traveledCells) {
    const node = findLogisticsNodeAt(survey, cell.x, cell.y)
    if (!node || node.exhausted || node.founded) continue
    const key = `${cell.x},${cell.y}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({ x: cell.x, y: cell.y, node })
  }
  return candidates
}

/**
 * Trade-aware founding viability: freshwater is the hard local gate; food and salt may be
 * covered locally or by the candidate's exportable surplus buying the shortfall over the
 * founding link at parent local prices. Claims recompute as if the new pin already exists.
 *
 * @param {{
 *   candidate: FoundingCandidate,
 *   settlements: object[],
 *   colonistSettings: { threeDayHaulDistance: number, yieldModifier: string, startingPopulation: number },
 *   worldDocument: import('../../types.js').WorldDocument,
 *   roads?: import('../roads/roadNetwork.js').RoadSegment[],
 *   roadMultiplier?: number,
 *   originSettlementId?: string,
 * }} params
 * @returns {boolean}
 */
export function isProvisionalClaimViable(params) {
  const { candidate, settlements, colonistSettings, worldDocument, roads, roadMultiplier } = params
  const candidateId = `candidate-${candidate.x}-${candidate.y}`
  const pins = [
    ...settlements.filter((settlement) => settlement.status !== 'ruin'),
    {
      id: candidateId,
      x: candidate.x,
      y: candidate.y,
      status: 'living',
    },
  ]
  const roadCellMask = buildLandRouteCellMask(
    roads ?? worldDocument.roads,
    worldDocument.gridWidth,
    worldDocument.gridHeight,
  )
  const claimMap = computePrimaryClaimMap({
    pins,
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    movementCost: worldDocument.movementCost,
    roadCellMask,
    roadMultiplier,
  })
  const claimedCells = claimMap.cellsBySettlementId[candidateId] ?? []
  if (claimedCells.length === 0) {
    return false
  }

  const freshwaterClassification = deriveFreshwaterAvailabilityFromDocument(worldDocument)
  const hasFreshwater =
    freshwaterClassification != null &&
    claimedCellsHaveFreshwater(freshwaterClassification, claimedCells, worldDocument.gridWidth)
  if (!hasFreshwater) {
    return false
  }

  const production = computeClaimProduction({
    claimedCells,
    worldDocument,
    yieldModifier: colonistSettings.yieldModifier,
    populationDensity: colonistSettings.populationDensity,
  })

  const parent = params.originSettlementId
    ? settlements.find(
        (settlement) =>
          settlement.id === params.originSettlementId && settlement.status !== 'ruin',
      )
    : null
  const parentCells = parent ? (claimMap.cellsBySettlementId[parent.id] ?? []) : []
  const parentLocalPrices = parent
    ? parentMarketPrices(parentCells, parent, worldDocument, colonistSettings)
    : {}
  const foundingLink = parent
    ? resolveFoundingLink({ parent, candidate, candidateId, worldDocument, colonistSettings, roads })
    : null

  const result = evaluateTradeAwareFounding({
    production,
    population: DAUGHTER_OUTPOST_HEADCOUNT,
    hasFreshwater,
    parentLocalPrices,
    foundingLink,
  })
  return result.viable
}

/**
 * Parent settlement's local prices in its own single-settlement market.
 *
 * @param {ReadonlyArray<{ x: number, y: number }>} parentCells
 * @param {{ population?: number }} parent
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {{ yieldModifier: string, populationDensity?: number }} colonistSettings
 * @returns {Record<import('../../economy/commodityCatalog.js').CommodityId, number>}
 */
function parentMarketPrices(parentCells, parent, worldDocument, colonistSettings) {
  const production = computeClaimProduction({
    claimedCells: parentCells,
    worldDocument,
    yieldModifier: colonistSettings.yieldModifier,
    populationDensity: colonistSettings.populationDensity,
  })
  return computeLocalPrices({
    supplyByCommodity: production,
    demandByCommodity: priceFormationDemand(Math.max(0, parent.population ?? 0)),
  })
}

/**
 * Cheapest single geography link between parent and candidate for the founding check.
 *
 * @param {{
 *   parent: { id: string, x: number, y: number, population?: number },
 *   candidate: { x: number, y: number },
 *   candidateId: string,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   colonistSettings: { threeDayHaulDistance: number, inlandSailExpeditionRange?: number },
 *   roads?: import('../roads/roadNetwork.js').RoadSegment[],
 * }} params
 * @returns {import('../../economy/founding/evaluateTradeAwareFounding.js').FoundingLink | null}
 */
function resolveFoundingLink(params) {
  const { parent, candidate, candidateId, worldDocument, colonistSettings, roads } = params
  const haulDistance = colonistSettings.threeDayHaulDistance
  const graph = buildCandidateTradeGraph({
    settlements: [
      {
        id: parent.id,
        x: parent.x,
        y: parent.y,
        population: Math.max(0, parent.population ?? 0),
        maritimeRole: classifySettlementMaritimeRole(worldDocument, parent),
      },
      {
        id: candidateId,
        x: candidate.x,
        y: candidate.y,
        population: DAUGHTER_OUTPOST_HEADCOUNT,
        maritimeRole: classifySettlementMaritimeRole(worldDocument, candidate),
      },
    ],
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    threeDayHaulDistance: haulDistance,
    inlandSailExpeditionRange: (colonistSettings.inlandSailExpeditionRange ?? 0) * haulDistance,
    movementCost: worldDocument.movementCost,
    elevation: worldDocument.fields?.elevation,
    roads: roads ?? worldDocument.roads,
    lakeMask: worldDocument.lakeMask,
    riverCorridorMask: worldDocument.riverCorridorMask,
  })
  if (graph.edges.length === 0) {
    return null
  }
  let best = graph.edges[0]
  for (const edge of graph.edges) {
    if (edge.transportCostCpPerLb < best.transportCostCpPerLb) {
      best = edge
    }
  }
  return {
    transportCostCpPerLb: best.transportCostCpPerLb,
    capacityLb: best.capacityLb,
    importToll: modeGroup(best.mode) === 'water',
  }
}

/**
 * @param {number} threeDayHaulDistance
 * @returns {number}
 */
export function computeOneDayHaulDistance(threeDayHaulDistance) {
  return threeDayHaulDistance * SETTLEMENT_FOUNDING_MIN_HAUL_DAY_FRACTION
}

/**
 * @param {{
 *   settlements: object[],
 *   x: number,
 *   y: number,
 *   colonistSettings: { threeDayHaulDistance: number },
 *   worldDocument: import('../../types.js').WorldDocument,
 *   roads?: import('../roads/roadNetwork.js').RoadSegment[],
 *   roadMultiplier?: number,
 * }} params
 * @returns {boolean}
 */
export function isSettlementFoundingSpacingSatisfied(params) {
  const { settlements, x, y, colonistSettings, worldDocument, roads, roadMultiplier } = params

  if (settlements.some((settlement) => settlement.x === x && settlement.y === y)) {
    return false
  }

  const livingSettlements = settlements.filter((settlement) => settlement.status !== 'ruin')
  if (livingSettlements.length === 0) {
    return true
  }

  const oneDayHaulDistance = computeOneDayHaulDistance(colonistSettings.threeDayHaulDistance)
  if (!Number.isFinite(oneDayHaulDistance) || oneDayHaulDistance <= 0) {
    return true
  }

  const roadCellMask = buildLandRouteCellMask(
    roads ?? worldDocument.roads,
    worldDocument.gridWidth,
    worldDocument.gridHeight,
  )
  const travelTime = computeHaulShedTravelTimes({
    origin: { x, y },
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    movementCost: worldDocument.movementCost,
    roadCellMask,
    roadMultiplier,
  })

  const gridWidth = worldDocument.gridWidth
  for (const settlement of livingSettlements) {
    const index = settlement.y * gridWidth + settlement.x
    const time = travelTime[index]
    if (!Number.isFinite(time)) {
      continue
    }
    if (time < oneDayHaulDistance) {
      return false
    }
  }

  return true
}

/**
 * @param {FoundingCandidate[]} candidates
 * @param {object[]} settlements
 * @param {import('../createDefaultColonizationSlice.js').ColonistSettings} colonistSettings
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {import('../roads/roadNetwork.js').RoadSegment[]} [roads]
 * @param {import('./expeditionConstants.js').ExpeditionMode} [expeditionMode]
 * @param {string} [originSettlementId] Founding parent whose local prices and link gate imports.
 * @returns {{ candidate: FoundingCandidate } | { rejected: FoundingCandidate } | null}
 */
export function evaluateFirstViableCorridorCandidate(
  candidates,
  settlements,
  colonistSettings,
  worldDocument,
  roads,
  expeditionMode = 'land',
  originSettlementId,
) {
  let firstRejected = null
  for (const candidate of candidates) {
    if (
      !isSettlementFoundingSpacingSatisfied({
        settlements,
        x: candidate.x,
        y: candidate.y,
        colonistSettings,
        worldDocument,
        roads,
      })
    ) {
      continue
    }
    if (
      isMaritimeExpeditionMode(resolveExpeditionMode(expeditionMode)) &&
      !isSettlementSailReachable(worldDocument, { x: candidate.x, y: candidate.y })
    ) {
      continue
    }
    const viable = isProvisionalClaimViable({
      candidate,
      settlements,
      colonistSettings,
      worldDocument,
      roads,
      originSettlementId,
    })
    if (viable) {
      return { candidate }
    }
    if (!firstRejected) {
      firstRejected = candidate
    }
  }
  if (firstRejected) {
    return { rejected: firstRejected }
  }
  return null
}

/**
 * @param {Record<string, Array<{ x: number, y: number }>>} primaryClaim
 * @returns {Record<string, Array<{ x: number, y: number }>>}
 */
export function clonePrimaryClaim(primaryClaim) {
  /** @type {Record<string, Array<{ x: number, y: number }>>} */
  const next = {}
  for (const [settlementId, cells] of Object.entries(primaryClaim)) {
    next[settlementId] = cells.map((cell) => ({ x: cell.x, y: cell.y }))
  }
  return next
}

export { serializeClaimMap }
