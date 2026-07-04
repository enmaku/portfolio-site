import { computeHaulShedTravelTimes } from './computeHaulShedIsochrone.js'

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
 * }} params
 * @returns {PrimaryClaimMap}
 */
export function computePrimaryClaimMap(params) {
  const { pins, budget, gridWidth, gridHeight, movementCost, roadMultiplier } = params
  const cellCount = gridWidth * gridHeight
  /** @type {(string | null)[]} */
  const ownerByCell = Array.from({ length: cellCount }, () => null)
  const bestTime = new Float32Array(cellCount).fill(Number.POSITIVE_INFINITY)
  /** @type {Record<string, GridCell[]>} */
  const cellsBySettlementId = {}

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
    })

    for (let i = 0; i < cellCount; i += 1) {
      const time = travelTime[i]
      if (!Number.isFinite(time) || time > budget) continue
      if (time < bestTime[i] || (time === bestTime[i] && ownerByCell[i] == null)) {
        bestTime[i] = time
        ownerByCell[i] = pin.id
      } else if (time === bestTime[i] && ownerByCell[i] != null && pin.id < ownerByCell[i]) {
        // Stable tie-break: lexicographically smaller settlement id wins.
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

  return { ownerByCell, cellsBySettlementId }
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
  } = params

  return computePrimaryClaimMap({
    pins: settlements,
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth,
    gridHeight,
    movementCost,
    roadMultiplier,
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
