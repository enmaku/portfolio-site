/**
 * Default prevailing wind bearing (0–359°) from geography seed.
 * @param {number} geographySeed
 * @returns {number}
 */
export function derivePrevailingWindFromSeed(geographySeed) {
  const mixed = Math.imul(geographySeed | 0, 2654435761) ^ 0x9e3779b9
  return ((mixed % 360) + 360) % 360
}
