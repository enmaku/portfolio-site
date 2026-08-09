/** Effective surplus scale with no salt access on claimed cells (implementation tuning). */
export const MIN_SALT_SPOILAGE_MULTIPLIER = 0.35
/** How quickly claimed salt node scores restore surplus toward full (implementation tuning). */
export const SALT_ACCESS_SCALE = 0.4

/**
 * Salt spoilage tax on effective food surplus — not a population-ceiling min() leg.
 *
 * @param {ReadonlyArray<{ x: number, y: number }>} claimedCells
 * @param {ReadonlyArray<{ x: number, y: number, score?: number }> | null | undefined} saltNodes
 * @returns {number} multiplier in [MIN_SALT_SPOILAGE_MULTIPLIER, 1]
 */
export function saltSpoilageMultiplier(claimedCells, saltNodes) {
  if (!saltNodes?.length || claimedCells.length === 0) {
    return MIN_SALT_SPOILAGE_MULTIPLIER
  }

  const claimed = new Set(claimedCells.map((cell) => `${cell.x},${cell.y}`))
  let access = 0
  for (const node of saltNodes) {
    if (!claimed.has(`${node.x},${node.y}`)) continue
    const score = Number.isFinite(node.score) ? /** @type {number} */ (node.score) : 1
    if (score > 0) {
      access += score
    }
  }

  if (access <= 0) {
    return MIN_SALT_SPOILAGE_MULTIPLIER
  }

  return Math.min(1, MIN_SALT_SPOILAGE_MULTIPLIER + access * SALT_ACCESS_SCALE)
}

/**
 * Default salt spoilage resolver for colonization ticks.
 *
 * @param {object} _settlement
 * @param {ReadonlyArray<{ x: number, y: number }>} claimedCells
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {number}
 */
export function saltSpoilageMultiplierForSettlement(_settlement, claimedCells, worldDocument) {
  return saltSpoilageMultiplier(claimedCells, worldDocument.saltNodes)
}
