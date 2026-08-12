import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { applyOrographicMoisture } from './applyOrographicMoisture.js'
import { buildWindRoseSchedule } from './buildWindRoseSchedule.js'
import { computeMoistureAdvection } from './computeMoistureAdvection.js'
import { normalizeWindDegrees } from './prevailingWindField.js'
import { scaleForGridSize } from '../types.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'
import { isOceanCell } from './applyClosedIslandRim.js'
import { computeLandCoastDistance } from '../grid/gridTopology.js'

/** @type {Map<string, Float32Array>} */
const rainfallBaseCache = new Map()

/**
 * @param {number} geographySeed
 * @param {number} width
 * @param {number} height
 * @param {number} frequency
 * @param {number} persistence
 * @param {number} seed
 * @returns {Float32Array}
 */
function getRainfallFbmBase(geographySeed, width, height, frequency, persistence, seed) {
  const key = `${geographySeed}|${width}x${height}|${frequency}|${persistence}|${seed}`
  const cached = rainfallBaseCache.get(key)
  if (cached) {
    return cached
  }
  const base = generateFbm2d({
    width,
    height,
    seed,
    octaves: 5,
    frequency,
    persistence,
  })
  rainfallBaseCache.set(key, base)
  return base
}

/** Clear FBM rainfall base cache (tests). */
export function clearRainfallFbmBaseCache() {
  rainfallBaseCache.clear()
}

/**
 * @param {Object} params
 * @param {Float32Array} params.base
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.transportBearingDegrees
 * @param {number} params.advectionStrength
 * @param {number} params.rainShadowStrength
 * @param {number} params.seaLevel
 * @param {boolean[]} params.ocean
 * @param {Float32Array | Int16Array | Uint16Array | number[]} params.coastDistance
 * @returns {Float32Array}
 */
function rainfallForBearing({
  base,
  elevation,
  width,
  height,
  transportBearingDegrees,
  advectionStrength,
  rainShadowStrength,
  seaLevel,
  ocean,
  coastDistance,
}) {
  const blended = new Float32Array(base.length)
  if (advectionStrength > 0) {
    const advection = computeMoistureAdvection({
      elevation,
      width,
      height,
      transportBearingDegrees,
      seaLevel,
      ocean,
      coastDistance,
    })
    for (let i = 0; i < base.length; i += 1) {
      const multiplier = 1 + advectionStrength * (advection[i] * 2 - 1)
      blended[i] = Math.min(1, Math.max(0, base[i] * multiplier))
    }
  } else {
    blended.set(base)
  }

  return applyOrographicMoisture({
    rainfall: blended,
    elevation,
    width,
    height,
    transportBearingDegrees,
    rainShadowStrength,
  })
}

/**
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {Float32Array} params.elevation
 * @param {number} params.prevailingWindDegrees
 * @param {number} params.secondaryMaximumDegrees
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @param {(progress: number) => void} [params.onProgress] 0..1 across wind-rose lobes
 * @param {(payload: { lobeIndex: number, lobeCount: number, rainfall: Float32Array }) => void | Promise<void>} [params.onLobe]
 * @param {() => void | Promise<void>} [params.yield] cooperative yield after each lobe
 * @returns {Float32Array | Promise<Float32Array>}
 */
export function generateRainfall(params) {
  if (typeof params.yield === 'function' || typeof params.onLobe === 'function') {
    return generateRainfallAsync(params)
  }
  return generateRainfallSync(params)
}

/**
 * @param {Object} params
 * @returns {Float32Array}
 */
