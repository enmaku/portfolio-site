import { deriveFieldSeed, createSeededRandom } from '../noise/seededRandom.js'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { computeCoastalProximityOnLand } from '../coast/computeCoastalProximity.js'
import { isNodePlacementCellAllowed } from '../nodePlacementBounds.js'
import {
  REFERENCE_SALT_LAND_PROXIMITY_RADIUS,
  saltLandProximityRadiusForGrid,
  coastalProximityMaxDistanceForGrid,
  strategicResourceNodeSpacingForGrid,
} from '../resourcePlacementScaling.js'

/** Salt nodes must be within this many cells of a proper land biome at REFERENCE_GRID_SIZE. */
export const SALT_NODE_LAND_PROXIMITY_RADIUS = REFERENCE_SALT_LAND_PROXIMITY_RADIUS

/** Salt nodes must have at least this much land biome cover within the proximity disk. */
export const SALT_NODE_MIN_LAND_FRACTION = 0.15

const NON_LAND_BIOMES = new Set([
  BIOMES.OCEAN,
  BIOMES.RIVER_CORRIDOR,
  BIOMES.FRESHWATER_LAKE,
])

/**
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} biomes
 * @param {number} width
 * @param {number} height
 * @param {number} [radius]
 * @returns {{ landFraction: number, sampleCount: number }}
 */
export function measureLandBiomeFractionWithinRadius(
  x,
  y,
  biomes,
  width,
  height,
  radius = SALT_NODE_LAND_PROXIMITY_RADIUS,
) {
  let landCount = 0
  let sampleCount = 0

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.hypot(dx, dy) > radius) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      sampleCount += 1
      if (!NON_LAND_BIOMES.has(biomes[ny * width + nx])) {
        landCount += 1
      }
    }
  }

  return {
    landFraction: sampleCount === 0 ? 0 : landCount / sampleCount,
    sampleCount,
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} biomes
 * @param {number} width
 * @param {number} height
 * @param {number} [radius]
 * @param {number} [minLandFraction]
 */
export function saltNodeHasSubstantialLandProximity(
  x,
  y,
  biomes,
  width,
  height,
  radius = SALT_NODE_LAND_PROXIMITY_RADIUS,
  minLandFraction = SALT_NODE_MIN_LAND_FRACTION,
) {
  const { landFraction, sampleCount } = measureLandBiomeFractionWithinRadius(
    x,
    y,
    biomes,
    width,
    height,
    radius,
  )
  if (sampleCount === 0) {
    return false
  }
  return landFraction >= minLandFraction
}

/**
 * Place discrete salt node candidates from geographic signals.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.salinity
 * @param {Uint8Array} params.biomes
 * @param {import('../types.js').LakeRecord[]} params.lakes
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} [params.maxNodes]
 * @param {number} [params.seaLevel]
 * @returns {import('../types.js').SaltNode[]}
 */
export function placeSaltNodes({
  elevation,
  salinity,
  biomes,
  lakes,
  width,
  height,
  geographySeed,
  maxNodes = 12,
  seaLevel = SEA_LEVEL,
}) {
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'salt-nodes'))
  const landProximityRadius = saltLandProximityRadiusForGrid(width)
  const minNodeSpacing = strategicResourceNodeSpacingForGrid(width)
  const coastalProximity = computeCoastalProximityOnLand({
    elevation,
    width,
    height,
    seaLevel,
    maxDistance: coastalProximityMaxDistanceForGrid(width),
  })
  const endorheicLakeIds = new Set(lakes.filter((lake) => lake.endorheic).map((lake) => lake.id))
  const candidates = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isNodePlacementCellAllowed(x, y, width, height)) continue
      const idx = y * width + x
      if (elevation[idx] < seaLevel) continue

      let score = salinity[idx] * 0.5 + coastalProximity[idx] * 0.2
      if (elevation[idx] < seaLevel + 0.06) score += 0.15
      if (endorheicLakeIds.size > 0 && isNearEndorheicLake(x, y, lakes, width)) score += 0.2
      if (elevation[idx] >= 0.5 && elevation[idx] <= 0.62 && salinity[idx] > 0.15) {
        score += 0.1
      }

      if (score >= 0.35) {
        candidates.push({ x, y, score: score + random() * 0.01 })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const selected = []
  for (const candidate of candidates) {
    if (
      !saltNodeHasSubstantialLandProximity(
        candidate.x,
        candidate.y,
        biomes,
        width,
        height,
        landProximityRadius,
      )
    ) {
      continue
    }
    const tooClose = selected.some(
      (node) => Math.hypot(node.x - candidate.x, node.y - candidate.y) < minNodeSpacing,
    )
    if (tooClose) continue
    selected.push({
      id: `salt-${selected.length}`,
      x: candidate.x,
      y: candidate.y,
      score: candidate.score,
    })
    if (selected.length >= maxNodes) break
  }

  return selected
}

/**
 * @param {number} x
 * @param {number} y
 * @param {import('../types.js').LakeRecord[]} lakes
 * @param {number} width
 */
function isNearEndorheicLake(x, y, lakes, width) {
  for (const lake of lakes) {
    if (!lake.endorheic || lake.spillX === undefined || lake.spillY === undefined) continue
    if (Math.hypot(x - lake.spillX, y - lake.spillY) < width * 0.05) return true
  }
  return false
}
