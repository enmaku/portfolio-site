import { derivePrevailingWindFromSeed } from './core/derivePrevailingWindFromSeed.js'

/**
 * @returns {number}
 */
export function createRandomGeographySeed() {
  return (Math.random() * 4294967296) | 0
}

/**
 * @param {number} geographySeed
 * @returns {{ geographySeed: number, prevailingWindDegrees: number }}
 */
export function createControlsStateForSeed(geographySeed) {
  const normalizedSeed = geographySeed | 0
  return {
    geographySeed: normalizedSeed >= 0 ? normalizedSeed : normalizedSeed + 4294967296,
    prevailingWindDegrees: derivePrevailingWindFromSeed(normalizedSeed),
  }
}

/**
 * @param {number | string} rawSeed
 * @returns {number | null}
 */
export function parseGeographySeedInput(rawSeed) {
  const parsed = Number.parseInt(String(rawSeed), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed | 0
}

/**
 * @param {number} degrees
 * @returns {number}
 */
export function normalizeWindDegrees(degrees) {
  const rounded = Math.round(degrees)
  return ((rounded % 360) + 360) % 360
}