function generateRainfallSync(params) {
  const {
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    options,
    onProgress,
  } = params
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'rainfall')
  const frequency = scaleForGridSize(0.014 * resolved.rainfallFrequencyScale, width)
  const persistence = 0.5
  const base = getRainfallFbmBase(geographySeed, width, height, frequency, persistence, seed)

  const prevailing = normalizeWindDegrees(prevailingWindDegrees)
  const secondary = normalizeWindDegrees(secondaryMaximumDegrees)

  const { lobes } = buildWindRoseSchedule({
    geographySeed,
    prevailingWindDegrees: prevailing,
    secondaryMaximumDegrees: secondary,
  })

  const advectionStrength = resolved.moistureAdvectionStrength
  const rainShadowStrength = resolved.rainShadowStrength
  const seaLevel = resolved.seaLevel
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const coastDistance = computeLandCoastDistance(elevation, width, height, seaLevel)
  const accumulated = new Float32Array(base.length)
  const lobeCount = lobes.length

  for (let lobeIndex = 0; lobeIndex < lobeCount; lobeIndex += 1) {
    const lobe = lobes[lobeIndex]
    const sample = rainfallForBearing({
      base,
      elevation,
      width,
      height,
      transportBearingDegrees: lobe.bearing,
      advectionStrength,
      rainShadowStrength,
      seaLevel,
      ocean,
      coastDistance,
    })
    for (let i = 0; i < accumulated.length; i += 1) {
      accumulated[i] += lobe.weight * sample[i]
    }
    onProgress?.((lobeIndex + 1) / lobeCount)
  }

  if (resolved.rainfallAmountScale === 1) {
    return accumulated
  }

  const scaled = new Float32Array(accumulated.length)
  for (let i = 0; i < accumulated.length; i += 1) {
    scaled[i] = Math.min(1, Math.max(0, accumulated[i] * resolved.rainfallAmountScale))
  }
  return scaled
}

/**
 * @param {Object} params
 * @returns {Promise<Float32Array>}
 */
async function generateRainfallAsync(params) {
  const {
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    options,
    onProgress,
    onLobe,
    yield: yieldFn,
  } = params
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'rainfall')
  const frequency = scaleForGridSize(0.014 * resolved.rainfallFrequencyScale, width)
  const persistence = 0.5
  const base = getRainfallFbmBase(geographySeed, width, height, frequency, persistence, seed)

  const prevailing = normalizeWindDegrees(prevailingWindDegrees)
  const secondary = normalizeWindDegrees(secondaryMaximumDegrees)

  const { lobes } = buildWindRoseSchedule({
    geographySeed,
    prevailingWindDegrees: prevailing,
    secondaryMaximumDegrees: secondary,
  })

  const advectionStrength = resolved.moistureAdvectionStrength
  const rainShadowStrength = resolved.rainShadowStrength
  const seaLevel = resolved.seaLevel
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const coastDistance = computeLandCoastDistance(elevation, width, height, seaLevel)
  const accumulated = new Float32Array(base.length)
  const lobeCount = lobes.length
  const amountScale = resolved.rainfallAmountScale

  for (let lobeIndex = 0; lobeIndex < lobeCount; lobeIndex += 1) {
    const lobe = lobes[lobeIndex]
    const sample = rainfallForBearing({
      base,
      elevation,
      width,
      height,
      transportBearingDegrees: lobe.bearing,
      advectionStrength,
      rainShadowStrength,
      seaLevel,
      ocean,
      coastDistance,
    })
    for (let i = 0; i < accumulated.length; i += 1) {
      accumulated[i] += lobe.weight * sample[i]
    }
    onProgress?.((lobeIndex + 1) / lobeCount)
    if (onLobe) {
      let rainfallForPreview = accumulated
      if (amountScale !== 1) {
        rainfallForPreview = new Float32Array(accumulated.length)
        for (let i = 0; i < accumulated.length; i += 1) {
          rainfallForPreview[i] = Math.min(1, Math.max(0, accumulated[i] * amountScale))
        }
      }
      await onLobe({
        lobeIndex,
        lobeCount,
        rainfall: rainfallForPreview,
      })
    }
    await yieldFn?.()
  }

  if (amountScale === 1) {
    return accumulated
  }

  const scaled = new Float32Array(accumulated.length)
  for (let i = 0; i < accumulated.length; i += 1) {
    scaled[i] = Math.min(1, Math.max(0, accumulated[i] * amountScale))
  }
  return scaled
}
