import { livingSettlements } from '../core/colonization/expeditions/expeditionConstants.js'
import { SETTLEMENT_NODE_HOVER_RADIUS } from './settlementNodeMarkers.js'

/**
 * @typedef {{ settlementId: string, clientX: number, clientY: number }} SettlementHoverPayload
 */

/**
 * @param {{
 *   viewport: {
 *     eventMode: string,
 *     on: (event: string, handler: (...args: unknown[]) => void) => void,
 *   },
 *   getWorldDocument: () => import('../core/types.js').WorldDocument | null | undefined,
 * }} options
 */
export function attachSettlementHoverControls(options) {
  const { viewport, getWorldDocument } = options

  /** @type {((payload: SettlementHoverPayload | null) => void) | null} */
  let hoverHandler = null

  viewport.eventMode = 'static'
  viewport.on('pointermove', (event) => {
    if (!hoverHandler) {
      return
    }
    const doc = getWorldDocument()
    const world = /** @type {{ getLocalPosition: (target: unknown) => { x: number, y: number } }} */ (
      event
    ).getLocalPosition(viewport)
    const hit = hitTestLivingSettlement(doc, world.x, world.y)
    if (!hit) {
      hoverHandler(null)
      return
    }
    const pointer = /** @type {{ clientX?: number, clientY?: number }} */ (event)
    hoverHandler({
      settlementId: hit,
      clientX: typeof pointer.clientX === 'number' ? pointer.clientX : 0,
      clientY: typeof pointer.clientY === 'number' ? pointer.clientY : 0,
    })
  })

  return {
    /**
     * @param {((payload: SettlementHoverPayload | null) => void) | null} handler
     */
    onSettlementHover(handler) {
      hoverHandler = handler
    },
  }
}

/**
 * @param {import('../core/types.js').WorldDocument | null | undefined} worldDocument
 * @param {number} worldX
 * @param {number} worldY
 * @returns {string | null}
 */
export function hitTestLivingSettlement(worldDocument, worldX, worldY) {
  const settlements = livingSettlements(worldDocument?.settlements ?? [])
  let bestId = null
  let bestDistSq = SETTLEMENT_NODE_HOVER_RADIUS * SETTLEMENT_NODE_HOVER_RADIUS
  for (const settlement of settlements) {
    if (typeof settlement.x !== 'number' || typeof settlement.y !== 'number') {
      continue
    }
    if (typeof settlement.id !== 'string') {
      continue
    }
    const dx = worldX - (settlement.x + 0.5)
    const dy = worldY - (settlement.y + 0.5)
    const distSq = dx * dx + dy * dy
    if (distSq <= bestDistSq) {
      bestDistSq = distSq
      bestId = settlement.id
    }
  }
  return bestId
}
