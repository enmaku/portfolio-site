import { computePrimaryClaimMap, serializeClaimMap } from '../computePrimaryClaimMap.js'
import { applySurvivalResolveToSettlement } from '../resolveSurvivalTriad.js'
import { saltSpoilageMultiplier } from '../saltSpoilageMultiplier.js'
import { findLogisticsNodeAt } from '../logisticsNodes/scoreLogisticsNodes.js'
import { buildLandRouteCellMask } from '../roads/roadNetwork.js'
import { isMaritimeExpeditionMode, resolveExpeditionMode } from './expeditionConstants.js'
import { isSettlementSailReachable } from './selectSailExpeditionStep.js'

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
 * @param {{
 *   candidate: FoundingCandidate,
 *   settlements: object[],
 *   colonistSettings: { threeDayHaulDistance: number, yieldModifier: string, startingPopulation: number },
 *   worldDocument: import('../../types.js').WorldDocument,
 *   roads?: import('../roads/roadNetwork.js').RoadSegment[],
 *   roadMultiplier?: number,
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

  const { survival } = applySurvivalResolveToSettlement({
    settlement: {
      id: candidateId,
      x: candidate.x,
      y: candidate.y,
      population: 1,
      status: 'living',
    },
    claimedCells,
    colonistSettings,
    worldDocument,
    saltSpoilageMultiplier: saltSpoilageMultiplier(claimedCells, worldDocument.saltNodes),
  })
  return survival.hasFreshwater && survival.populationCeiling > 0
}

/**
 * @param {object[]} settlements
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isDistinctSettlementPin(settlements, x, y) {
  return !settlements.some((settlement) => settlement.x === x && settlement.y === y)
}

/**
 * @param {FoundingCandidate[]} candidates
 * @param {object[]} settlements
 * @param {import('../createDefaultColonizationSlice.js').ColonistSettings} colonistSettings
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {import('../roads/roadNetwork.js').RoadSegment[]} [roads]
 * @param {import('./expeditionConstants.js').ExpeditionMode} [expeditionMode]
 * @returns {{ candidate: FoundingCandidate } | { rejected: FoundingCandidate } | null}
 */
export function evaluateFirstViableCorridorCandidate(
  candidates,
  settlements,
  colonistSettings,
  worldDocument,
  roads,
  expeditionMode = 'land',
) {
  let firstRejected = null
  for (const candidate of candidates) {
    if (!isDistinctSettlementPin(settlements, candidate.x, candidate.y)) {
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
