import { computeHaulShedTravelTimes } from '../computeHaulShedIsochrone.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { isVisitRasterCellVisited, neighborCells8 } from './bearingStepUtils.js'
import { classifySettlementMaritimeRole } from './classifySettlementMaritimeRole.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'
import { sailStepTravelCost } from './selectSailExpeditionStep.js'

/** Cells scanned between UI yields when reporting visit-grid progress. */
export const DISPATCH_ELIGIBILITY_SCAN_CELL_BATCH = 8192

/** Isochrone heap expansions between sync progress updates. */
export const DISPATCH_ELIGIBILITY_ISOCHRONE_PROGRESS_INTERVAL = 4096

/** Maritime BFS expansions between UI yields during reachability search. */
export const DISPATCH_ELIGIBILITY_MARITIME_BFS_YIELD_BATCH = 256

/** Maritime BFS percent range while the reachability queue is draining. */
const MARITIME_BFS_PERCENT_START = 10
const MARITIME_BFS_PERCENT_END = 59

/**
 * @typedef {Object} DispatchEligibilityProgressHooks
 * @property {(phase: 'Land' | 'Maritime', percent: number) => void} reportSync
 * @property {() => Promise<void>} yieldToUi
 */

/**
 * UI-only eligibility evaluation with progress reporting. Sync eligibility is unchanged.
 *
 * @param {Parameters<import('./evaluateFrontierEligibility.js').evaluateFrontierEligibility>[0] & {
 *   progressHooks: DispatchEligibilityProgressHooks,
 *   maritimeRole?: import('./classifySettlementMaritimeRole.js').SettlementMaritimeRole,
 *   sailMask?: Uint8Array | null,
 * }} params
 * @returns {Promise<import('./evaluateFrontierEligibility.js').FrontierEligibleSender[]>}
 */
export async function evaluateFrontierEligibilityWithDispatchProgress(params) {
  const {
    settlement,
    doc,
    visitRaster,
    colonistSettings,
    roadCellMask,
    progressHooks,
    maritimeRole: providedMaritimeRole,
    sailMask: providedSailMask,
  } = params
  const population = Number.isFinite(settlement.population) ? settlement.population : 0
  if (population <= 0) {
    return []
  }

  const maritimeRole =
    providedMaritimeRole ?? classifySettlementMaritimeRole(doc, settlement)

  /** @type {import('./evaluateFrontierEligibility.js').FrontierEligibleSender[]} */
  const eligible = []

  progressHooks.reportSync('Land', 0)
  await progressHooks.yieldToUi()

  if (
    await isLandFrontierEligibleWithDispatchProgress(
      settlement,
      doc,
      visitRaster,
      colonistSettings,
      roadCellMask,
      progressHooks,
    )
  ) {
    eligible.push({
      settlementId: settlement.id,
      population,
      pool: 'land',
      maritimeRole,
    })
  }

  progressHooks.reportSync('Land', 100)
  await progressHooks.yieldToUi()

  if (maritimeRole !== 'none') {
    progressHooks.reportSync('Maritime', 0)
    await progressHooks.yieldToUi()

    if (
      await isMaritimeFrontierEligibleWithDispatchProgress(
        settlement,
        doc,
        visitRaster,
        colonistSettings,
        maritimeRole,
        progressHooks,
        providedSailMask,
      )
    ) {
      eligible.push({
        settlementId: settlement.id,
        population,
        pool: 'maritime',
        maritimeRole,
      })
    }

    progressHooks.reportSync('Maritime', 100)
    await progressHooks.yieldToUi()
  }

  return eligible
}

/**
 * @param {Parameters<import('./evaluateFrontierEligibility.js').evaluateFrontierEligibility>[0]['settlement']} settlement
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Uint8Array} visitRaster
 * @param {import('../createDefaultColonizationSlice.js').ColonistSettings} colonistSettings
 * @param {Uint8Array | null} roadCellMask
 * @param {DispatchEligibilityProgressHooks} progressHooks
 * @returns {Promise<boolean>}
 */
async function isLandFrontierEligibleWithDispatchProgress(
  settlement,
  doc,
  visitRaster,
  colonistSettings,
  roadCellMask,
  progressHooks,
) {
  const dryLandMask = buildDryLandTraversableMask(doc)
  progressHooks.reportSync('Land', 5)

  let isochroneExpansions = 0
  let landIsochronePercent = 5
  const travelTime = computeHaulShedTravelTimes({
    origin: settlement,
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    movementCost: doc.movementCost,
    roadCellMask,
    onIsochroneProgress: () => {
      isochroneExpansions += 1
      if (isochroneExpansions % DISPATCH_ELIGIBILITY_ISOCHRONE_PROGRESS_INTERVAL !== 0) {
        return
      }
      landIsochronePercent = Math.min(39, landIsochronePercent + 4)
      progressHooks.reportSync('Land', landIsochronePercent)
    },
  })

  progressHooks.reportSync('Land', 40)
  await progressHooks.yieldToUi()

  return scanForUnvisitedTraversableCellWithDispatchProgress({
    visitRaster,
    traversableMask: dryLandMask,
    travelTime,
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    phase: 'Land',
    percentStart: 40,
    percentEnd: 100,
    progressHooks,
  })
}

