import { computeHaulShedTravelTimes } from '../computeHaulShedIsochrone.js'
import {
  buildLivingPrimaryClaimState,
  computePrimaryClaimMap,
  computePrimaryClaimMapAddingPin,
  serializeClaimMap,
} from '../computePrimaryClaimMap.js'
import {
  claimedCellsHaveFreshwater,
  deriveFreshwaterAvailabilityFromDocument,
} from '../freshwater/deriveFreshwaterAvailability.js'
import { findLogisticsNodeAt } from '../logisticsNodes/scoreLogisticsNodes.js'
import { buildLandRouteCellMask } from '../roads/roadNetwork.js'
import { computeClaimProduction } from '../../economy/founding/computeClaimProduction.js'
import { computeLocalPrices, priceFormationDemand } from '../../economy/localPrices.js'
import { computeRoadPathDistances } from '../tradeGraph/buildCandidateRoutes.js'
import {
  routeCargoCapacityLb,
  transportCostCpPerLb,
} from '../../economy/tradeGraph/routeEconomics.js'
import { modeGroup } from '../../economy/tradeClearing/pathSearch.js'
import { evaluateTradeAwareFounding } from '../../economy/founding/evaluateTradeAwareFounding.js'
import {
  DAUGHTER_OUTPOST_HEADCOUNT,
  isMaritimeExpeditionMode,
  resolveExpeditionMode,
} from './expeditionConstants.js'
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
 * @typedef {Object} FoundingNetworkContext
 * @property {import('../computePrimaryClaimMap.js').LivingPrimaryClaimState} [livingClaimState]
 * @property {Uint8Array} [roadCellMask]
 * @property {Uint8Array | null} [dryLandMask]
 * @property {Uint8Array | null} [sailMask]
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
 *   livingClaimState?: import('../computePrimaryClaimMap.js').LivingPrimaryClaimState | null,
 *   roadCellMask?: Uint8Array | null,
 *   dryLandMask?: Uint8Array | null,
 *   sailMask?: Uint8Array | null,
 * }} params
 * @returns {boolean}
 */
