import {
  createFoundingLandingValidityContext,
  snapFoundingLandingCellInContext,
} from '../core/colonization/isValidFoundingLandingCell.js'

/** Pin radius in screen pixels so it stays visible when zoomed out. */
const PIN_SCREEN_RADIUS_PX = 9
const PIN_STROKE_SCREEN_PX = 2.5
const PIN_MIN_WORLD_RADIUS = 0.75

/**
 * @param {{
 *   Graphics: new () => {
 *     clear: () => void,
 *     circle: (x: number, y: number, r: number) => void,
 *     moveTo: (x: number, y: number) => void,
 *     lineTo: (x: number, y: number) => void,
 *     fill: (style?: object) => void,
 *     stroke: (style?: object) => void,
 *     setFillStyle: (style: object) => void,
 *   },
 *   viewport: {
 *     addChild: (child: unknown) => void,
 *     eventMode: string,
 *     scale: { x: number },
 *     on: (event: string, handler: (...args: unknown[]) => void) => void,
 *   },
 *   hostEl: HTMLElement,
 *   getWorldDocument: () => import('../core/types.js').WorldDocument,
 *   requestRender?: () => void,
 * }} options
 */
export function attachLandingPlacementControls(options) {
  const { Graphics, viewport, hostEl, getWorldDocument, requestRender } = options
  const haulShedPreview = new Graphics()
  const landingPin = new Graphics()
  const focusPin = new Graphics()
  viewport.addChild(haulShedPreview)
  viewport.addChild(landingPin)
  viewport.addChild(focusPin)

  /** @type {((cell: { x: number, y: number }) => void) | null} */
  let cellPickHandler = null
  /** @type {(() => void) | null} */
  let settlementFocusClearHandler = null
  let landingPlacementEnabled = false
  /** @type {{ x: number, y: number } | null} */
  let currentMarker = null
  /** @type {{ x: number, y: number } | null} */
  let focusMarker = null
  /** @type {import('../core/types.js').WorldDocument | null} */
  let validityContextDoc = null
  /** @type {import('../core/colonization/isValidFoundingLandingCell.js').FoundingLandingValidityContext | null} */
  let validityContext = null

  hostEl.style.cursor = ''
  viewport.eventMode = 'static'
  viewport.on('pointermove', (event) => {
    if (!landingPlacementEnabled) {
      hostEl.style.cursor = ''
      return
    }
    const world = /** @type {{ getLocalPosition: (target: unknown) => { x: number, y: number } }} */ (
      event
    ).getLocalPosition(viewport)
    const x = Math.floor(world.x)
    const y = Math.floor(world.y)
    const ctx = getValidityContext()
    hostEl.style.cursor = snapFoundingLandingCellInContext(ctx, x, y)
      ? 'crosshair'
      : 'not-allowed'
  })
  viewport.on('pointertap', (event) => {
    if (landingPlacementEnabled) {
      if (!cellPickHandler) {
        return
      }
      const world = /** @type {{ getLocalPosition: (target: unknown) => { x: number, y: number } }} */ (
        event
      ).getLocalPosition(viewport)
      cellPickHandler({ x: Math.floor(world.x), y: Math.floor(world.y) })
      return
    }
    settlementFocusClearHandler?.()
  })
  viewport.on('zoomed', () => {
    redrawLandingPin()
    redrawFocusPin()
    requestRender?.()
  })
  viewport.on('moved', () => {
    redrawLandingPin()
    redrawFocusPin()
    requestRender?.()
  })

  function clearValidityContext() {
    validityContextDoc = null
    validityContext = null
  }

  /**
   * @returns {import('../core/colonization/isValidFoundingLandingCell.js').FoundingLandingValidityContext | null}
   */
  function getValidityContext() {
    const doc = getWorldDocument()
    if (!doc) {
      clearValidityContext()
      return null
    }
    if (validityContext && validityContextDoc === doc) {
      return validityContext
    }
    validityContextDoc = doc
    validityContext = createFoundingLandingValidityContext(doc)
    return validityContext
  }

  /**
   * @param {number} screenPx
   * @returns {number}
   */
  function worldUnitsForScreenPx(screenPx) {
    const scale = Math.abs(viewport.scale?.x) || 1
    return screenPx / scale
  }

  function redrawLandingPin() {
    landingPin.clear()
    if (!currentMarker) {
      return
    }
    const radius = Math.max(PIN_MIN_WORLD_RADIUS, worldUnitsForScreenPx(PIN_SCREEN_RADIUS_PX))
    const stroke = Math.max(0.12, worldUnitsForScreenPx(PIN_STROKE_SCREEN_PX))
    const cx = currentMarker.x + 0.5
    const cy = currentMarker.y + 0.5
    const arm = radius * 1.8

    landingPin.circle(cx, cy, radius * 1.55)
    landingPin.stroke({ width: stroke * 0.7, color: 0xffffff, alpha: 0.95 })
    landingPin.circle(cx, cy, radius)
    landingPin.fill({ color: 0xffcc33 })
    landingPin.stroke({ width: stroke, color: 0x111111 })

    landingPin.moveTo(cx - arm, cy)
    landingPin.lineTo(cx + arm, cy)
    landingPin.moveTo(cx, cy - arm)
    landingPin.lineTo(cx, cy + arm)
    landingPin.stroke({ width: stroke * 0.85, color: 0x111111, alpha: 0.9 })
  }

  function redrawFocusPin() {
    focusPin.clear()
    if (!focusMarker) {
      return
    }
    const radius = Math.max(PIN_MIN_WORLD_RADIUS, worldUnitsForScreenPx(PIN_SCREEN_RADIUS_PX))
    const stroke = Math.max(0.12, worldUnitsForScreenPx(PIN_STROKE_SCREEN_PX))
    const cx = focusMarker.x + 0.5
    const cy = focusMarker.y + 0.5
    const arm = radius * 1.8

    focusPin.circle(cx, cy, radius * 1.55)
    focusPin.stroke({ width: stroke * 0.7, color: 0xffffff, alpha: 0.95 })
    focusPin.circle(cx, cy, radius)
    focusPin.stroke({ width: stroke * 1.15, color: 0x33ddff, alpha: 0.95 })
    focusPin.circle(cx, cy, radius * 0.55)
    focusPin.stroke({ width: stroke * 0.85, color: 0x33ddff, alpha: 0.9 })

    focusPin.moveTo(cx - arm, cy)
    focusPin.lineTo(cx + arm, cy)
    focusPin.moveTo(cx, cy - arm)
    focusPin.lineTo(cx, cy + arm)
    focusPin.stroke({ width: stroke * 0.85, color: 0x33ddff, alpha: 0.85 })
  }

  function commitLandingOverlay() {
    requestRender?.()
  }

  return {
    /**
     * @param {boolean} enabled
     */
    setLandingPlacementMode(enabled) {
      landingPlacementEnabled = enabled === true
      if (!landingPlacementEnabled) {
        hostEl.style.cursor = ''
        clearValidityContext()
      } else {
        getValidityContext()
      }
    },

    /**
     * @param {{ x: number, y: number } | null | undefined} marker
     */
    setFoundingLandingMarker(marker) {
      currentMarker = marker ? { x: marker.x, y: marker.y } : null
      redrawLandingPin()
      commitLandingOverlay()
    },

    /**
     * @param {{ x: number, y: number } | null | undefined} marker
     */
    setSettlementFocusMarker(marker) {
      focusMarker = marker ? { x: marker.x, y: marker.y } : null
      redrawFocusPin()
      commitLandingOverlay()
    },

    /**
     * @param {Array<{ x: number, y: number }> | null | undefined} cells
     */
    setHaulShedPreviewCells(cells) {
      haulShedPreview.clear()
      if (cells?.length) {
        haulShedPreview.setFillStyle({ color: 0x66ccff, alpha: 0.28 })
        for (const cell of cells) {
          haulShedPreview.rect(cell.x, cell.y, 1, 1)
          haulShedPreview.fill()
        }
      }
      commitLandingOverlay()
    },

    /**
     * @param {((cell: { x: number, y: number }) => void) | null} handler
     */
    onCellPick(handler) {
      cellPickHandler = handler
    },

    /**
     * @param {(() => void) | null} handler
     */
    onSettlementFocusClear(handler) {
      settlementFocusClearHandler = handler
    },

    clearCursor() {
      hostEl.style.cursor = ''
    },
  }
}
