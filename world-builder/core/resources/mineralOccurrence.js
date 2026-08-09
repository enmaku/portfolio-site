/**
 * Typed mineral deposit occurrence: kinds and relative-mix weighting.
 * Domain: world-builder/CONTEXT.md — mineral deposit, mineral occurrence controls.
 */

/** @typedef {'copper' | 'silver' | 'gold' | 'diamond'} MineralKind */

/** @type {ReadonlyArray<MineralKind>} */
export const MINERAL_KINDS = Object.freeze(['copper', 'silver', 'gold', 'diamond'])

/**
 * Relative occurrence weights that preserve inverse 100:10:1 copper/silver/gold
 * rarity; diamonds disabled by default so the economy is not flooded with gems.
 * @type {Readonly<Record<MineralKind, number>>}
 */
export const DEFAULT_MINERAL_OCCURRENCE_WEIGHTS = Object.freeze({
  copper: 100,
  silver: 10,
  gold: 1,
  diamond: 0,
})

/**
 * @param {Partial<Record<MineralKind, number>> | null | undefined} partial
 * @returns {Record<MineralKind, number>}
 */
export function resolveMineralOccurrenceWeights(partial) {
  const resolved = { ...DEFAULT_MINERAL_OCCURRENCE_WEIGHTS }
  if (partial) {
    for (const kind of MINERAL_KINDS) {
      const value = partial[kind]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        resolved[kind] = value
      }
    }
  }
  return resolved
}

/**
 * Map a unit-interval draw to a mineral kind by relative weight. Zero-weight
 * kinds never appear; an all-zero mix falls back to copper.
 * @param {number} unitInterval 0..1 seeded draw
 * @param {Record<MineralKind, number>} weights
 * @returns {MineralKind}
 */
export function pickMineralKind(unitInterval, weights) {
  let total = 0
  for (const kind of MINERAL_KINDS) {
    total += Math.max(0, weights[kind] ?? 0)
  }
  if (total <= 0) {
    return 'copper'
  }
  let threshold = unitInterval * total
  for (const kind of MINERAL_KINDS) {
    threshold -= Math.max(0, weights[kind] ?? 0)
    if (threshold < 0) {
      return kind
    }
  }
  return 'copper'
}
