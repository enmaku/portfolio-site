import { BIOMES } from '../biomeIds.js'
import { computeRiverNetworkMaxChannelWidth } from '../hydrology/riverCorridorDisplay.js'
import { deriveFieldSeed, createSeededRandom } from '../noise/seededRandom.js'

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.temperature
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} params.drainage
 * @param {Uint8Array} params.biomes
 * @param {Uint8Array | null | undefined} params.riverCorridorMask
 * @param {Uint8Array | null | undefined} params.riverNetworkMask
 * @param {Float32Array | null | undefined} params.channelWidth
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} params.seaLevel
 * @returns {Float32Array}
 */
export function generateArableRaster({
  elevation,
  temperature,
  rainfall,
  drainage,
  biomes,
  riverCorridorMask,
  riverNetworkMask,
  channelWidth,
  width,
  height,
  geographySeed,
  seaLevel,
}) {
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'arable-raster'))
  const raster = new Float32Array(width * height)
  const maxChannelWidth =
    channelWidth && riverNetworkMask
      ? computeRiverNetworkMaxChannelWidth(channelWidth, riverNetworkMask)
      : 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (elevation[idx] < seaLevel) {
        raster[idx] = 0
        continue
      }

      let score = biomeArableWeight(biomes[idx])
      const moisture = rainfall[idx] * 0.65 + (1 - drainage[idx]) * 0.35
      score += moisture * 0.25
      score += temperateBand(temperature[idx]) * 0.15

      const slope = localSlope(elevation, x, y, width, height)
      const gentle = Math.max(0, 1 - slope * 10)
      score *= 0.35 + gentle * 0.65

      score += riverAdjacencyBonus({
        idx,
        x,
        y,
        width,
        height,
        drainage: drainage[idx],
        riverCorridorMask,
        channelWidth,
        maxChannelWidth,
      })

      score += (random() - 0.5) * 0.02
      raster[idx] = clamp01(score)
    }
  }

  return raster
}

/**
 * @param {number} biomeId
 */
function biomeArableWeight(biomeId) {
  switch (biomeId) {
    case BIOMES.GRASSLAND:
    case BIOMES.TEMPERATE_FOREST:
    case BIOMES.RIVER_CORRIDOR:
      return 0.55
    case BIOMES.SWAMP:
      return 0.35
    case BIOMES.SAVANNA:
    case BIOMES.TAIGA:
      return 0.28
    case BIOMES.SCRUBLAND:
    case BIOMES.HILLS:
      return 0.18
    case BIOMES.DESERT:
    case BIOMES.MOUNTAIN:
    case BIOMES.GLACIER:
    case BIOMES.TUNDRA:
      return 0.05
    default:
      return 0
  }
}

/**
 * @param {number} temperature
 */
function temperateBand(temperature) {
  return Math.max(0, 1 - Math.abs(temperature - 0.5) * 2.2)
}

/**
 * @param {Float32Array} elevation
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
function localSlope(elevation, x, y, width, height) {
  const idx = y * width + x
  const center = elevation[idx]
  let maxDelta = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const delta = Math.abs(elevation[ny * width + nx] - center)
      if (delta > maxDelta) maxDelta = delta
    }
  }
  return maxDelta
}

/**
 * @param {Object} params
 * @param {number} params.idx
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.drainage
 * @param {Uint8Array | null | undefined} params.riverCorridorMask
 * @param {Float32Array | null | undefined} params.channelWidth
 * @param {number} params.maxChannelWidth
 */
function riverAdjacencyBonus({
  idx,
  x,
  y,
  width,
  height,
  drainage,
  riverCorridorMask,
  channelWidth,
  maxChannelWidth,
}) {
  let bonus = 0
  const proximity = riverCorridorMask
    ? riverCorridorMask[idx]
      ? 1
      : riverProximity(riverCorridorMask, x, y, width, height, 3)
    : 0

  if (proximity > 0) {
    bonus += proximity >= 1 ? 0.22 : proximity * 0.12
  }

  if (maxChannelWidth > 0 && channelWidth && channelWidth[idx] > 0) {
    bonus += (channelWidth[idx] / maxChannelWidth) * 0.06
  } else if (proximity > 0 && drainage > 0.1) {
    bonus += Math.min(drainage, 1) * 0.04
  }

  return bonus
}

/**
 * @param {Uint8Array} riverCorridorMask
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 */
function riverProximity(riverCorridorMask, x, y, width, height, radius) {
  let nearest = radius + 1
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (!riverCorridorMask[ny * width + nx]) continue
      const distance = Math.hypot(dx, dy)
      if (distance < nearest) nearest = distance
    }
  }
  if (nearest > radius) return 0
  return 1 - nearest / (radius + 1)
}

/**
 * @param {number} value
 */
function clamp01(value) {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}
