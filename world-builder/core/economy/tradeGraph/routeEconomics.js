/**
 * Route cargo capacity and transport cost for trade candidates.
 * Domain: world-builder/CONTEXT.md — route cargo capacity, transport cost.
 */

/** @typedef {'overland' | 'road' | 'inlandWater' | 'openSea'} TradeRouteMode */

/** Baseline lb capacity before mode multiplier: 365 × sqrt(popA × popB). */
export const ROUTE_CAPACITY_LB_PER_PERSON_DAY = 365

/** @type {Readonly<Record<TradeRouteMode, number>>} */
export const ROUTE_CAPACITY_MODE_MULTIPLIER = Object.freeze({
  overland: 1,
  road: 2,
  inlandWater: 4,
  openSea: 10,
})

/** Ordinary overland: 1 cp/lb per three-day haul distance. */
export const TRANSPORT_CP_PER_LB_PER_HAUL = 1

/** @type {Readonly<Record<TradeRouteMode, number>>} */
export const TRANSPORT_MODE_MULTIPLIER = Object.freeze({
  overland: 1,
  road: 0.5,
  inlandWater: 0.25,
  openSea: 0.1,
})

/** Directional haul friction endpoints: downhill/downriver → neutral → uphill/upriver. */
export const DIRECTIONAL_FRICTION_DOWNHILL = 0.75
export const DIRECTIONAL_FRICTION_NEUTRAL = 1
export const DIRECTIONAL_FRICTION_UPHILL = 1.5

/** Elevation delta (normalized units) that saturates directional friction to its extremes. */
export const DIRECTIONAL_FRICTION_ELEVATION_SCALE = 0.25

/**
 * Directional cost asymmetry for one traversal direction. Prefers flow direction along
 * inland water when a downstream sign is supplied; otherwise reads elevation delta on
 * land/road links (downhill = downriver = easier). Open-sea links are always neutral.
 *
 * @param {{
 *   mode: TradeRouteMode,
 *   fromElevation?: number,
 *   toElevation?: number,
 *   downstreamSign?: number,
 * }} params
 * @returns {number}
 */
export function directionalHaulFriction(params) {
  if (params.mode === 'openSea') {
    return DIRECTIONAL_FRICTION_NEUTRAL
  }
  const gradient = resolveDirectionalGradient(params)
  const t = Math.max(-1, Math.min(1, gradient))
  if (t >= 0) {
    return DIRECTIONAL_FRICTION_NEUTRAL + t * (DIRECTIONAL_FRICTION_UPHILL - DIRECTIONAL_FRICTION_NEUTRAL)
  }
  return DIRECTIONAL_FRICTION_NEUTRAL + t * (DIRECTIONAL_FRICTION_NEUTRAL - DIRECTIONAL_FRICTION_DOWNHILL)
}

/**
 * Positive = uphill/upriver (harder), negative = downhill/downriver (easier).
 *
 * @param {{ fromElevation?: number, toElevation?: number, downstreamSign?: number }} params
 * @returns {number}
 */
function resolveDirectionalGradient(params) {
  if (Number.isFinite(params.downstreamSign) && params.downstreamSign !== 0) {
    return params.downstreamSign > 0 ? -1 : 1
  }
  if (Number.isFinite(params.fromElevation) && Number.isFinite(params.toElevation)) {
    const delta = /** @type {number} */ (params.toElevation) - /** @type {number} */ (params.fromElevation)
    return delta / DIRECTIONAL_FRICTION_ELEVATION_SCALE
  }
  return 0
}

/**
 * @param {{
 *   populationA: number,
 *   populationB: number,
 *   mode: TradeRouteMode,
 * }} params
 * @returns {number}
 */
export function routeCargoCapacityLb(params) {
  const popA = Math.max(0, params.populationA)
  const popB = Math.max(0, params.populationB)
  const modeMul = ROUTE_CAPACITY_MODE_MULTIPLIER[params.mode] ?? 1
  return ROUTE_CAPACITY_LB_PER_PERSON_DAY * Math.sqrt(popA * popB) * modeMul
}

/**
 * Off-map cargo capacity for a port: open-sea formula with pop as both endpoints.
 * @param {number} portPopulation
 * @returns {number}
 */
export function offMapCargoCapacityLb(portPopulation) {
  return routeCargoCapacityLb({
    populationA: portPopulation,
    populationB: portPopulation,
    mode: 'openSea',
  })
}

/**
 * @param {{
 *   mode: TradeRouteMode,
 *   haulDistanceFraction: number,
 *   directionalFriction?: number,
 * }} params
 * @returns {number} cp per lb
 */
export function transportCostCpPerLb(params) {
  const modeMul = TRANSPORT_MODE_MULTIPLIER[params.mode] ?? 1
  const friction =
    params.mode === 'openSea'
      ? 1
      : Number.isFinite(params.directionalFriction)
        ? /** @type {number} */ (params.directionalFriction)
        : 1
  const distance = Math.max(0, params.haulDistanceFraction)
  return TRANSPORT_CP_PER_LB_PER_HAUL * distance * modeMul * friction
}
