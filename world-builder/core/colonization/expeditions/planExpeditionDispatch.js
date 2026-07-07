import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'
import { hasLegalFirstExpeditionStep } from './advanceBearingExpedition.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { resolveExpeditionModeForSender } from './resolveExpeditionModeForSender.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'

/**
 * @typedef {Object} PlanExpeditionDispatchInput
 * @property {{ id: string, x: number, y: number }} settlement
 * @property {import('../../types.js').WorldDocument} doc
 * @property {Uint8Array} visitRaster
 * @property {number} geographySeed
 * @property {number} geographySeed
 * @property {number} epoch
 * @property {Uint8Array | null} roadCellMask
 * @property {import('./expeditionConstants.js').ExpeditionMode} mode
 */

/**
 * @param {PlanExpeditionDispatchInput} params
 * @returns {import('./expeditionConstants.js').ExpeditionRecord | null}
 */
export function planExpeditionDispatch(params) {
  const { settlement, doc, visitRaster, geographySeed, epoch, roadCellMask, mode } = params
  const random = createSeededRandom(
    deriveFieldSeed(geographySeed, `expedition-dispatch-${epoch}-${settlement.id}-${mode}`),
  )
  const resolvedMode = mode

  const dryLandMask = buildDryLandTraversableMask(doc)
  const sailMask = resolveSailTraversableMask(doc)
  const bearing = random() * Math.PI * 2
  const origin = { x: settlement.x, y: settlement.y }
  const landContext = { doc, dryLandMask, visitRaster, roadCellMask }

  if (
    !hasLegalFirstExpeditionStep(
      origin,
      bearing,
      landContext,
      sailMask,
      dryLandMask,
      doc,
      resolvedMode,
    )
  ) {
    return null
  }

  return {
    id: `expedition-${epoch}-${settlement.id}-${bearing.toFixed(6)}`,
    settlementId: settlement.id,
    mode: resolvedMode,
    bearing,
    route: [origin],
    progressIndex: 0,
    status: 'active',
    endReason: undefined,
  }
}

/**
 * @param {import('./allocateExpeditionSlots.js').ExpeditionSlotAssignment} assignment
 * @param {PlanExpeditionDispatchInput} baseParams
 * @returns {import('./expeditionConstants.js').ExpeditionRecord | null}
 */
export function planExpeditionDispatchForAssignment(assignment, baseParams) {
  const mode = resolveExpeditionModeForSender(assignment, {
    doc: baseParams.doc,
    visitRaster: baseParams.visitRaster,
  })
  return planExpeditionDispatch({ ...baseParams, mode })
}
