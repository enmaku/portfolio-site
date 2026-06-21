import { SEA_LEVEL } from '../biomeIds.js'

/** Elevation forced on rim cells (deep ocean). */
export const RIM_ELEVATION = 0

/**
 * Low coastal land at or below sea level plus this margin may drain into the closed rim.
 * Highlands and snow caps must route inland to natural ocean instead of the map border.
 */
export const RIM_DRAIN_ELEVATION_MARGIN = 0.17

/**
 * Force border cells to ocean elevation for closed island rim topology.
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 */
export function applyClosedIslandRim(elevation, width, height) {
  for (let x = 0; x < width; x += 1) {
    elevation[x] = RIM_ELEVATION
    elevation[(height - 1) * width + x] = RIM_ELEVATION
  }
  for (let y = 0; y < height; y += 1) {
    elevation[y * width] = RIM_ELEVATION
    elevation[y * width + (width - 1)] = RIM_ELEVATION
  }
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} [seaLevel]
 * @returns {boolean[]}
 */
export function isOceanCell(elevation, width, height, seaLevel = SEA_LEVEL) {
  const ocean = new Array(width * height)
  for (let i = 0; i < elevation.length; i += 1) {
    ocean[i] = elevation[i] < seaLevel
  }
  for (let x = 0; x < width; x += 1) {
    ocean[x] = true
    ocean[(height - 1) * width + x] = true
  }
  for (let y = 0; y < height; y += 1) {
    ocean[y * width] = true
    ocean[y * width + (width - 1)] = true
  }
  return ocean
}

/**
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 */
export function isRimCell(idx, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  return x === 0 || y === 0 || x === width - 1 || y === height - 1
}

/**
 * @param {number} sourceElevation
 * @param {number} [seaLevel]
 */
export function canDrainIntoRimCell(sourceElevation, seaLevel = SEA_LEVEL) {
  return sourceElevation <= seaLevel + RIM_DRAIN_ELEVATION_MARGIN
}
