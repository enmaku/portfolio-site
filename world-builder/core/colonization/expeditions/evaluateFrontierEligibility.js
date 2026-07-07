import { classifySettlementMaritimeRole } from './classifySettlementMaritimeRole.js'

/**
 * @typedef {Object} FrontierEligibleSender
 * @property {string} settlementId
 * @property {number} population
 * @property {import('./classifySettlementMaritimeRole.js').SettlementMaritimeRole} maritimeRole
 * @property {boolean} canDispatchLand
 * @property {boolean} canDispatchMaritime
 */

/**
 * @param {{
 *   settlement: { id: string, x: number, y: number, population?: number },
 *   doc: import('../../types.js').WorldDocument,
 *   dryLandMask: Uint8Array,
 *   landFrontierEdges: number,
 *   maritimeFrontierEdges: number,
 *   maritimeFrontierOpen?: boolean,
 *   maritimeRole?: import('./classifySettlementMaritimeRole.js').SettlementMaritimeRole,
 * }} params
 * @returns {FrontierEligibleSender | null}
 */
export function evaluateFrontierEligibility(params) {
  const {
    settlement,
    doc,
    dryLandMask,
    landFrontierEdges,
    maritimeFrontierEdges,
    maritimeRole: providedMaritimeRole,
  } = params
  const population = Number.isFinite(settlement.population) ? settlement.population : 0
  if (population <= 0) {
    return null
  }

  const maritimeRole =
    providedMaritimeRole ?? classifySettlementMaritimeRole(doc, settlement)

  const canDispatchLand =
    landFrontierEdges > 0 && isOnDryLand(settlement, dryLandMask, doc.gridWidth)
  const maritimeFrontierOpen =
    maritimeFrontierEdges > 0 || params.maritimeFrontierOpen === true
  const canDispatchMaritime = maritimeFrontierOpen && maritimeRole !== 'none'

  if (!canDispatchLand && !canDispatchMaritime) {
    return null
  }

  return {
    settlementId: settlement.id,
    population,
    maritimeRole,
    canDispatchLand,
    canDispatchMaritime,
  }
}

/**
 * @param {{ x: number, y: number }} settlement
 * @param {Uint8Array} dryLandMask
 * @param {number} gridWidth
 * @returns {boolean}
 */
function isOnDryLand(settlement, dryLandMask, gridWidth) {
  const index = settlement.y * gridWidth + settlement.x
  return dryLandMask[index] === 1
}
