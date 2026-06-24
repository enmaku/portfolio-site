import { deriveFieldSeed, createSeededRandom } from '../noise/seededRandom.js'
import { SEA_LEVEL } from '../biomeIds.js'
import { isNodePlacementCellAllowed } from '../nodePlacementBounds.js'

const MIN_NODE_SPACING = 16
const MIN_CANDIDATE_SCORE = 0.35

/**
 * Place discrete metal mine nodes from local maxima on the metals raster.
 * @param {Object} params
 * @param {Float32Array} params.metalsRaster
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} [params.maxNodes]
 * @param {number} [params.seaLevel]
 * @returns {import('../types.js').MetalNode[]}
 */
export function placeMetalNodes({
  metalsRaster,
  elevation,
  width,
  height,
  geographySeed,
  maxNodes = 12,
  seaLevel = SEA_LEVEL,
}) {
  if (maxNodes <= 0) {
    return []
  }

  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'metal-nodes'))
  const candidates = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isNodePlacementCellAllowed(x, y, width, height)) continue
      const idx = y * width + x
      if (elevation[idx] < seaLevel) continue

      const score = metalsRaster[idx]
      if (score < MIN_CANDIDATE_SCORE) continue
      if (!isLocalMaximum(metalsRaster, x, y, width, height)) continue

      candidates.push({ x, y, score: score + random() * 0.01 })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const selected = []
  for (const candidate of candidates) {
    const tooClose = selected.some(
      (node) => Math.hypot(node.x - candidate.x, node.y - candidate.y) < MIN_NODE_SPACING,
    )
    if (tooClose) continue
    selected.push({
      id: `metal-${selected.length}`,
      x: candidate.x,
      y: candidate.y,
      score: candidate.score,
    })
    if (selected.length >= maxNodes) break
  }

  return selected
}

/**
 * @param {Float32Array} raster
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
function isLocalMaximum(raster, x, y, width, height) {
  const center = raster[y * width + x]
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (raster[ny * width + nx] > center) return false
    }
  }
  return true
}
