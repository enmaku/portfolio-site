import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'
import {
  fishProductivityForCell,
  hinterlandFoodWeight,
} from './fish/sumFishProductionOnCells.js'

/** Share of settlement population in the urban cluster (implementation tuning). */
export const POPULATION_COLLAPSE_CORE_FRACTION = 0.8

/** Pin weight vs Moore neighbors when splitting the urban cluster. */
const URBAN_PIN_WEIGHT = 4
const URBAN_NEIGHBOR_WEIGHT = 1

/** Distance decay length (cells) for rural sampling. */
const HINTERLAND_DECAY_CELLS = 8

/** Yield to UI after this many hinterland people placed (async path only). */
export const COLLAPSE_HINTERLAND_YIELD_INTERVAL = 512

/**
 * @typedef {Object} CollapsePopulationParams
 * @property {Array<{ id: string, x: number, y: number, population: number, status?: string }>} settlements
 * @property {Record<string, Array<{ x: number, y: number }>>} primaryClaim
 * @property {Float32Array | null | undefined} arableRaster
 * @property {Float32Array | null | undefined} elevation
 * @property {Uint8Array | null | undefined} lakeMask
 * @property {Uint8Array | null | undefined} riverCorridorMask
 * @property {Uint8Array | null | undefined} simulationRiverMask
 * @property {Uint8Array | null | undefined} biomes
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {number} [seaLevel]
 * @property {number} [geographySeed]
 * @property {number} [epoch]
 */

/**
 * @typedef {Object} SettlementCollapseWork
 * @property {number} corePopulation
 * @property {number} hinterlandPopulation
 * @property {Array<{ cell: { x: number, y: number }, weight: number }>} urbanWeighted
 * @property {Array<{ cell: { x: number, y: number }, weight: number }>} hinterlandWeighted
 * @property {(() => number) | null} random
 */

/**
 * @typedef {Object} CollapsePopulationHooks
 * @property {(payload: { substepIndex: number, substepId: string, type: 'substep-start' | 'substep-complete' }) => void} [onCollapseSubstep]
 */

/**
 * Land cells only — fail-closed when elevation is missing.
 *
 * @param {{
 *   x: number,
 *   y: number,
 *   gridWidth: number,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   riverCorridorMask?: Uint8Array | null,
 *   simulationRiverMask?: Uint8Array | null,
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
    riverCorridorMask,
    simulationRiverMask,
    biomes,
    seaLevel = SEA_LEVEL,
  } = params
  const index = y * gridWidth + x

  if (!elevation || index < 0 || index >= elevation.length) {
    return false
  }
  if (elevation[index] < seaLevel) {
    return false
  }
  if (lakeMask?.[index]) {
    return false
  }
  if (riverCorridorMask?.[index] || simulationRiverMask?.[index]) {
    return false
  }
  const biome = biomes?.[index]
  if (biome === BIOMES.OCEAN || biome === BIOMES.FRESHWATER_LAKE) {
    return false
  }
  return true
}

/**
 * @param {{ x: number, y: number }} cell
 * @param {number} gridWidth
 * @returns {number}
 */
function cellIndex(cell, gridWidth) {
  return cell.y * gridWidth + cell.x
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
function euclideanDistance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * @param {number} distance
 * @returns {number}
 */
function distanceDecay(distance) {
  return Math.exp(-distance / HINTERLAND_DECAY_CELLS)
}

/**
 * @param {Array<{ cell: { x: number, y: number }, weight: number }>} weighted
 * @param {() => number} random
 * @returns {{ x: number, y: number } | null}
 */
function sampleWeightedCell(weighted, random) {
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) {
    return null
  }
  let roll = random() * total
  for (const entry of weighted) {
    roll -= entry.weight
    if (roll <= 0) {
      return entry.cell
    }
  }
  return weighted[weighted.length - 1]?.cell ?? null
}

/**
 * @param {Float32Array} raster
 * @param {number} index
 * @param {number} amount
 */
function addPeople(raster, index, amount) {
  if (amount > 0 && index >= 0 && index < raster.length) {
    raster[index] += amount
  }
}

/**
 * Split an integer count across weighted cells (deterministic, no RNG).
 *
 * @param {number} count
 * @param {Array<{ cell: { x: number, y: number }, weight: number }>} weighted
 * @param {Float32Array} raster
 * @param {number} gridWidth
 */
function distributeIntegerByWeight(count, weighted, raster, gridWidth) {
  if (count <= 0 || weighted.length === 0) {
    return
  }
  const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  if (weightSum <= 0) {
    addPeople(raster, cellIndex(weighted[0].cell, gridWidth), count)
    return
  }
  let assigned = 0
  for (let i = 0; i < weighted.length; i += 1) {
    const { cell, weight } = weighted[i]
    const share =
      i === weighted.length - 1
        ? count - assigned
        : Math.floor((count * weight) / weightSum)
    assigned += share
    addPeople(raster, cellIndex(cell, gridWidth), share)
  }
}

