/** Body + `q-layout` modifier while **desktop phone frame** is active. */
export const PROJECT_SHELL_DESKTOP_FRAME_BODY_CLASS = 'project-shell--desktop-frame'

/** Dedicated Quasar global-nodes mount inside the framed column (`#…` in DOM). */
export const PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID = 'project-shell-frame-portal'

/** Layer that stacks portaled dialogs/menus above routed project content. */
export const PROJECT_SHELL_FRAME_PORTAL_LAYER_CLASS = 'project-shell__frame-portal'

/** Quasar background utility for frame gutter (`$dark-page`). */
export const PROJECT_SHELL_FRAME_GUTTER_BG_CLASS = 'bg-dark-page'

/** Framed column corner radius (px); keep within 12–16px product spec. */
export const PROJECT_SHELL_FRAME_COLUMN_BORDER_RADIUS_PX = 14

/** Subtle column edge (CONTEXT: light border, not hardware bezel). */
export const PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_WIDTH_PX = 1
export const PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)'
export const PROJECT_SHELL_FRAME_COLUMN_SURFACE_BOX_SHADOW = '0 8px 32px rgba(0, 0, 0, 0.4)'

/** Product shell uses flat rounding + edge only—no notch or bezel artwork. */
export const PROJECT_SHELL_FRAME_COLUMN_USES_HARDWARE_BEZEL = false

export const PROJECT_SHELL_FRAME_CSS_VAR = {
  columnBorderRadius: '--project-shell-frame-column-radius',
  columnEdgeBorderWidth: '--project-shell-frame-column-edge-border-width',
  columnEdgeBorderColor: '--project-shell-frame-column-edge-border-color',
  columnSurfaceBoxShadow: '--project-shell-frame-column-surface-box-shadow',
}

/**
 * @returns {Record<string, string>}
 */
export function buildProjectShellFrameColumnPresentationVars() {
  return {
    [PROJECT_SHELL_FRAME_CSS_VAR.columnBorderRadius]: `${PROJECT_SHELL_FRAME_COLUMN_BORDER_RADIUS_PX}px`,
    [PROJECT_SHELL_FRAME_CSS_VAR.columnEdgeBorderWidth]: `${PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_WIDTH_PX}px`,
    [PROJECT_SHELL_FRAME_CSS_VAR.columnEdgeBorderColor]:
      PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_COLOR,
    [PROJECT_SHELL_FRAME_CSS_VAR.columnSurfaceBoxShadow]:
      PROJECT_SHELL_FRAME_COLUMN_SURFACE_BOX_SHADOW,
  }
}

/**
 * @param {boolean} frameActive
 * @returns {string | undefined}
 */
export function resolveProjectShellFramePortalElementId(frameActive) {
  return frameActive ? PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID : undefined
}

/**
 * @param {boolean} frameActive
 * @param {Pick<Document, 'getElementById'> | null | undefined} [doc]
 * @returns {HTMLElement | null}
 */
export function resolveProjectShellOverlayPortalMount(frameActive, doc) {
  if (!frameActive) return null
  const root = doc ?? (typeof document !== 'undefined' ? document : null)
  if (root == null) return null
  return root.getElementById(PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID)
}

/**
 * @param {ReturnType<typeof import('./desktopPhoneFrame.js').getDesktopPhoneFrameLayout>} layout
 * @returns {Record<string, string> | undefined}
 */
export function resolveProjectShellFrameGutterInlineStyle(layout) {
  return layout.active ? layout.cssVars : undefined
}

/**
 * @param {ReturnType<typeof import('./desktopPhoneFrame.js').getDesktopPhoneFrameLayout>} layout
 * @returns {Record<string, string> | undefined}
 */
export function resolveProjectShellFrameColumnInlineStyle(layout) {
  if (!layout.active || !layout.style || !layout.cssVars) return undefined
  return {
    ...buildProjectShellFrameColumnPresentationVars(),
    ...layout.cssVars,
    ...layout.style,
  }
}
