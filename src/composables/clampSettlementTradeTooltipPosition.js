/**
 * Flip-then-clamp placement for the settlement trade tooltip so it stays on-screen.
 * Prefers below-right of the anchor, flips above/left when needed, then clamps.
 */

export const TOOLTIP_VIEWPORT_MARGIN = 8
export const TOOLTIP_ANCHOR_OFFSET = 12

/**
 * @param {{
 *   anchorX: number,
 *   anchorY: number,
 *   width: number,
 *   height: number,
 *   viewportWidth: number,
 *   viewportHeight: number,
 *   margin?: number,
 *   offset?: number,
 * }} params
 * @returns {{ left: number, top: number }}
 */
export function clampSettlementTradeTooltipPosition(params) {
  const margin = params.margin ?? TOOLTIP_VIEWPORT_MARGIN
  const offset = params.offset ?? TOOLTIP_ANCHOR_OFFSET
  const { anchorX, anchorY, width, height, viewportWidth, viewportHeight } = params

  let left = anchorX + offset
  let top = anchorY + offset

  if (left + width > viewportWidth - margin) {
    left = anchorX - offset - width
  }
  if (top + height > viewportHeight - margin) {
    top = anchorY - offset - height
  }

  const maxLeft = Math.max(margin, viewportWidth - margin - width)
  const maxTop = Math.max(margin, viewportHeight - margin - height)
  left = Math.min(Math.max(left, margin), maxLeft)
  top = Math.min(Math.max(top, margin), maxTop)

  return { left, top }
}