/**
 * @param {CollapsePopulationParams} params
 * @param {{ id: string, x: number, y: number, population: number, status?: string }} settlement
 * @returns {SettlementCollapseWork | null}
 */
function prepareSettlementCollapseWork(params, settlement) {
  if (settlement.status === 'ruin' || settlement.population <= 0) {
    return null
  }

  const {
    primaryClaim,
    arableRaster,
    elevation,
    lakeMask,
    riverCorridorMask,
    simulationRiverMask,
    biomes,
    gridWidth,
    gridHeight,
    seaLevel = SEA_LEVEL,
    geographySeed = 0,
    epoch = 0,
  } = params

  const habitability = {
    gridWidth,
    elevation,
    lakeMask,
    riverCorridorMask,
    simulationRiverMask,
    biomes,
    seaLevel,
  }

  const domain = (primaryClaim[settlement.id] ?? []).filter((cell) =>
    isHabitablePopulationCell({ ...habitability, x: cell.x, y: cell.y }),
  )
  if (domain.length === 0) {
    return null
  }

  const pin = { x: settlement.x, y: settlement.y }
  const pinInDomain = domain.some((cell) => cell.x === pin.x && cell.y === pin.y)
  const urbanAnchor = pinInDomain
    ? pin
    : domain.reduce((best, cell) => {
        const bestDist = euclideanDistance(best, pin)
        const cellDist = euclideanDistance(cell, pin)
        return cellDist < bestDist ? cell : best
      }, domain[0])

  const population = Math.floor(settlement.population)
  const corePopulation = Math.min(
    population,
    Math.max(population > 0 ? 1 : 0, Math.floor(population * POPULATION_COLLAPSE_CORE_FRACTION)),
  )
  const hinterlandPopulation = population - corePopulation

  /** @type {Array<{ cell: { x: number, y: number }, weight: number }>} */
  const urbanWeighted = []
  for (const cell of domain) {
    const dx = Math.abs(cell.x - urbanAnchor.x)
    const dy = Math.abs(cell.y - urbanAnchor.y)
    if (dx === 0 && dy === 0) {
      urbanWeighted.push({ cell, weight: URBAN_PIN_WEIGHT })
    } else if (dx <= 1 && dy <= 1) {
      urbanWeighted.push({ cell, weight: URBAN_NEIGHBOR_WEIGHT })
    }
  }
  if (urbanWeighted.length === 0) {
    urbanWeighted.push({ cell: urbanAnchor, weight: URBAN_PIN_WEIGHT })
  }

  const urbanKeys = new Set(urbanWeighted.map((entry) => `${entry.cell.x},${entry.cell.y}`))
  /** @type {Array<{ cell: { x: number, y: number }, weight: number }>} */
  const hinterlandWeighted = []
  for (const cell of domain) {
    const key = `${cell.x},${cell.y}`
    if (urbanKeys.has(key)) {
      continue
    }
    const arable = arableRaster?.[cellIndex(cell, gridWidth)] ?? 0
    const fishProductivity = fishProductivityForCell({
      x: cell.x,
      y: cell.y,
      gridWidth,
      gridHeight,
      elevation,
      lakeMask,
      riverCorridorMask,
      seaLevel,
    })
    const foodWeight = hinterlandFoodWeight(arable, fishProductivity)
    if (!(foodWeight > 0)) {
      continue
    }
    const weight = foodWeight * distanceDecay(euclideanDistance(cell, urbanAnchor))
    if (weight > 0) {
      hinterlandWeighted.push({ cell, weight })
    }
  }

  const streamSalt = `population-collapse:${epoch}:${settlement.id}`
  const random =
    hinterlandPopulation > 0 && hinterlandWeighted.length > 0
      ? createSeededRandom(deriveFieldSeed(geographySeed, streamSalt))
      : null

  return {
    corePopulation,
    hinterlandPopulation,
    urbanWeighted,
    hinterlandWeighted,
    random,
  }
}

/**
 * @param {SettlementCollapseWork} work
 * @param {Float32Array} raster
 * @param {number} gridWidth
 */
function applyUrbanCollapseForSettlement(work, raster, gridWidth) {
  distributeIntegerByWeight(work.corePopulation, work.urbanWeighted, raster, gridWidth)
}

/**
 * @param {SettlementCollapseWork} work
 * @param {Float32Array} raster
 * @param {number} gridWidth
 */
function applyHinterlandCollapseForSettlement(work, raster, gridWidth) {
  const { hinterlandPopulation, urbanWeighted, hinterlandWeighted, random } = work
  if (hinterlandPopulation <= 0) {
    return
  }
  if (hinterlandWeighted.length === 0) {
    distributeIntegerByWeight(hinterlandPopulation, urbanWeighted, raster, gridWidth)
    return
  }
  if (!random) {
    return
  }
  for (let i = 0; i < hinterlandPopulation; i += 1) {
    const chosen = sampleWeightedCell(hinterlandWeighted, random)
    if (!chosen) {
      distributeIntegerByWeight(hinterlandPopulation - i, urbanWeighted, raster, gridWidth)
      break
    }
    addPeople(raster, cellIndex(chosen, gridWidth), 1)
  }
}

