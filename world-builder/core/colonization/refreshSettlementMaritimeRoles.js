/**
 * Refresh living settlement maritime roles from geography.
 * Domain: world-builder/CONTEXT.md — port, inland-sail.
 */

import { livingSettlements } from './expeditions/expeditionConstants.js'
import { classifySettlementMaritimeRole } from './expeditions/classifySettlementMaritimeRole.js'

/**
 * Classify and write `maritimeRole` onto every living settlement in the slice.
 * Call before trade assembly so clearing DTOs can copy roles without trade side effects.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 */
export function refreshSettlementMaritimeRoles(slice, worldDocument) {
  for (const settlement of livingSettlements(slice.settlements ?? [])) {
    settlement.maritimeRole = classifySettlementMaritimeRole(worldDocument, {
      x: settlement.x,
      y: settlement.y,
    })
  }
}
