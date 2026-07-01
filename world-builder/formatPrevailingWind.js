/** @type {ReadonlyArray<string>} */
export const CARDINAL_WIND_DIRECTIONS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

/**
 * Meteorological bearing (0 = north, 90 = east) to 16-point compass label.
 * @param {number} degrees
 * @returns {string}
 */
export function formatCardinalWindDirection(degrees) {
  const normalized = normalizeWindDegreesForDisplay(degrees)
  const index = Math.round(normalized / 22.5) % CARDINAL_WIND_DIRECTIONS.length
  return CARDINAL_WIND_DIRECTIONS[index]
}

/**
 * @param {number} degrees
 * @returns {string}
 */
export function formatPrevailingWindDisplay(degrees) {
  const normalized = normalizeWindDegreesForDisplay(degrees)
  return `${normalized}° ${formatCardinalWindDirection(normalized)}`
}

/**
 * @param {number} degrees
 * @returns {number}
 */
export function normalizeWindDegreesForDisplay(degrees) {
  const rounded = Math.round(degrees)
  return ((rounded % 360) + 360) % 360
}
