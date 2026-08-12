import { computeHaulShedTravelTimes } from './computeHaulShedIsochrone.js'
import { buildLandRouteCellMask } from './roads/roadNetwork.js'

/**
 * @typedef {{ x: number, y: number }} GridCell
 */

/**
 * @typedef {Object} ClaimPin
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {string} [status]
 */

/**
 * @typedef {Object} PrimaryClaimMap
 * @property {(string | null)[]} ownerByCell
 * @property {Record<string, GridCell[]>} cellsBySettlementId
 */

/**
 * Living-pin claim competition state for provisional founding (bestTime stash).
 *
 * @typedef {Object} LivingPrimaryClaimState
 * @property {(string | null)[]} ownerByCell
 * @property {Float32Array} bestTime
 * @property {Record<string, GridCell[]>} cellsBySettlementId
 * @property {Record<string, Float64Array>} travelTimeByPinId
 */

/**
 * Exclusive nearest-pin-by-travel-time ownership within each pin's haul-shed.
 * Ruins and non-living pins are ignored.
 *
 * @param {{
 *   pins: ClaimPin[],
 *   budget: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost?: Float32Array | null,
 *   roadMultiplier?: number,
 *   roadCellMask?: Uint8Array | null,
 * }} params
 * @returns {PrimaryClaimMap}
 */
export function computePrimaryClaimMap(params) {
  const state = buildLivingPrimaryClaimState(params)
  return {
    ownerByCell: state.ownerByCell,
    cellsBySettlementId: state.cellsBySettlementId,
  }
}

/**
 * Build ownership + bestTime + per-pin isochrones for living pins.
 *
 * @param {{
 *   pins: ClaimPin[],
 *   budget: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost?: Float32Array | null,
 *   roadMultiplier?: number,
 *   roadCellMask?: Uint8Array | null,
 * }} params
 * @returns {LivingPrimaryClaimState}
 */
export function buildLivingPrimaryClaimState(params) {
  const { pins, budget, gridWidth, gridHeight, movementCost, roadMultiplier, roadCellMask } =
    params
  const cellCount = gridWidth * gridHeight
  /** @type {(string | null)[]} */
  const ownerByCell = Array.from({ length: cellCount }, () => null)
  const bestTime = new Float32Array(cellCount).fill(Number.POSITIVE_INFINITY)
  /** @type {Record<string, GridCell[]>} */
  const cellsBySettlementId = {}
  /** @type {Record<string, Float64Array>} */
  const travelTimeByPinId = {}

  const livingPins = pins.filter((pin) => pin.status !== 'ruin')
  for (const pin of livingPins) {
    cellsBySettlementId[pin.id] = []
    const travelTime = computeHaulShedTravelTimes({
      origin: { x: pin.x, y: pin.y },
      budget,
      gridWidth,
      gridHeight,
      movementCost,
      roadMultiplier,
      roadCellMask,
    })
    travelTimeByPinId[pin.id] = travelTime

    for (let i = 0; i < cellCount; i += 1) {
      const time = travelTime[i]
      if (!Number.isFinite(time) || time > budget) continue
      if (time < bestTime[i] || (time === bestTime[i] && ownerByCell[i] == null)) {
        bestTime[i] = time
        ownerByCell[i] = pin.id
      } else if (time === bestTime[i] && ownerByCell[i] != null && pin.id < ownerByCell[i]) {
        ownerByCell[i] = pin.id
      }
    }
  }

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const owner = ownerByCell[y * gridWidth + x]
      if (owner == null) continue
      cellsBySettlementId[owner].push({ x, y })
    }
  }

  return { ownerByCell, bestTime, cellsBySettlementId, travelTimeByPinId }
}

/**
 * Flood only the candidate pin against a precomputed living-pin competition state.
 *
 * @param {{
 *   base: LivingPrimaryClaimState,
 *   candidatePin: ClaimPin,
 *   budget: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost?: Float32Array | null,
 *   roadMultiplier?: number,
 *   roadCellMask?: Uint8Array | null,
 * }} params
 * @returns {PrimaryClaimMap & { bestTime: Float32Array, candidateTravelTime: Float64Array }}
 */
export function computePrimaryClaimMapAddingPin(params) {
  const {
    base,
    candidatePin,
    budget,
    gridWidth,
    gridHeight,
    movementCost,
    roadMultiplier,
    roadCellMask,
  } = params
  const cellCount = gridWidth * gridHeight
  const ownerByCell = base.ownerByCell.slice()
  const bestTime = new Float32Array(base.bestTime)
  /** @type {Record<string, GridCell[]>} */
  const cellsBySettlementId = {}
  for (const id of Object.keys(base.cellsBySettlementId)) {
    cellsBySettlementId[id] = []
  }
  cellsBySettlementId[candidatePin.id] = []

  const candidateTravelTime = computeHaulShedTravelTimes({
    origin: { x: candidatePin.x, y: candidatePin.y },
    budget,
    gridWidth,
    gridHeight,
    movementCost,
    roadMultiplier,
    roadCellMask,
  })

  for (let i = 0; i < cellCount; i += 1) {
    const time = candidateTravelTime[i]
    if (!Number.isFinite(time) || time > budget) continue
    if (time < bestTime[i] || (time === bestTime[i] && ownerByCell[i] == null)) {
      bestTime[i] = time
      ownerByCell[i] = candidatePin.id
    } else if (
      time === bestTime[i] &&
      ownerByCell[i] != null &&
      candidatePin.id < ownerByCell[i]
    ) {
      ownerByCell[i] = candidatePin.id
    }
  }

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const owner = ownerByCell[y * gridWidth + x]
      if (owner == null) continue
      if (!cellsBySettlementId[owner]) cellsBySettlementId[owner] = []
      cellsBySettlementId[owner].push({ x, y })
    }
  }

  return { ownerByCell, cellsBySettlementId, bestTime, candidateTravelTime }
}

