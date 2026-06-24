import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from './applyClosedIslandRim.js'
import { computeLandCoastDistance } from './elevationPriors.js'
import { prevailingWindUpwindVector } from './prevailingWindField.js'

/**
 * Upwind land fetch over which maritime moisture decays to 1/e, as a fraction of grid width.
 */
const ADVECTION_DECAY_FRACTION = 0.06

/**
 * Distance to the nearest coast (any direction) over which continental dryness decays to 1/e,
 * as a fraction of grid width. Keeps far interiors dry even on the windward side.
 */
const CONTINENTAL_DECAY_FRACTION = 0.18

/** Maximum upwind march before a cell is treated as fully continental, as a fraction of grid width. */
const MAX_FETCH_FRACTION = 0.5

function clamp01(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Per-cell ocean moisture potential in [0, 1]. High where a short upwind ray reaches
 * the sea (maritime exposure) and low deep inland; rotating the wind moves which coast
 * receives the moisture.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.prevailingWindDegrees
 * @param {number} [params.seaLevel]
 * @returns {Float32Array}
 */
export function computeMoistureAdvection({
  elevation,
  width,
  height,
  prevailingWindDegrees,
  seaLevel = SEA_LEVEL,
}) {
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const coastDistance = computeLandCoastDistance(elevation, width, height, seaLevel)
  const { upwindX, upwindY } = prevailingWindUpwindVector(prevailingWindDegrees)

  const maxFetchCells = Math.max(8, Math.round(width * MAX_FETCH_FRACTION))
  const advectionDecayCells = Math.max(4, width * ADVECTION_DECAY_FRACTION)
  const continentalDecayCells = Math.max(8, width * CONTINENTAL_DECAY_FRACTION)

  const advection = new Float32Array(width * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (ocean[idx]) {
        advection[idx] = 1
        continue
      }

      let landCrossed = 0
      let reachedOcean = false
      for (let step = 1; step <= maxFetchCells; step += 1) {
        const sampleX = Math.round(x + upwindX * step)
        const sampleY = Math.round(y + upwindY * step)
        if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
          reachedOcean = true
          break
        }
        if (ocean[sampleY * width + sampleX]) {
          reachedOcean = true
          break
        }
        landCrossed += 1
      }

      const fetchMoisture = reachedOcean
        ? Math.exp(-landCrossed / advectionDecayCells)
        : Math.exp(-maxFetchCells / advectionDecayCells)
      const continental = Math.exp(-coastDistance[idx] / continentalDecayCells)
      advection[idx] = clamp01(fetchMoisture * continental)
    }
  }

  return advection
}