/**
 * @param {Parameters<import('./evaluateFrontierEligibility.js').evaluateFrontierEligibility>[0]['settlement']} settlement
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Uint8Array} visitRaster
 * @param {import('../createDefaultColonizationSlice.js').ColonistSettings} colonistSettings
 * @param {import('./classifySettlementMaritimeRole.js').SettlementMaritimeRole} maritimeRole
 * @param {DispatchEligibilityProgressHooks} progressHooks
 * @param {Uint8Array | null | undefined} providedSailMask
 * @returns {Promise<boolean>}
 */
async function isMaritimeFrontierEligibleWithDispatchProgress(
  settlement,
  doc,
  visitRaster,
  colonistSettings,
  maritimeRole,
  progressHooks,
  providedSailMask,
) {
  progressHooks.reportSync('Maritime', 5)
  await progressHooks.yieldToUi()

  const sailMask = providedSailMask ?? resolveSailTraversableMask(doc)
  if (!sailMask) return false

  progressHooks.reportSync('Maritime', 10)
  await progressHooks.yieldToUi()

  const rangeMultiplier =
    maritimeRole === 'port'
      ? colonistSettings.openSeaExpeditionRange
      : colonistSettings.inlandSailExpeditionRange
  const budget = rangeMultiplier * colonistSettings.threeDayHaulDistance

  const travelTime = await computeMaritimeReachTravelTimesWithDispatchProgress(
    settlement,
    sailMask,
    doc,
    budget,
    countMaskCells(sailMask),
    progressHooks,
  )

  progressHooks.reportSync('Maritime', 60)
  await progressHooks.yieldToUi()

  return scanForUnvisitedTraversableCellWithDispatchProgress({
    visitRaster,
    traversableMask: sailMask,
    travelTime,
    budget,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    phase: 'Maritime',
    percentStart: 60,
    percentEnd: 100,
    progressHooks,
  })
}

/**
 * @param {{
 *   visitRaster: Uint8Array,
 *   traversableMask: Uint8Array,
 *   travelTime: Float32Array,
 *   budget: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   phase: 'Land' | 'Maritime',
 *   percentStart: number,
 *   percentEnd: number,
 *   progressHooks: DispatchEligibilityProgressHooks,
 * }} params
 * @returns {Promise<boolean>}
 */
async function scanForUnvisitedTraversableCellWithDispatchProgress(params) {
  const {
    visitRaster,
    traversableMask,
    travelTime,
    budget,
    gridWidth,
    gridHeight,
    phase,
    percentStart,
    percentEnd,
    progressHooks,
  } = params
  const percentSpan = percentEnd - percentStart
  const totalCells = gridWidth * gridHeight
  let processedCells = 0

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      processedCells += 1
      const index = y * gridWidth + x
      if (traversableMask[index] !== 1) continue
      if (travelTime[index] > budget) continue
      if (!isVisitRasterCellVisited(visitRaster, x, y, gridWidth)) {
        return true
      }

      if (
        processedCells % DISPATCH_ELIGIBILITY_SCAN_CELL_BATCH === 0 ||
        processedCells === totalCells
      ) {
        const cellFraction = processedCells / totalCells
        progressHooks.reportSync(
          phase,
          percentStart + Math.round(cellFraction * percentSpan),
        )
        await progressHooks.yieldToUi()
      }
    }
  }
  return false
}

/**
 * @param {Uint8Array} mask
 * @returns {number}
 */
function countMaskCells(mask) {
  let count = 0
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 1) count += 1
  }
  return count
}

/**
 * @param {{ x: number, y: number }} origin
 * @param {Uint8Array} sailMask
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} budget
 * @param {number} sailTraversableCells
 * @param {DispatchEligibilityProgressHooks} progressHooks
 * @returns {Promise<Float32Array>}
 */
async function computeMaritimeReachTravelTimesWithDispatchProgress(
  origin,
  sailMask,
  doc,
  budget,
  sailTraversableCells,
  progressHooks,
) {
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
  let expansionsInBatch = 0
  let maritimeBfsPercent = MARITIME_BFS_PERCENT_START
  const bfsPercentSpan = MARITIME_BFS_PERCENT_END - MARITIME_BFS_PERCENT_START
  const sailCellDenominator = Math.max(1, sailTraversableCells)

  while (head < queue.length) {
    const current = queue[head]
    head += 1
    expansionsInBatch += 1

    if (current.time <= budget) {
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

    if (
      expansionsInBatch >= DISPATCH_ELIGIBILITY_MARITIME_BFS_YIELD_BATCH ||
      head === queue.length
    ) {
      expansionsInBatch = 0
      const queueProgress = queue.length > 0 ? head / queue.length : 1
      const sailMaskProgress = head / sailCellDenominator
      const bfsComplete = head === queue.length
      const progress = bfsComplete
        ? 1
        : Math.min(queueProgress, sailMaskProgress)
      const candidatePercent =
        MARITIME_BFS_PERCENT_START + Math.round(bfsPercentSpan * Math.min(1, progress))
      maritimeBfsPercent = Math.max(maritimeBfsPercent, candidatePercent)
      progressHooks.reportSync('Maritime', maritimeBfsPercent)
      await progressHooks.yieldToUi()
    }
  }

  return travelTime
}
