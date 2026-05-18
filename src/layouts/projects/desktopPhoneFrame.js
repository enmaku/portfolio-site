/** Quasar `md` minimum viewport width (px). */
export const DESKTOP_PHONE_FRAME_MD_MIN_WIDTH_PX = 1024

/** Target portrait column width before shrink (CSS px). */
export const DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX = 390

/** Minimum horizontal gutter on each side of the column (CSS px). */
export const DESKTOP_PHONE_FRAME_HORIZONTAL_GUTTER_PX = 24

/** Portrait height-to-width ratio (19.5∶9). */
export const DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH = 19.5 / 9

/** Height cap as a fraction of viewport height (matches `90dvh`). */
export const DESKTOP_PHONE_FRAME_MAX_HEIGHT_VIEWPORT_FRACTION = 0.9

export const DESKTOP_PHONE_FRAME_CSS_VAR = {
  columnWidth: '--project-shell-phone-frame-width',
  columnHeight: '--project-shell-phone-frame-height',
  columnMaxHeight: '--project-shell-phone-frame-max-height',
}

/**
 * @param {number} viewportWidthPx
 * @returns {boolean}
 */
export function isDesktopPhoneFrameBreakpointActive(viewportWidthPx) {
  return viewportWidthPx >= DESKTOP_PHONE_FRAME_MD_MIN_WIDTH_PX
}

/**
 * @param {number} viewportWidthPx
 * @returns {number}
 */
export function resolveDesktopPhoneFrameColumnWidthPx(viewportWidthPx) {
  const minViewportForFullColumn =
    DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX + 2 * DESKTOP_PHONE_FRAME_HORIZONTAL_GUTTER_PX
  if (viewportWidthPx >= minViewportForFullColumn) {
    return DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX
  }
  return Math.max(0, viewportWidthPx - 2 * DESKTOP_PHONE_FRAME_HORIZONTAL_GUTTER_PX)
}

/**
 * @param {number} columnWidthPx
 * @param {number} viewportHeightPx
 * @returns {number}
 */
export function resolveDesktopPhoneFrameColumnHeightPx(columnWidthPx, viewportHeightPx) {
  const aspectCap = columnWidthPx * DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH
  if (viewportHeightPx <= 0) {
    return Math.round(aspectCap)
  }
  const viewportCap = viewportHeightPx * DESKTOP_PHONE_FRAME_MAX_HEIGHT_VIEWPORT_FRACTION
  return Math.round(Math.min(viewportCap, aspectCap))
}

/**
 * Normalize viewport dimensions for layout (Quasar Screen can report 0 before ready).
 *
 * @param {{ viewportWidthPx: number, viewportHeightPx: number }} dimensions
 * @returns {{ viewportWidthPx: number, viewportHeightPx: number }}
 */
export function normalizeDesktopPhoneFrameViewport(dimensions) {
  let { viewportWidthPx, viewportHeightPx } = dimensions
  if (typeof window !== 'undefined') {
    if (viewportWidthPx <= 0) viewportWidthPx = window.innerWidth
    if (viewportHeightPx <= 0) viewportHeightPx = window.innerHeight
  }
  return { viewportWidthPx, viewportHeightPx }
}

/**
 * @param {number} columnWidthPx
 * @param {number} columnHeightPx
 * @returns {Record<string, string>}
 */
export function buildDesktopPhoneFrameCssVars(columnWidthPx, columnHeightPx) {
  const width = `${columnWidthPx}px`
  const height = `${columnHeightPx}px`
  const maxHeight = `min(90dvh, calc(${width} * ${DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH}))`
  return {
    [DESKTOP_PHONE_FRAME_CSS_VAR.columnWidth]: width,
    [DESKTOP_PHONE_FRAME_CSS_VAR.columnHeight]: height,
    [DESKTOP_PHONE_FRAME_CSS_VAR.columnMaxHeight]: maxHeight,
  }
}

/**
 * Inline styles for the framed column element (width, height, maxHeight).
 *
 * @param {number} columnWidthPx
 * @param {number} columnHeightPx
 * @returns {Record<string, string>}
 */
export function buildDesktopPhoneFrameColumnStyle(columnWidthPx, columnHeightPx) {
  const cssVars = buildDesktopPhoneFrameCssVars(columnWidthPx, columnHeightPx)
  return {
    width: cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnWidth],
    height: cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnHeight],
    maxHeight: cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnMaxHeight],
  }
}

/**
 * @param {{ viewportWidthPx: number, viewportHeightPx: number }} dimensions
 * @returns {{
 *   active: boolean,
 *   columnWidthPx?: number,
 *   columnHeightPx?: number,
 *   style?: Record<string, string>,
 *   cssVars?: Record<string, string>,
 * }}
 */
export function getDesktopPhoneFrameLayout(dimensions) {
  const { viewportWidthPx, viewportHeightPx } = normalizeDesktopPhoneFrameViewport(dimensions)

  if (!isDesktopPhoneFrameBreakpointActive(viewportWidthPx)) {
    return { active: false }
  }

  const columnWidthPx = resolveDesktopPhoneFrameColumnWidthPx(viewportWidthPx)
  const columnHeightPx = resolveDesktopPhoneFrameColumnHeightPx(
    columnWidthPx,
    viewportHeightPx,
  )
  const cssVars = buildDesktopPhoneFrameCssVars(columnWidthPx, columnHeightPx)

  return {
    active: true,
    columnWidthPx,
    columnHeightPx,
    style: buildDesktopPhoneFrameColumnStyle(columnWidthPx, columnHeightPx),
    cssVars,
  }
}
