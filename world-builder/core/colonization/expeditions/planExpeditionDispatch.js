import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'
import { hasLegalFirstExpeditionStep } from './advanceBearingExpedition.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { isMaritimeExpeditionMode } from './expeditionConstants.js'
import {
  listAvailableExpeditionModes,
  resolveExpeditionModeForSender,
} from './resolveExpeditionModeForSender.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'

/**
 * @typedef {Object} PlanExpeditionDispatchInput
 * @property {{ id: string, x: number, y: number }} settlement
 * @property {import('../../types.js').WorldDocument} doc
 * @property {Uint8Array} visitRaster
 * @property {number} geographySeed
 * @property {number} epoch
 * @property {number} assignmentIndex zero-based dispatch order within the epoch
 * @property {Uint8Array | null} roadCellMask
 * @property {Uint8Array} [dryLandMask]
 * @property {Uint8Array | null} [sailMask]
 * @property {import('./expeditionConstants.js').ExpeditionMode} mode
 */

/**
 * @param {PlanExpeditionDispatchInput} params
 * @returns {import('./expeditionConstants.js').ExpeditionRecord | null}
 */
export function planExpeditionDispatch(params) {
  const {
    settlement,
    doc,
    visitRaster,
    geographySeed,
    epoch,
    assignmentIndex,
    roadCellMask,
    mode,
  } = params
  const random = createSeededRandom(
    deriveFieldSeed(
      geographySeed,
      `expedition-dispatch-${epoch}-${settlement.id}-${mode}-${assignmentIndex}`,
    ),
  )
  const resolvedMode = mode

  const dryLandMask = params.dryLandMask ?? buildDryLandTraversableMask(doc)
  const sailMask = params.sailMask !== undefined ? params.sailMask : resolveSailTraversableMask(doc)
  const bearing = random() * Math.PI * 2
  const origin = { x: settlement.x, y: settlement.y }
  const landContext = { doc, dryLandMask, visitRaster, roadCellMask }

  if (
    !isMaritimeExpeditionMode(resolvedMode) &&
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
    id: `expedition-${epoch}-${settlement.id}-${assignmentIndex}-${bearing.toFixed(6)}`,
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
  const modeRandom = createSeededRandom(
    deriveFieldSeed(
      baseParams.geographySeed,
      `expedition-mode-${baseParams.epoch}-${assignment.settlementId}-${baseParams.assignmentIndex}`,
    ),
  )
  const primaryMode = resolveExpeditionModeForSender(assignment, modeRandom)
  const modes = listAvailableExpeditionModes(assignment)
  const orderedModes = [
    primaryMode,
    ...modes.filter((mode) => mode !== primaryMode),
  ]

  for (const mode of orderedModes) {
    const planned = planExpeditionDispatch({ ...baseParams, mode })
    if (planned) {
      return planned
    }
  }

  return null
}
