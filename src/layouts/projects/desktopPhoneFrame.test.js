import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX,
  DESKTOP_PHONE_FRAME_CSS_VAR,
  DESKTOP_PHONE_FRAME_HORIZONTAL_GUTTER_PX,
  DESKTOP_PHONE_FRAME_MAX_HEIGHT_VIEWPORT_FRACTION,
  DESKTOP_PHONE_FRAME_MD_MIN_WIDTH_PX,
  DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH,
  buildDesktopPhoneFrameColumnStyle,
  buildDesktopPhoneFrameCssVars,
  getDesktopPhoneFrameLayout,
  isDesktopPhoneFrameBreakpointActive,
  resolveDesktopPhoneFrameColumnHeightPx,
  resolveDesktopPhoneFrameColumnWidthPx,
} from './desktopPhoneFrame.js'

const MIN_VIEWPORT_FOR_FULL_COLUMN_PX =
  DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX + 2 * DESKTOP_PHONE_FRAME_HORIZONTAL_GUTTER_PX

test('desktop phone frame spec constants', () => {
  assert.equal(DESKTOP_PHONE_FRAME_MD_MIN_WIDTH_PX, 1024)
  assert.equal(DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX, 390)
  assert.equal(DESKTOP_PHONE_FRAME_HORIZONTAL_GUTTER_PX, 24)
  assert.equal(DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH, 19.5 / 9)
  assert.equal(DESKTOP_PHONE_FRAME_MAX_HEIGHT_VIEWPORT_FRACTION, 0.9)
  assert.equal(MIN_VIEWPORT_FOR_FULL_COLUMN_PX, 438)
})

test('breakpoint is inactive below Quasar md', () => {
  assert.equal(isDesktopPhoneFrameBreakpointActive(1023), false)
})

test('breakpoint is active at Quasar md and above', () => {
  assert.equal(isDesktopPhoneFrameBreakpointActive(1024), true)
  assert.equal(isDesktopPhoneFrameBreakpointActive(1920), true)
})

test('layout is inactive below md', () => {
  const layout = getDesktopPhoneFrameLayout({
    viewportWidthPx: 800,
    viewportHeightPx: 900,
  })
  assert.equal(layout.active, false)
  assert.equal('columnWidthPx' in layout, false)
  assert.equal('style' in layout, false)
  assert.equal('cssVars' in layout, false)
})

test('column width is 390px when viewport fits column plus gutters', () => {
  assert.equal(
    resolveDesktopPhoneFrameColumnWidthPx(MIN_VIEWPORT_FOR_FULL_COLUMN_PX),
    DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX,
  )
  assert.equal(resolveDesktopPhoneFrameColumnWidthPx(1280), DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX)
})

test('column width shrinks by horizontal gutters when viewport is narrower', () => {
  const cramped = MIN_VIEWPORT_FOR_FULL_COLUMN_PX - 40
  assert.equal(
    resolveDesktopPhoneFrameColumnWidthPx(cramped),
    cramped - 2 * DESKTOP_PHONE_FRAME_HORIZONTAL_GUTTER_PX,
  )
  assert.equal(resolveDesktopPhoneFrameColumnWidthPx(0), 0)
})

test('column height uses aspect cap when viewport height is not yet known', () => {
  const width = 390
  const aspectCap = width * DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH
  assert.equal(resolveDesktopPhoneFrameColumnHeightPx(width, 0), Math.round(aspectCap))
})

test('active layout never yields zero column height at md', () => {
  const layout = getDesktopPhoneFrameLayout({
    viewportWidthPx: 1920,
    viewportHeightPx: 0,
  })
  assert.equal(layout.active, true)
  assert.ok(layout.columnHeightPx > 0)
  assert.notEqual(layout.style?.height, '0px')
})

test('column height is min(90% viewport height, width × 19.5/9)', () => {
  const width = 360
  const tallViewport = 2000
  const aspectCap = width * DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH
  assert.equal(
    resolveDesktopPhoneFrameColumnHeightPx(width, tallViewport),
    Math.round(aspectCap),
  )

  const shortViewport = 500
  const viewportCap = shortViewport * DESKTOP_PHONE_FRAME_MAX_HEIGHT_VIEWPORT_FRACTION
  assert.equal(
    resolveDesktopPhoneFrameColumnHeightPx(width, shortViewport),
    Math.round(Math.min(viewportCap, aspectCap)),
  )
})

test('active layout at md uses 390px width and capped height', () => {
  const layout = getDesktopPhoneFrameLayout({
    viewportWidthPx: 1280,
    viewportHeightPx: 900,
  })
  assert.equal(layout.active, true)
  assert.equal(layout.columnWidthPx, 390)
  const aspectCap = 390 * DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH
  assert.equal(layout.columnHeightPx, Math.round(Math.min(900 * 0.9, aspectCap)))
})

test('active layout at md boundary', () => {
  const layout = getDesktopPhoneFrameLayout({
    viewportWidthPx: DESKTOP_PHONE_FRAME_MD_MIN_WIDTH_PX,
    viewportHeightPx: 800,
  })
  assert.equal(layout.active, true)
  assert.equal(layout.columnWidthPx, DESKTOP_PHONE_FRAME_COLUMN_WIDTH_PX)
})

test('css vars expose shell custom properties with px dimensions', () => {
  const cssVars = buildDesktopPhoneFrameCssVars(360, 720)
  assert.equal(cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnWidth], '360px')
  assert.equal(cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnHeight], '720px')
  assert.equal(
    cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnMaxHeight],
    `min(90dvh, calc(360px * ${DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH}))`,
  )
})

test('column style mirrors css var width, height, and maxHeight', () => {
  const columnWidthPx = 320
  const columnHeightPx = 640
  const cssVars = buildDesktopPhoneFrameCssVars(columnWidthPx, columnHeightPx)
  const style = buildDesktopPhoneFrameColumnStyle(columnWidthPx, columnHeightPx)
  assert.equal(style.width, cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnWidth])
  assert.equal(style.height, cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnHeight])
  assert.equal(style.maxHeight, cssVars[DESKTOP_PHONE_FRAME_CSS_VAR.columnMaxHeight])
})

test('active layout exposes style and cssVars for shell binding', () => {
  const layout = getDesktopPhoneFrameLayout({
    viewportWidthPx: 1280,
    viewportHeightPx: 900,
  })
  assert.equal(layout.style?.width, '390px')
  assert.equal(layout.style?.height, `${layout.columnHeightPx}px`)
  assert.equal(
    layout.style?.maxHeight,
    `min(90dvh, calc(390px * ${DESKTOP_PHONE_FRAME_PORTRAIT_HEIGHT_PER_WIDTH}))`,
  )
  assert.deepEqual(layout.cssVars, buildDesktopPhoneFrameCssVars(390, layout.columnHeightPx))
})
