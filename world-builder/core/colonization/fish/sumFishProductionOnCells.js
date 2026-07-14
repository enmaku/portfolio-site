import { SEA_LEVEL } from '../../biomeIds.js'

/** Fish productivity for a land cell adjacent to ocean (implementation tuning). */
export const FISH_PRODUCTIVITY_OCEAN = 0.45
/** Fish productivity for a land cell adjacent to lake (implementation tuning). */
export const FISH_PRODUCTIVITY_LAKE = 0.3
/** Fish productivity for a land cell adjacent to river corridor (implementation tuning). */
export const FISH_PRODUCTIVITY_RIVER = 0.15

/**
 * Base hinterland collapse weight when a cell has fish access but little/no arable.
 * Kept below typical arable so farms still dominate scatter.
 */
export const FISH_COLLAPSE_WEIGHT = 0.2

const CARDINAL = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
])

/**
 * @param {{
 *   x: number,
 *   y: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   riverCorridorMask?: Uint8Array | null,
 *   seaLevel?: number,
 * }} params
 * @returns {number}
 */
export function fishProductivityForCell(params) {
  const {
    x,
    y,
    gridWidth,
    gridHeight,
    elevation,
    lakeMask,
    riverCorridorMask,
    seaLevel = SEA_LEVEL,
  } = params

  let best = 0
  for (const [dx, dy] of CARDINAL) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) {
      continue
    }
    const index = ny * gridWidth + nx
    const elev = elevation?.[index]
    if (Number.isFinite(elev) && elev < seaLevel) {
      best = Math.max(best, FISH_PRODUCTIVITY_OCEAN)
      continue
    }
    if (lakeMask?.[index]) {
      best = Math.max(best, FISH_PRODUCTIVITY_LAKE)
      continue
    }
    if (riverCorridorMask?.[index]) {
      best = Math.max(best, FISH_PRODUCTIVITY_RIVER)
    }
  }
  return best
}

/**
 * Sum shore-adjacency fish productivity on claimed land cells (O(claimed × 4)).
 *
 * @param {{
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   gridWidth: number,
 *   gridHeight: number,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   riverCorridorMask?: Uint8Array | null,
 *   seaLevel?: number,
 * }} params
 * @returns {number}
 */
export function sumFishProductionOnCells(params) {
  const {
    claimedCells,
    gridWidth,
    gridHeight,
    elevation,
    lakeMask,
    riverCorridorMask,
    seaLevel = SEA_LEVEL,
  } = params

  let sum = 0
  for (const cell of claimedCells) {
    sum += fishProductivityForCell({
      x: cell.x,
      y: cell.y,
      gridWidth,
      gridHeight,
      elevation,
      lakeMask,
      riverCorridorMask,
      seaLevel,
    })
  }
  return sum
}

/**
 * @param {number} arable
 * @param {number} fishProductivity
 * @returns {number}
 */
export function hinterlandFoodWeight(arable, fishProductivity) {
  const crop = Number.isFinite(arable) && arable > 0 ? arable : 0
  const fish = fishProductivity > 0 ? FISH_COLLAPSE_WEIGHT : 0
  return Math.max(crop, fish)
}
