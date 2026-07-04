import { BIOMES, SEA_LEVEL } from '../biomeIds.js'

/** Fraction of settlement population placed at the pin (implementation tuning). */
export const POPULATION_COLLAPSE_CORE_FRACTION = 0.35

/**
 * Land cells only — no ocean, lakes, or open water biomes.
 *
 * @param {{
 *   x: number,
 *   y: number,
 *   gridWidth: number,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   biomes?: Uint8Array | null,
 *   seaLevel?: number,
 * }} params
 * @returns {boolean}
 */
export function isHabitablePopulationCell(params) {
  const {
    x,
    y,
    gridWidth,
    elevation,
    lakeMask,
    biomes,
    seaLevel = SEA_LEVEL,
  } = params
  const index = y * gridWidth + x
  if (lakeMask?.[index]) {
    return false
  }
  const biome = biomes?.[index]
  if (biome === BIOMES.OCEAN || biome === BIOMES.FRESHWATER_LAKE) {
    return false
  }
  if (elevation && elevation[index] < seaLevel) {
    return false
  }
  return true
}

/**
 * Distribute settlement headcount as core (pin) + hinterland (arable-weighted) on
 * claimed **land** cells only.
 *
 * @param {{
 *   settlements: Array<{ id: string, x: number, y: number, population: number, status?: string }>,
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 *   arableRaster?: Float32Array | null,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   biomes?: Uint8Array | null,
 *   gridWidth: number,
 *   gridHeight: number,
 *   seaLevel?: number,
 * }} params
 * @returns {Float32Array}
 */
export function collapsePopulation(params) {
  const {
    settlements,
    primaryClaim,
    arableRaster,
    elevation,
    lakeMask,
    biomes,
    gridWidth,
    gridHeight,
    seaLevel = SEA_LEVEL,
  } = params
  const raster = new Float32Array(gridWidth * gridHeight)

  for (const settlement of settlements) {
    if (settlement.status === 'ruin' || settlement.population <= 0) {
      continue
    }

    const landCells = (primaryClaim[settlement.id] ?? []).filter((cell) =>
      isHabitablePopulationCell({
        x: cell.x,
        y: cell.y,
        gridWidth,
        elevation,
        lakeMask,
        biomes,
        seaLevel,
      }),
    )
    if (landCells.length === 0) {
      continue
    }

    const population = settlement.population
    const corePopulation = Math.min(
      population,
      Math.max(1, Math.floor(population * POPULATION_COLLAPSE_CORE_FRACTION)),
    )
    const hinterlandPopulation = population - corePopulation
    const pinIndex = settlement.y * gridWidth + settlement.x
    const pinIsLand = landCells.some(
      (cell) => cell.x === settlement.x && cell.y === settlement.y,
    )
    if (pinIsLand && pinIndex >= 0 && pinIndex < raster.length) {
      raster[pinIndex] += corePopulation
    } else {
      // Pin is not habitable (should not happen for founding landings); park core on first land cell.
      const fallback = landCells[0]
      raster[fallback.y * gridWidth + fallback.x] += corePopulation
    }

    if (hinterlandPopulation <= 0) {
      continue
    }

    const hinterlandCells = landCells.filter(
      (cell) => !(cell.x === settlement.x && cell.y === settlement.y),
    )
    if (hinterlandCells.length === 0) {
      const target = pinIsLand
        ? pinIndex
        : landCells[0].y * gridWidth + landCells[0].x
      raster[target] += hinterlandPopulation
      continue
    }

    const weighted = hinterlandCells
      .map((cell) => {
        const value = arableRaster?.[cell.y * gridWidth + cell.x] ?? 0
        return {
          cell,
          weight: Number.isFinite(value) && value > 0 ? value : 0,
        }
      })
      .filter((entry) => entry.weight > 0)

    if (weighted.length === 0) {
      // No arable hinterland — keep people at the pin rather than inventing rural density.
      const target = pinIsLand
        ? pinIndex
        : landCells[0].y * gridWidth + landCells[0].x
      raster[target] += hinterlandPopulation
      continue
    }

    const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0)
    let assigned = 0
    for (let i = 0; i < weighted.length; i += 1) {
      const { cell, weight } = weighted[i]
      const share =
        i === weighted.length - 1
          ? hinterlandPopulation - assigned
          : Math.floor((hinterlandPopulation * weight) / weightSum)
      assigned += share
      if (share > 0) {
        raster[cell.y * gridWidth + cell.x] += share
      }
    }
  }

  return raster
}

/**
 * Stable hash of collapse raster for determinism checks.
 *
 * @param {Float32Array} raster
 * @returns {string}
 */
export function hashPopulationCollapseRaster(raster) {
  let hash = 2166136261
  for (let i = 0; i < raster.length; i += 1) {
    const value = Math.round(raster[i] * 1000)
    hash ^= value
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}
