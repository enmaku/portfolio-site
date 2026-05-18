import assert from 'node:assert/strict'
import test from 'node:test'
import { getDesktopPhoneFrameLayout } from './desktopPhoneFrame.js'
import {
  PROJECT_SHELL_DESKTOP_FRAME_BODY_CLASS,
  PROJECT_SHELL_FRAME_COLUMN_BORDER_RADIUS_PX,
  PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_COLOR,
  PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_WIDTH_PX,
  PROJECT_SHELL_FRAME_COLUMN_SURFACE_BOX_SHADOW,
  PROJECT_SHELL_FRAME_COLUMN_USES_HARDWARE_BEZEL,
  PROJECT_SHELL_FRAME_CSS_VAR,
  PROJECT_SHELL_FRAME_GUTTER_BG_CLASS,
  PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID,
  PROJECT_SHELL_FRAME_PORTAL_LAYER_CLASS,
  buildProjectShellFrameColumnPresentationVars,
  resolveProjectShellFrameColumnInlineStyle,
  resolveProjectShellFrameGutterInlineStyle,
  resolveProjectShellFramePortalElementId,
  resolveProjectShellOverlayPortalMount,
} from './projectShellFrame.js'

test('shell frame portal element id is stable', () => {
  assert.equal(PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID, 'project-shell-frame-portal')
})

test('shell frame portal layer class is stable', () => {
  assert.equal(PROJECT_SHELL_FRAME_PORTAL_LAYER_CLASS, 'project-shell__frame-portal')
})

test('shell desktop frame body class matches layout modifier', () => {
  assert.equal(PROJECT_SHELL_DESKTOP_FRAME_BODY_CLASS, 'project-shell--desktop-frame')
})

test('overlay portal mount resolves frame column id when framing is active', () => {
  const portal = { id: PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID }
  const doc = {
    getElementById: (id) => (id === PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID ? portal : null),
  }

  assert.equal(resolveProjectShellOverlayPortalMount(false, doc), null)
  assert.equal(resolveProjectShellOverlayPortalMount(true, doc), portal)
})

test('portal element id is set only when framing is active', () => {
  assert.equal(resolveProjectShellFramePortalElementId(false), undefined)
  assert.equal(
    resolveProjectShellFramePortalElementId(true),
    PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID,
  )
})

test('gutter inline style exposes css vars only when layout is active', () => {
  const inactive = getDesktopPhoneFrameLayout({
    viewportWidthPx: 800,
    viewportHeightPx: 900,
  })
  assert.equal(resolveProjectShellFrameGutterInlineStyle(inactive), undefined)

  const active = getDesktopPhoneFrameLayout({
    viewportWidthPx: 1280,
    viewportHeightPx: 900,
  })
  assert.deepEqual(resolveProjectShellFrameGutterInlineStyle(active), active.cssVars)
})

test('column inline style merges css vars and dimensions when active', () => {
  const inactive = getDesktopPhoneFrameLayout({
    viewportWidthPx: 800,
    viewportHeightPx: 900,
  })
  assert.equal(resolveProjectShellFrameColumnInlineStyle(inactive), undefined)

  const active = getDesktopPhoneFrameLayout({
    viewportWidthPx: 1280,
    viewportHeightPx: 900,
  })
  assert.deepEqual(resolveProjectShellFrameColumnInlineStyle(active), {
    ...buildProjectShellFrameColumnPresentationVars(),
    ...active.cssVars,
    ...active.style,
  })
})

test('frame column border radius stays within 12-16px spec', () => {
  assert.ok(PROJECT_SHELL_FRAME_COLUMN_BORDER_RADIUS_PX >= 12)
  assert.ok(PROJECT_SHELL_FRAME_COLUMN_BORDER_RADIUS_PX <= 16)
  assert.equal(PROJECT_SHELL_FRAME_COLUMN_BORDER_RADIUS_PX, 14)
})

test('gutter uses site dark page background class', () => {
  assert.equal(PROJECT_SHELL_FRAME_GUTTER_BG_CLASS, 'bg-dark-page')
})

test('column presentation vars expose border radius custom property', () => {
  const vars = buildProjectShellFrameColumnPresentationVars()
  assert.equal(
    vars[PROJECT_SHELL_FRAME_CSS_VAR.columnBorderRadius],
    `${PROJECT_SHELL_FRAME_COLUMN_BORDER_RADIUS_PX}px`,
  )
})

test('frame column surface is flat edge without hardware bezel art', () => {
  assert.equal(PROJECT_SHELL_FRAME_COLUMN_USES_HARDWARE_BEZEL, false)
})

test('column edge border stays a subtle 1px treatment', () => {
  assert.equal(PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_WIDTH_PX, 1)
  assert.match(PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_COLOR, /^rgba\(/)
})

test('column surface shadow is a soft elevation not a device bezel', () => {
  assert.match(PROJECT_SHELL_FRAME_COLUMN_SURFACE_BOX_SHADOW, /^0 \d+px \d+px rgba\(/)
})

test('column presentation vars expose subtle edge custom properties', () => {
  const vars = buildProjectShellFrameColumnPresentationVars()
  assert.equal(
    vars[PROJECT_SHELL_FRAME_CSS_VAR.columnEdgeBorderWidth],
    `${PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_WIDTH_PX}px`,
  )
  assert.equal(
    vars[PROJECT_SHELL_FRAME_CSS_VAR.columnEdgeBorderColor],
    PROJECT_SHELL_FRAME_COLUMN_EDGE_BORDER_COLOR,
  )
  assert.equal(
    vars[PROJECT_SHELL_FRAME_CSS_VAR.columnSurfaceBoxShadow],
    PROJECT_SHELL_FRAME_COLUMN_SURFACE_BOX_SHADOW,
  )
})
