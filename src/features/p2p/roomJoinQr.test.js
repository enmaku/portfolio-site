import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ROOM_JOIN_QR_BORDER_MODULES,
  buildRoomJoinQrDataUrl,
} from './roomJoinQr.js'

const SAMPLE_URL = 'https://focusdisorder.com/projects/game-timer?room=AB12CD'

/** Decode the inline SVG back out of the data URL. */
function decodeSvg(dataUrl) {
  const prefix = 'data:image/svg+xml;charset=utf-8,'
  assert.ok(dataUrl.startsWith(prefix), 'data URL uses the svg+xml prefix')
  return decodeURIComponent(dataUrl.slice(prefix.length))
}

test('buildRoomJoinQrDataUrl encodes the join link as an inline SVG', () => {
  const svg = decodeSvg(buildRoomJoinQrDataUrl(SAMPLE_URL))

  assert.match(svg, /^<svg /)
  assert.match(svg, /viewBox="0 0 \d+ \d+"/)
  assert.match(svg, /fill="#000000"/)
  assert.match(svg, /fill="#ffffff"/)
})

test('buildRoomJoinQrDataUrl returns an empty string without a URL', () => {
  assert.equal(buildRoomJoinQrDataUrl(''), '')
  assert.equal(buildRoomJoinQrDataUrl(undefined), '')
})

test('buildRoomJoinQrDataUrl keeps a light quiet zone so codes scan in the dark theme', () => {
  const svg = decodeSvg(buildRoomJoinQrDataUrl(SAMPLE_URL))

  // A white background rect must cover the full viewBox; the dark theme must not invert it.
  assert.match(svg, /^<svg [^>]*viewBox="0 0 (\d+) \1"><rect fill="#ffffff" width="\1" height="\1"\/>/)
})

test('buildRoomJoinQrDataUrl scales module size without changing the encoded payload', () => {
  const small = decodeSvg(buildRoomJoinQrDataUrl(SAMPLE_URL, { pixelSize: 4 }))
  const large = decodeSvg(buildRoomJoinQrDataUrl(SAMPLE_URL, { pixelSize: 12 }))
  const viewBoxOf = (svg) => Number(/viewBox="0 0 (\d+) /.exec(svg)[1])

  assert.ok(viewBoxOf(large) > viewBoxOf(small))
  // Same module count → same payload; only the scale differs.
  assert.equal(viewBoxOf(large) % viewBoxOf(small), 0)
})

test('buildRoomJoinQrDataUrl honours a custom quiet-zone border', () => {
  const defaultBorder = decodeSvg(buildRoomJoinQrDataUrl(SAMPLE_URL))
  const zeroBorder = decodeSvg(buildRoomJoinQrDataUrl(SAMPLE_URL, { border: 0 }))
  const widthOf = (svg) => Number(/viewBox="0 0 (\d+) /.exec(svg)[1])
  const moduleSize = 8

  assert.equal(
    widthOf(defaultBorder) - widthOf(zeroBorder),
    ROOM_JOIN_QR_BORDER_MODULES * 2 * moduleSize,
  )
})
