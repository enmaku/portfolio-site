import {
  SEASON_ORDER,
  accumulateEffectiveRunoff,
  computeSeasonalRunoff,
  computeSeasonalSnowAccum,
  deriveYearlyClimateNoise,
} from './seasonalClimatology.js'
import { deriveFieldSeed, createSeededRandom } from '../noise/seededRandom.js'

const FILL_EPSILON = 1e-5
const BREACH_EPSILON = 1e-4
/** Converts accumulated runoff flow units into normalized elevation depth. */
const RUNOFF_TO_DEPTH = 0.0004

/**
 * @typedef {Object} SeasonalHydrologyStats
 * @property {number} overflowLakeCount
 * @property {number} seasonalYearCount
 * @property {number} meanLakeLevelDelta
 */

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.filledElevation
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} params.temperature
 * @param {Uint8Array} params.snowCapMask
 * @param {Uint8Array} params.lakeMask
 * @param {import('../types.js').LakeRecord[]} params.lakes
 * @param {import('../types.js').LakeMetaRecord[]} params.lakeMeta
 * @param {number[][]} params.catchmentCellsByLake
 * @param {Int32Array} params.lakeIdByCell
 * @param {Float32Array} [params.soilDrainage]
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {import('../types.js').WorldGenerationOptions} params.options
 * @returns {{
 *   filledElevation: Float32Array,
 *   lakeMeta: import('../types.js').LakeMetaRecord[],
 *   lakes: import('../types.js').LakeRecord[],
 *   effectiveRunoff: Float32Array,
 *   overflowLakeIds: Set<number>,
 *   seasonalStats: SeasonalHydrologyStats,
 * }}
 */