/**
 * @param {CollapsePopulationHooks | undefined} hooks
 * @param {'substep-start' | 'substep-complete'} type
 * @param {number} substepIndex
 * @param {string} substepId
 */
function emitCollapseSubstep(hooks, type, substepIndex, substepId) {
  hooks?.onCollapseSubstep?.({ type, substepIndex, substepId })
}

/**
 * @param {CollapsePopulationParams} params
 * @param {Array<SettlementCollapseWork | null>} workItems
 * @param {Float32Array} raster
 */
function applyUrbanCollapseForAllSettlements(params, workItems, raster) {
  for (let i = 0; i < params.settlements.length; i += 1) {
    const work = workItems[i]
    if (work) {
      applyUrbanCollapseForSettlement(work, raster, params.gridWidth)
    }
  }
}

/**
 * @param {CollapsePopulationParams} params
 * @param {Array<SettlementCollapseWork | null>} workItems
 * @param {Float32Array} raster
 * @param {() => Promise<void>} [yieldToUi]
 * @param {number} [yieldInterval]
 */
async function applyHinterlandCollapseForAllSettlements(
  params,
  workItems,
  raster,
  yieldToUi,
  yieldInterval = COLLAPSE_HINTERLAND_YIELD_INTERVAL,
) {
  let placedSinceYield = 0
  for (let i = 0; i < params.settlements.length; i += 1) {
    const work = workItems[i]
    if (!work || work.hinterlandPopulation <= 0) {
      continue
    }
    const { hinterlandPopulation, urbanWeighted, hinterlandWeighted, random } = work
    if (hinterlandWeighted.length === 0) {
      distributeIntegerByWeight(hinterlandPopulation, urbanWeighted, raster, params.gridWidth)
      await yieldToUi?.()
      continue
    }
    if (!random) {
      continue
    }
    for (let personIndex = 0; personIndex < hinterlandPopulation; personIndex += 1) {
      const chosen = sampleWeightedCell(hinterlandWeighted, random)
      if (!chosen) {
        distributeIntegerByWeight(
          hinterlandPopulation - personIndex,
          urbanWeighted,
          raster,
          params.gridWidth,
        )
        break
      }
      addPeople(raster, cellIndex(chosen, params.gridWidth), 1)
      placedSinceYield += 1
      if (placedSinceYield >= yieldInterval) {
        placedSinceYield = 0
        await yieldToUi?.()
      }
    }
  }
}

/**
 * Seeded constraint-satisfaction placement: urban cluster + arable hinterland sample.
 * Optional hooks/yieldToUi report progress and yield between substeps; both are
 * no-ops when omitted.
 *
 * @param {{
 *   settlements: Array<{ id: string, x: number, y: number, population: number, status?: string }>,
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 *   arableRaster?: Float32Array | null,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   riverCorridorMask?: Uint8Array | null,
 *   simulationRiverMask?: Uint8Array | null,
 *   biomes?: Uint8Array | null,
 *   gridWidth: number,
 *   gridHeight: number,
 *   seaLevel?: number,
 *   geographySeed?: number,
 *   epoch?: number,
 * }} params
 * @param {{ hooks?: CollapsePopulationHooks, yieldToUi?: () => Promise<void> }} [options]
 * @returns {Promise<Float32Array>}
 */
export async function collapsePopulation(params, options = {}) {
  const { hooks, yieldToUi } = options
  const { settlements, gridWidth, gridHeight } = params
  const raster = new Float32Array(gridWidth * gridHeight)
  const workItems = settlements.map((settlement) => prepareSettlementCollapseWork(params, settlement))

  emitCollapseSubstep(hooks, 'substep-start', 0, 'urban')
  await yieldToUi?.()
  applyUrbanCollapseForAllSettlements(params, workItems, raster)
  emitCollapseSubstep(hooks, 'substep-complete', 0, 'urban')
  await yieldToUi?.()

  emitCollapseSubstep(hooks, 'substep-start', 1, 'hinterland')
  await yieldToUi?.()
  await applyHinterlandCollapseForAllSettlements(params, workItems, raster, yieldToUi)
  emitCollapseSubstep(hooks, 'substep-complete', 1, 'hinterland')
  await yieldToUi?.()

  return raster
}

/**
 * Synchronous variant for the handful of production call sites that cannot
 * await (founding commit, legacy session rehydration without a progress
 * model). Prefer {@link collapsePopulation} everywhere else.
 *
 * @param {CollapsePopulationParams} params
 * @returns {Float32Array}
 */
export function collapsePopulationSync(params) {
  const { settlements, gridWidth, gridHeight } = params
  const raster = new Float32Array(gridWidth * gridHeight)
  const workItems = settlements.map((settlement) => prepareSettlementCollapseWork(params, settlement))
  applyUrbanCollapseForAllSettlements(params, workItems, raster)
  for (let i = 0; i < workItems.length; i += 1) {
    const work = workItems[i]
    if (work) {
      applyHinterlandCollapseForSettlement(work, raster, gridWidth)
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