/**
 * Fold a newly founded pin into the living claim stash (mutates `base`).
 *
 * @param {LivingPrimaryClaimState} base
 * @param {{
 *   pin: ClaimPin,
 *   travelTime: Float64Array,
 *   budget: number,
 *   gridWidth: number,
 *   gridHeight: number,
 * }} params
 * @returns {LivingPrimaryClaimState}
 */
export function incorporatePinIntoLivingClaimState(base, params) {
  const { pin, travelTime, budget, gridWidth, gridHeight } = params
  const cellCount = gridWidth * gridHeight
  base.travelTimeByPinId[pin.id] = travelTime
  for (let i = 0; i < cellCount; i += 1) {
    const time = travelTime[i]
    if (!Number.isFinite(time) || time > budget) continue
    if (time < base.bestTime[i] || (time === base.bestTime[i] && base.ownerByCell[i] == null)) {
      base.bestTime[i] = time
      base.ownerByCell[i] = pin.id
    } else if (
      time === base.bestTime[i] &&
      base.ownerByCell[i] != null &&
      pin.id < base.ownerByCell[i]
    ) {
      base.ownerByCell[i] = pin.id
    }
  }
  /** @type {Record<string, GridCell[]>} */
  const cellsBySettlementId = {}
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const owner = base.ownerByCell[y * gridWidth + x]
      if (owner == null) continue
      if (!cellsBySettlementId[owner]) cellsBySettlementId[owner] = []
      cellsBySettlementId[owner].push({ x, y })
    }
  }
  base.cellsBySettlementId = cellsBySettlementId
  return base
}

/**
 * Recompute primary claims for living settlements on a colonization slice.
 *
 * @param {{
 *   settlements: Array<{ id: string, x: number, y: number, status?: string }>,
 *   colonistSettings: { threeDayHaulDistance: number },
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost?: Float32Array | null,
 *   roadMultiplier?: number,
 *   roadCellMask?: Uint8Array | null,
 *   roads?: import('./roads/roadNetwork.js').RoadSegment[] | null,
 * }} params
 * @returns {PrimaryClaimMap}
 */
export function recomputePrimaryClaims(params) {
  const {
    settlements,
    colonistSettings,
    gridWidth,
    gridHeight,
    movementCost,
    roadMultiplier,
    roadCellMask,
    roads,
  } = params

  let resolvedRoadMask = roadCellMask ?? null
  if (!resolvedRoadMask && roads) {
    resolvedRoadMask = buildLandRouteCellMask(roads, gridWidth, gridHeight)
  }

  return computePrimaryClaimMap({
    pins: settlements,
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth,
    gridHeight,
    movementCost,
    roadMultiplier,
    roadCellMask: resolvedRoadMask,
  })
}

/**
 * Serialize claim map for tip / session storage (cells only).
 *
 * @param {PrimaryClaimMap} claimMap
 * @returns {Record<string, GridCell[]>}
 */
export function serializeClaimMap(claimMap) {
  /** @type {Record<string, GridCell[]>} */
  const serialized = {}
  for (const [settlementId, cells] of Object.entries(claimMap.cellsBySettlementId)) {
    serialized[settlementId] = cells.map((cell) => ({ x: cell.x, y: cell.y }))
  }
  return serialized
}

/**
 * @param {Record<string, GridCell[]> | null | undefined} primaryClaim
 * @param {Array<{ id?: string, status?: string }>} settlements
 * @returns {boolean}
 */
export function hasPersistedPrimaryClaim(primaryClaim, settlements) {
  const living = (settlements ?? []).filter((settlement) => settlement.status !== 'ruin')
  if (living.length === 0) {
    return true
  }
  if (!primaryClaim || typeof primaryClaim !== 'object') {
    return false
  }
  return living.every(
    (settlement) =>
      typeof settlement.id === 'string' &&
      Array.isArray(primaryClaim[settlement.id]) &&
      primaryClaim[settlement.id].length > 0,
  )
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @returns {Record<string, GridCell[]>}
 */
export function rehydratePrimaryClaimForSlice(slice, doc) {
  if (!slice.settlements?.length) {
    return {}
  }
  return serializeClaimMap(
    recomputePrimaryClaims({
      settlements: slice.settlements,
      colonistSettings: slice.colonistSettings,
      gridWidth: doc.gridWidth,
      gridHeight: doc.gridHeight,
      movementCost: doc.movementCost,
      roads: slice.roads,
    }),
  )
}