export function simulateSeasonalHydrology({
  elevation,
  filledElevation,
  rainfall,
  temperature,
  snowCapMask,
  lakeMask,
  lakes,
  lakeMeta,
  catchmentCellsByLake,
  lakeIdByCell,
  soilDrainage,
  ocean,
  width,
  height,
  geographySeed,
  options,
}) {
  const cellCount = width * height
  const updatedMeta = lakeMeta.map((meta) => ({ ...meta }))
  const updatedLakes = lakes.map((lake) => ({ ...lake }))
  const workingElevation = new Float32Array(filledElevation)
  const effectiveRunoff = new Float32Array(cellCount)
  const overflowLakeIds = new Set()
  const snowPackByLake = new Float64Array(lakes.length)
  const waterLevelByLake = new Float64Array(lakes.length)

  for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
    const meta = updatedMeta[lakeId]
    const floor = meta.floorElevation ?? meta.surfaceElevation
    const spill = meta.spillElevation ?? meta.surfaceElevation
    meta.floorElevation = floor
    meta.spillElevation = spill
    meta.waterLevel = floor
    meta.snowPack = 0
    meta.hasOverflowed = false
    waterLevelByLake[lakeId] = floor
    applyLakeSurface(workingElevation, lakeIdByCell, lakeId, floor)
  }

  let totalLevelDelta = 0
  let lakesWithMeta = 0

  for (let year = 0; year < options.seasonalYearCount; year += 1) {
    const yearMult = deriveYearlyClimateNoise(
      geographySeed,
      year,
      options.yearlyClimateNoiseScale,
    )

    for (const season of SEASON_ORDER) {
      const seasonalRunoff = computeSeasonalRunoff({
        baseRainfall: rainfall,
        soilDrainage,
        soilDrainageScale: options.soilDrainageScale,
        ocean,
        season,
        options,
        yearMult,
      })
      accumulateEffectiveRunoff(effectiveRunoff, seasonalRunoff, season)

      if (season === 'cold') {
        const snowAccum = computeSeasonalSnowAccum({
          baseRainfall: rainfall,
          snowCapMask,
          ocean,
          options,
          yearMult,
        })
        for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
          const cells = catchmentCellsByLake[lakeId] ?? []
          let pack = 0
          for (const cellIdx of cells) {
            pack += snowAccum[cellIdx]
          }
          snowPackByLake[lakeId] += pack
          updatedMeta[lakeId].snowPack = snowPackByLake[lakeId]
        }
        continue
      }

      for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
        const meta = updatedMeta[lakeId]
        if (meta.outletX !== undefined) continue

        const cells = catchmentCellsByLake[lakeId] ?? []
        if (cells.length === 0) continue

        const catchmentScale = Math.max(1, Math.sqrt(cells.length))
        let inflowDepth = 0
        for (const cellIdx of cells) {
          if (!lakeMask[cellIdx]) {
            inflowDepth += seasonalRunoff[cellIdx] * RUNOFF_TO_DEPTH
          }
        }
        inflowDepth /= catchmentScale

        let snowMeltDepth = 0
        if (season === 'melt' && snowPackByLake[lakeId] > 0) {
          const meltFlow =
            snowPackByLake[lakeId] * options.meltReleaseScale * yearMult
          snowMeltDepth = meltFlow * RUNOFF_TO_DEPTH / catchmentScale
          snowPackByLake[lakeId] = Math.max(0, snowPackByLake[lakeId] - meltFlow)
          meta.snowPack = snowPackByLake[lakeId]
        }

        let evaporationDepth = 0
        if (season === 'dry') {
          const lakeArea = updatedLakes[lakeId].area
          const meanTemp = meanCatchmentTemperature(cells, temperature)
          evaporationDepth =
            (lakeArea / cellCount) *
            options.lakeEvaporationScale *
            (0.03 + meanTemp * 0.05)
        }

        let waterLevel = waterLevelByLake[lakeId] + inflowDepth + snowMeltDepth - evaporationDepth
        const spillElev = meta.spillElevation ?? meta.surfaceElevation
        let outflowDepth = 0

        if (waterLevel > spillElev + FILL_EPSILON) {
          outflowDepth = waterLevel - spillElev
          waterLevel = spillElev
          meta.hasOverflowed = true
          overflowLakeIds.add(lakeId)
          updatedLakes[lakeId].endorheic = false
          meta.endorheic = false

          const outletIdx = findSpillOutletCell(cells, lakeMask, elevation, width, height, spillElev)
          if (outletIdx >= 0) {
            meta.overflowOutletIdx = outletIdx
            updatedLakes[lakeId].spillX = outletIdx % width
            updatedLakes[lakeId].spillY = Math.floor(outletIdx / width)
            effectiveRunoff[outletIdx] = Math.max(
              effectiveRunoff[outletIdx],
              seasonalRunoff[outletIdx] + outflowDepth / RUNOFF_TO_DEPTH,
            )
          }
        }

        const floor = meta.floorElevation ?? meta.surfaceElevation
        waterLevel = Math.min(spillElev, Math.max(floor, waterLevel))
        waterLevelByLake[lakeId] = waterLevel
        meta.waterLevel = waterLevel
        meta.surfaceElevation = waterLevel
        applyLakeSurface(workingElevation, lakeIdByCell, lakeId, waterLevel)

        totalLevelDelta += Math.abs(waterLevel - floor)
        lakesWithMeta += 1
      }
    }
  }

  return {
    filledElevation: workingElevation,
    lakeMeta: updatedMeta,
    lakes: updatedLakes,
    effectiveRunoff,
    overflowLakeIds,
    seasonalStats: {
      overflowLakeCount: overflowLakeIds.size,
      seasonalYearCount: options.seasonalYearCount,
      meanLakeLevelDelta: lakesWithMeta > 0 ? totalLevelDelta / lakesWithMeta : 0,
    },
  }
}

/** @param {number[]} cells @param {Float32Array} temperature */
function meanCatchmentTemperature(cells, temperature) {
  if (cells.length === 0) return 0
  let sum = 0
  for (const cellIdx of cells) {
    sum += temperature[cellIdx]
  }
  return sum / cells.length
}

/**
 * @param {number[]} basinCells
 * @param {Uint8Array} lakeMask
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} spillElev
 */
function findSpillOutletCell(basinCells, lakeMask, elevation, width, height, spillElev) {
  const basinSet = new Set(basinCells)
  let bestIdx = -1
  let bestDelta = Number.POSITIVE_INFINITY

  for (const cellIdx of basinCells) {
    const x = cellIdx % width
    const y = Math.floor(cellIdx / width)
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (basinSet.has(nIdx) || lakeMask[nIdx]) continue
      const delta = Math.abs(elevation[nIdx] - spillElev)
      if (elevation[nIdx] <= spillElev + 0.05 && delta < bestDelta) {
        bestDelta = delta
        bestIdx = nIdx
      }
    }
  }

  return bestIdx
}

/**
 * @param {Float32Array} workingElevation
 * @param {Int32Array} lakeIdByCell
 * @param {number} lakeId
 * @param {number} surfaceElev
 */
function applyLakeSurface(workingElevation, lakeIdByCell, lakeId, surfaceElev) {
  for (let idx = 0; idx < lakeIdByCell.length; idx += 1) {
    if (lakeIdByCell[idx] === lakeId) {
      workingElevation[idx] = surfaceElev
    }
  }
}
