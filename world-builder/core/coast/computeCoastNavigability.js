import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'

/**
 * Per-cell coast navigability raster (approach depth + shelter proxy) in [0, 1].
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @returns {Float32Array}
 */
export function computeCoastNavigability({ elevation, width, height, seaLevel = SEA_LEVEL }) {
  const cellCount = width * height
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const out = new Float32Array(cellCount)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (!ocean[idx]) {
        out[idx] = 0
        continue
      }

      const depth = Math.min(1, (seaLevel - elevation[idx]) / seaLevel)
      let landNeighbors = 0
      let sheltered = 0
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nIdx = ny * width + nx
        if (!ocean[nIdx]) {
          landNeighbors += 1
          if (elevation[nIdx] >= seaLevel + 0.08) sheltered += 1
        }
      }

      const shelterScore = landNeighbors > 0 ? sheltered / landNeighbors : 0
      out[idx] = clamp01(depth * 0.6 + shelterScore * 0.4)
    }
  }

  return out
}

/**
 * @param {number} value
 */
function clamp01(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
