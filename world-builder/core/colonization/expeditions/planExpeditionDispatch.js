import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { hasLegalFirstExpeditionStep } from './advanceBearingExpedition.js'
import {
  isSettlementSailReachable,
  SAIL_EXPEDITION_DISPATCH_PROBABILITY,
} from './selectSailExpeditionStep.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'

/**
 * @typedef {Object} PlanExpeditionDispatchInput
 * @property {{ id: string, x: number, y: number }} settlement
 * @property {import('../../types.js').WorldDocument} doc
 * @property {Uint8Array} visitRaster
 * @property {number} geographySeed
 * @property {number} epoch
 * @property {Uint8Array | null} roadCellMask
 */

/**
 * @param {PlanExpeditionDispatchInput} params
 * @returns {import('./expeditionConstants.js').ExpeditionRecord | null}
 */
export function planExpeditionDispatch(params) {
  const { settlement, doc, visitRaster, geographySeed, epoch, roadCellMask } = params
  const random = createSeededRandom(
    deriveFieldSeed(geographySeed, `expedition-dispatch-${epoch}-${settlement.id}`),
  )

  const dryLandMask = buildDryLandTraversableMask(doc)
  const sailMask = resolveSailTraversableMask(doc)
  const sailReachable = isSettlementSailReachable(doc, settlement)

  /** @type {'land' | 'sail'} */
  let mode = 'land'
  if (sailReachable) {
    mode = random() < SAIL_EXPEDITION_DISPATCH_PROBABILITY ? 'sail' : 'land'
  }

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
      mode,
    )
  ) {
    if (
      mode === 'sail' &&
      hasLegalFirstExpeditionStep(
        origin,
        bearing,
        landContext,
        sailMask,
        dryLandMask,
        doc,
        'land',
      )
    ) {
      mode = 'land'
    } else {
      return null
    }
  }

  return {
    id: `expedition-${epoch}-${settlement.id}-${bearing.toFixed(6)}`,
    settlementId: settlement.id,
    mode,
    bearing,
    route: [origin],
    progressIndex: 0,
    status: 'active',
    endReason: undefined,
  }
}
