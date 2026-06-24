import { prevailingWindUpwindVector } from '../fields/prevailingWindField.js'

const D8_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/** Upwind cap depth that maps to a full leeward deposition bonus. */
const DEPOSITION_REFERENCE = 4

/** Extra accumulation fraction on fully sheltered (leeward) cap cells. */
const LEEWARD_DEPOSITION_BONUS = 0.6

/** Accumulation fraction stripped from exposed (windward) cap edges by scour. */
const WINDWARD_SCOUR_PENALTY = 0.4

const ACCUM_FACTOR_FLOOR = 0.5
const ACCUM_FACTOR_CEIL = 1.8

/**
 * Upwind snow-cap mass proxy: leeward cap cells have more cap area upwind and so
 * receive deeper wind-blown snow. Shared by the legacy melt path and seasonal accum.
 * @param {Uint8Array} snowCapMask
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} upwindX
 * @param {number} upwindY
 * @returns {number}
 */
export function scoreUpwindSnowDeposition(snowCapMask, width, height, x, y, upwindX, upwindY) {
  const sampleSteps = Math.max(2, Math.round(width / 64))
  const stepSize = Math.max(1, Math.round(width / 256))
  let deposition = 0

  for (let step = 1; step <= sampleSteps; step += 1) {
    const sampleX = Math.round(x + upwindX * step * stepSize)
    const sampleY = Math.round(y + upwindY * step * stepSize)
    if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) continue
    if (!snowCapMask[sampleY * width + sampleX]) continue
    deposition += 1 + step * 0.2
  }

  return deposition
}

/**
 * @param {Uint8Array} snowCapMask
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} upwindX
 * @param {number} upwindY
 * @returns {boolean}
 */
function isWindwardEdgeCell(snowCapMask, width, height, x, y, upwindX, upwindY) {
  const ux = Math.round(x + upwindX)
  const uy = Math.round(y + upwindY)
  if (ux < 0 || uy < 0 || ux >= width || uy >= height) return true
  return !snowCapMask[uy * width + ux]
}

/**
 * Per-cell snow accumulation multiplier from prevailing wind. Leeward cap cells
 * (sheltered, with cap mass upwind) gather more snow; windward edges are scoured.
 * @param {Object} params
 * @param {Uint8Array} params.snowCapMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.prevailingWindDegrees
 * @returns {Float32Array}
 */
export function computeSnowWindAccumFactor({
  snowCapMask,
  width,
  height,
  prevailingWindDegrees,
}) {
  const factor = new Float32Array(width * height).fill(1)
  const { upwindX, upwindY } = prevailingWindUpwindVector(prevailingWindDegrees)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (!snowCapMask[idx]) continue

      const deposition = scoreUpwindSnowDeposition(snowCapMask, width, height, x, y, upwindX, upwindY)
      const depositionNorm = Math.min(1, deposition / DEPOSITION_REFERENCE)
      const windward = isWindwardEdgeCell(snowCapMask, width, height, x, y, upwindX, upwindY)

      let value = 1 + LEEWARD_DEPOSITION_BONUS * depositionNorm
      if (windward) value -= WINDWARD_SCOUR_PENALTY
      if (value < ACCUM_FACTOR_FLOOR) value = ACCUM_FACTOR_FLOOR
      if (value > ACCUM_FACTOR_CEIL) value = ACCUM_FACTOR_CEIL
      factor[idx] = value
    }
  }

  return factor
}

/**
 * Steepest-descent non-cap neighbor a cap cell drains into during melt; falls
 * back to the cell itself when fully enclosed by cap.
 * @param {Float32Array} elevation
 * @param {Uint8Array} snowCapMask
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function snowMeltOutletCell(elevation, snowCapMask, width, height, x, y) {
  const idx = y * width + x
  let bestIdx = idx
  let bestDrop = 0

  for (let d = 0; d < D8_OFFSETS.length; d += 1) {
    const nx = x + D8_OFFSETS[d][0]
    const ny = y + D8_OFFSETS[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    const nIdx = ny * width + nx
    if (snowCapMask[nIdx]) continue
    const drop = elevation[idx] - elevation[nIdx]
    if (drop > bestDrop) {
      bestDrop = drop
      bestIdx = nIdx
    }
  }

  return bestIdx
}
