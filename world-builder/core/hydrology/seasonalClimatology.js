import { deriveFieldSeed, createSeededRandom } from '../noise/seededRandom.js'
import {
  computeCellRunoff,
  RUNOFF_TO_FLOW_UNITS,
} from './computeCellRunoff.js'

/** @typedef {'dry' | 'wet' | 'cold' | 'melt'} SeasonId */

/** @type {ReadonlyArray<SeasonId>} */
export const SEASON_ORDER = ['dry', 'wet', 'cold', 'melt']

const COLD_RAIN_MULT = 0.02
const SEASON_RAIN_WEIGHT = {
  dry: 0.25,
  wet: 0.25,
  cold: 0.25,
  melt: 0.25,
}

/**
 * @param {number} geographySeed
 * @param {number} yearIndex
 * @param {number} [noiseScale]
 * @returns {number}
 */
export function deriveYearlyClimateNoise(geographySeed, yearIndex, noiseScale = 0.3) {
  const seed = deriveFieldSeed(geographySeed, `climate-year-${yearIndex}`)
  const rand = createSeededRandom(seed)
  const centered = rand() * 2 - 1
  return 1 + centered * noiseScale
}

/**
 * @param {SeasonId} season
 * @param {import('../types.js').WorldGenerationOptions} options
 * @param {number} yearMult
 * @returns {number}
 */
export function seasonRainfallMultiplier(season, options, yearMult) {
  switch (season) {
    case 'dry':
      return options.dryRainMult
    case 'wet':
      return options.wetRainMult * yearMult
    case 'cold':
      return COLD_RAIN_MULT
    case 'melt':
      return options.dryRainMult
    default:
      return 1
  }
}

/**
 * @param {Object} params
 * @param {Float32Array} params.baseRainfall
 * @param {Float32Array} [params.meltContribution]
 * @param {Float32Array} [params.soilDrainage]
 * @param {number} [params.soilDrainageScale]
 * @param {boolean[]} [params.ocean]
 * @param {SeasonId} params.season
 * @param {import('../types.js').WorldGenerationOptions} params.options
 * @param {number} params.yearMult
 * @returns {Float32Array}
 */
export function computeSeasonalRunoff({
  baseRainfall,
  meltContribution,
  soilDrainage,
  soilDrainageScale = 1,
  ocean,
  season,
  options,
  yearMult,
}) {
  const rainMult = seasonRainfallMultiplier(season, options, yearMult)
  const adjustedRain = new Float32Array(baseRainfall.length)
  for (let i = 0; i < baseRainfall.length; i += 1) {
    adjustedRain[i] = Math.min(1, Math.max(0, baseRainfall[i] * rainMult))
  }

  let melt = meltContribution
  if (season === 'melt' && meltContribution) {
    const scaledMelt = new Float32Array(meltContribution.length)
    for (let i = 0; i < meltContribution.length; i += 1) {
      scaledMelt[i] = meltContribution[i] * options.meltReleaseScale * yearMult
    }
    melt = scaledMelt
  } else if (season !== 'melt') {
    melt = undefined
  }

  return computeCellRunoff({
    rainfall: adjustedRain,
    meltContribution: melt,
    soilDrainage,
    soilDrainageScale,
    ocean,
  })
}

/**
 * Snow pack increment on snow-cap cells during the cold season.
 * @param {Object} params
 * @param {Float32Array} params.baseRainfall
 * @param {Uint8Array} params.snowCapMask
 * @param {boolean[]} [params.ocean]
 * @param {import('../types.js').WorldGenerationOptions} params.options
 * @param {number} params.yearMult
 * @returns {Float32Array}
 */
export function computeSeasonalSnowAccum({
  baseRainfall,
  snowCapMask,
  ocean,
  options,
  yearMult,
}) {
  const accum = new Float32Array(baseRainfall.length)
  const rate = options.snowAccumRate * yearMult * RUNOFF_TO_FLOW_UNITS * 0.08
  for (let i = 0; i < accum.length; i += 1) {
    if (ocean?.[i] || !snowCapMask[i]) continue
    accum[i] = baseRainfall[i] * rate
  }
  return accum
}

/**
 * Annual-mean rainfall and temperature for biome classification.
 * @param {Object} params
 * @param {Float32Array} params.baseRainfall
 * @param {Float32Array} params.baseTemperature
 * @param {import('../types.js').WorldGenerationOptions} params.options
 * @returns {{ rainfall: Float32Array, temperature: Float32Array }}
 */
export function deriveAnnualMeanClimate({ baseRainfall, baseTemperature, options }) {
  const rainfall = new Float32Array(baseRainfall.length)
  const temperature = new Float32Array(baseTemperature.length)

  for (const season of SEASON_ORDER) {
    const rainMult = seasonRainfallMultiplier(season, options, 1)
    const weight = SEASON_RAIN_WEIGHT[season]
    for (let i = 0; i < rainfall.length; i += 1) {
      rainfall[i] += Math.min(1, Math.max(0, baseRainfall[i] * rainMult)) * weight
      if (season === 'cold') {
        temperature[i] += baseTemperature[i] * weight * 0.85
      } else if (season === 'melt') {
        temperature[i] += baseTemperature[i] * weight * 1.05
      } else {
        temperature[i] += baseTemperature[i] * weight
      }
    }
  }

  return { rainfall, temperature }
}

/**
 * Merge seasonal runoff into running peak effective runoff field.
 * @param {Float32Array} effectiveRunoff
 * @param {Float32Array} seasonalRunoff
 * @param {SeasonId} season
 */
export function accumulateEffectiveRunoff(effectiveRunoff, seasonalRunoff, season) {
  if (season !== 'wet' && season !== 'melt') return
  for (let i = 0; i < effectiveRunoff.length; i += 1) {
    if (seasonalRunoff[i] > effectiveRunoff[i]) {
      effectiveRunoff[i] = seasonalRunoff[i]
    }
  }
}
