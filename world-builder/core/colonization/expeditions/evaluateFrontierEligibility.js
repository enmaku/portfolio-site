import { computeHaulShedTravelTimes } from '../computeHaulShedIsochrone.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { isVisitRasterCellVisited, neighborCells8 } from './bearingStepUtils.js'
import { classifySettlementMaritimeRole } from './classifySettlementMaritimeRole.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'
import { sailStepTravelCost } from './selectSailExpeditionStep.js'

/**
 * @typedef {Object} FrontierEligibleSender
 * @property {string} settlementId
 * @property {number} population
 * @property {'land' | 'maritime'} pool
 * @property {import('./classifySettlementMaritimeRole.js').SettlementMaritimeRole} maritimeRole
 */

/**
 * @param {{
 *   settlement: { id: string, x: number, y: number, population?: number },
 *   doc: import('../../types.js').WorldDocument,
 *   visitRaster: Uint8Array,
 *   colonistSettings: import('../createDefaultColonizationSlice.js').ColonistSettings,
 *   roadCellMask: Uint8Array | null,
 * }} params
 * @returns {FrontierEligibleSender[]}
 */
export function evaluateFrontierEligibility(params) {
  const { settlement, doc, visitRaster, colonistSettings, roadCellMask } = params
  const population = Number.isFinite(settlement.population) ? settlement.population : 0
  if (population <= 0) {
    return []
  }

  /** @type {FrontierEligibleSender[]} */
  const eligible = []
  const maritimeRole = classifySettlementMaritimeRole(doc, settlement)

  if (isLandFrontierEligible(settlement, doc, visitRaster, colonistSettings, roadCellMask)) {
    eligible.push({
      settlementId: settlement.id,
      population,
      pool: 'land',
      maritimeRole,
    })
  }

  if (
    maritimeRole !== 'none' &&
    isMaritimeFrontierEligible(settlement, doc, visitRaster, colonistSettings, maritimeRole)
  ) {
    eligible.push({
      settlementId: settlement.id,
      population,
      pool: 'maritime',
      maritimeRole,
    })
  }

  return eligible
}

/**
 * @param {{ x: number, y: number }} settlement
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Uint8Array} visitRaster
 * @param {import('../createDefaultColonizationSlice.js').ColonistSettings} colonistSettings
 * @param {Uint8Array | null} roadCellMask
 * @returns {boolean}
 */
function isLandFrontierEligible(settlement, doc, visitRaster, colonistSettings, roadCellMask) {
  const dryLandMask = buildDryLandTraversableMask(doc)
  const travelTime = computeHaulShedTravelTimes({
    origin: settlement,
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    movementCost: doc.movementCost,
    roadCellMask,
  })

  return hasUnvisitedTraversableCell(
    visitRaster,
    dryLandMask,
    travelTime,
    colonistSettings.threeDayHaulDistance,
    doc.gridWidth,
    doc.gridHeight,
  )
}

/**
 * @param {{ x: number, y: number }} settlement
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Uint8Array} visitRaster
 * @param {import('../createDefaultColonizationSlice.js').ColonistSettings} colonistSettings
 * @param {import('./classifySettlementMaritimeRole.js').SettlementMaritimeRole} maritimeRole
 * @returns {boolean}
 */
function isMaritimeFrontierEligible(
  settlement,
  doc,
  visitRaster,
  colonistSettings,
  maritimeRole,
) {
  const sailMask = resolveSailTraversableMask(doc)
  if (!sailMask) return false

  const rangeMultiplier =
    maritimeRole === 'port'
      ? colonistSettings.openSeaExpeditionRange
      : colonistSettings.inlandSailExpeditionRange
  const budget = rangeMultiplier * colonistSettings.threeDayHaulDistance
  const travelTime = computeMaritimeReachTravelTimes(settlement, sailMask, doc, budget)

  return hasUnvisitedTraversableCell(
    visitRaster,
    sailMask,
    travelTime,
    budget,
    doc.gridWidth,
    doc.gridHeight,
  )
}

/**
 * @param {{ x: number, y: number }} origin
 * @param {Uint8Array} sailMask
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} budget
 * @returns {Float32Array}
 */
function computeMaritimeReachTravelTimes(origin, sailMask, doc, budget) {
  const { gridWidth, gridHeight } = doc
  const cellCount = gridWidth * gridHeight
  const travelTime = new Float32Array(cellCount).fill(Number.POSITIVE_INFINITY)

  /** @type {Array<{ x: number, y: number, time: number }>} */
  const queue = []
  const seedCells = [origin]
  for (const neighbor of neighborCells8(origin, gridWidth, gridHeight)) {
    seedCells.push(neighbor)
  }

  for (const cell of seedCells) {
    const index = cell.y * gridWidth + cell.x
    if (sailMask[index] !== 1) continue
    travelTime[index] = 0
    queue.push({ x: cell.x, y: cell.y, time: 0 })
  }

  let head = 0
  while (head < queue.length) {
    const current = queue[head]
    head += 1
    if (current.time > budget) continue

    for (const next of neighborCells8(current, gridWidth, gridHeight)) {
      const nextIndex = next.y * gridWidth + next.x
      if (sailMask[nextIndex] !== 1) continue
      const stepCost = sailStepTravelCost(current, next)
      const nextTime = current.time + stepCost
      if (nextTime > budget || nextTime >= travelTime[nextIndex]) continue
      travelTime[nextIndex] = nextTime
      queue.push({ x: next.x, y: next.y, time: nextTime })
    }
  }

  return travelTime
}

/**
 * @param {Uint8Array} visitRaster
 * @param {Uint8Array} traversableMask
 * @param {Float32Array} travelTime
 * @param {number} budget
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {boolean}
 */
function hasUnvisitedTraversableCell(
  visitRaster,
  traversableMask,
  travelTime,
  budget,
  gridWidth,
  gridHeight,
) {
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const index = y * gridWidth + x
      if (traversableMask[index] !== 1) continue
      if (travelTime[index] > budget) continue
      if (!isVisitRasterCellVisited(visitRaster, x, y, gridWidth)) {
        return true
      }
    }
  }
  return false
}