export function isProvisionalClaimViable(params) {
  const { candidate, settlements, colonistSettings, worldDocument, roads, roadMultiplier } = params
  const candidateId = `candidate-${candidate.x}-${candidate.y}`
  const roadCellMask =
    params.roadCellMask ??
    buildLandRouteCellMask(
      roads ?? worldDocument.roads,
      worldDocument.gridWidth,
      worldDocument.gridHeight,
    )
  const budget = colonistSettings.threeDayHaulDistance
  const livingPins = settlements.filter((settlement) => settlement.status !== 'ruin')

  /** @type {import('../computePrimaryClaimMap.js').PrimaryClaimMap} */
  let claimMap
  /** @type {Float64Array | undefined} */
  let parentTravelTime
  if (params.livingClaimState) {
    const added = computePrimaryClaimMapAddingPin({
      base: params.livingClaimState,
      candidatePin: {
        id: candidateId,
        x: candidate.x,
        y: candidate.y,
        status: 'living',
      },
      budget,
      gridWidth: worldDocument.gridWidth,
      gridHeight: worldDocument.gridHeight,
      movementCost: worldDocument.movementCost,
      roadCellMask,
      roadMultiplier,
    })
    claimMap = {
      ownerByCell: added.ownerByCell,
      cellsBySettlementId: added.cellsBySettlementId,
    }
  } else {
    const pins = [
      ...livingPins,
      {
        id: candidateId,
        x: candidate.x,
        y: candidate.y,
        status: 'living',
      },
    ]
    claimMap = computePrimaryClaimMap({
      pins,
      budget,
      gridWidth: worldDocument.gridWidth,
      gridHeight: worldDocument.gridHeight,
      movementCost: worldDocument.movementCost,
      roadCellMask,
      roadMultiplier,
    })
  }

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
  if (parent && params.livingClaimState?.travelTimeByPinId?.[parent.id]) {
    parentTravelTime = params.livingClaimState.travelTimeByPinId[parent.id]
  }
  const foundingLink = parent
    ? resolveFoundingLink({
        parent,
        candidate,
        candidateId,
        worldDocument,
        colonistSettings,
        roads,
        roadCellMask,
        parentTravelTime,
        dryLandMask: params.dryLandMask,
        sailMask: params.sailMask,
      })
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
 * Cheapest land geography link between parent and candidate for the founding check.
 * Prefer road when both pins are road-connected; otherwise overland haul-shed time.
 *
 * @param {{
 *   parent: { id: string, x: number, y: number, population?: number },
 *   candidate: { x: number, y: number },
 *   candidateId: string,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   colonistSettings: { threeDayHaulDistance: number, inlandSailExpeditionRange?: number },
 *   roads?: import('../roads/roadNetwork.js').RoadSegment[],
 *   roadCellMask?: Uint8Array | null,
 *   parentTravelTime?: Float64Array | null,
 *   dryLandMask?: Uint8Array | null,
 *   sailMask?: Uint8Array | null,
 * }} params
 * @returns {import('../../economy/founding/evaluateTradeAwareFounding.js').FoundingLink | null}
 */
export function resolveFoundingLink(params) {
  const {
    parent,
    candidate,
    worldDocument,
    colonistSettings,
    roads,
    parentTravelTime,
  } = params
  const haulDistance = colonistSettings.threeDayHaulDistance
  const gridWidth = worldDocument.gridWidth
  const gridHeight = worldDocument.gridHeight
  const roadCellMask =
    params.roadCellMask ??
    buildLandRouteCellMask(roads ?? worldDocument.roads, gridWidth, gridHeight)
  const parentPop = Math.max(0, parent.population ?? 0)
  const candidatePop = DAUGHTER_OUTPOST_HEADCOUNT
  const parentIndex = parent.y * gridWidth + parent.x
  const candidateIndex = candidate.y * gridWidth + candidate.x

  /** @type {{ mode: 'road' | 'overland', haulDistanceFraction: number } | null} */
  let chosen = null

  if (roadCellMask[parentIndex] === 1 && roadCellMask[candidateIndex] === 1) {
    const distances = computeRoadPathDistances(
      parentIndex,
      roadCellMask,
      gridWidth,
      gridHeight,
    )
    const distance = distances[candidateIndex]
    if (Number.isFinite(distance)) {
      chosen = { mode: 'road', haulDistanceFraction: distance / haulDistance }
    }
  }

  if (!chosen) {
    const travel =
      parentTravelTime ??
      computeHaulShedTravelTimes({
        origin: { x: parent.x, y: parent.y },
        budget: haulDistance,
        gridWidth,
        gridHeight,
        movementCost: worldDocument.movementCost,
        roadCellMask,
      })
    const time = travel[candidateIndex]
    if (Number.isFinite(time) && time <= haulDistance) {
      chosen = { mode: 'overland', haulDistanceFraction: time / haulDistance }
    }
  }

  if (!chosen) return null

  return {
    transportCostCpPerLb: transportCostCpPerLb({
      mode: chosen.mode,
      haulDistanceFraction: chosen.haulDistanceFraction,
      directionalFriction: 1,
    }),
    capacityLb: routeCargoCapacityLb({
      populationA: parentPop,
      populationB: candidatePop,
      mode: chosen.mode,
    }),
    importToll: modeGroup(chosen.mode) === 'water',
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
 *   roadCellMask?: Uint8Array | null,
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

  const roadCellMask =
    params.roadCellMask ??
    buildLandRouteCellMask(
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
 * @param {FoundingNetworkContext} [networkContext]
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
  networkContext = undefined,
) {
  let firstRejected = null
  const roadCellMask =
    networkContext?.roadCellMask ??
    buildLandRouteCellMask(
      roads ?? worldDocument.roads,
      worldDocument.gridWidth,
      worldDocument.gridHeight,
    )
  for (const candidate of candidates) {
    if (
      !isSettlementFoundingSpacingSatisfied({
        settlements,
        x: candidate.x,
        y: candidate.y,
        colonistSettings,
        worldDocument,
        roads,
        roadCellMask,
      })
    ) {
      continue
    }
    if (
      isMaritimeExpeditionMode(resolveExpeditionMode(expeditionMode)) &&
      !(
        networkContext?.sailMask
          ? networkContext.sailMask[candidate.y * worldDocument.gridWidth + candidate.x] === 1
          : isSettlementSailReachable(worldDocument, { x: candidate.x, y: candidate.y })
      )
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
      livingClaimState: networkContext?.livingClaimState,
      roadCellMask,
      dryLandMask: networkContext?.dryLandMask,
      sailMask: networkContext?.sailMask,
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
 * Build living claim competition state for network founding (call once per advance).
 *
 * @param {{
 *   settlements: object[],
 *   colonistSettings: { threeDayHaulDistance: number },
 *   worldDocument: import('../../types.js').WorldDocument,
 *   roads?: import('../roads/roadNetwork.js').RoadSegment[],
 *   roadCellMask?: Uint8Array | null,
 *   roadMultiplier?: number,
 * }} params
 * @returns {import('../computePrimaryClaimMap.js').LivingPrimaryClaimState}
 */
export function buildNetworkLivingClaimState(params) {
  const roadCellMask =
    params.roadCellMask ??
    buildLandRouteCellMask(
      params.roads ?? params.worldDocument.roads,
      params.worldDocument.gridWidth,
      params.worldDocument.gridHeight,
    )
  return buildLivingPrimaryClaimState({
    pins: params.settlements,
    budget: params.colonistSettings.threeDayHaulDistance,
    gridWidth: params.worldDocument.gridWidth,
    gridHeight: params.worldDocument.gridHeight,
    movementCost: params.worldDocument.movementCost,
    roadCellMask,
    roadMultiplier: params.roadMultiplier,
  })
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
