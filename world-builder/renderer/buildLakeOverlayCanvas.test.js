import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLakeOverlayCanvas, buildLakeOverlayRgba } from './buildLakeOverlayCanvas.js'

test('buildLakeOverlayRgba returns null when lakeMask is missing or empty', () => {
  assert.strictEqual(buildLakeOverlayRgba(undefined, 4, 4), null)
  assert.strictEqual(buildLakeOverlayRgba(new Uint8Array(16), 4, 4), null)
})

test('buildLakeOverlayRgba fills lake cells with semi-transparent blue', () => {
  const lakeMask = new Uint8Array(16)
  lakeMask[6] = 1
  lakeMask[7] = 1
  lakeMask[10] = 1

  const rgba = buildLakeOverlayRgba(lakeMask, 4, 4)
  assert.ok(rgba)

  assert.strictEqual(rgba[6 * 4 + 3], 64)
  assert.strictEqual(rgba[7 * 4], 0x3a)
  assert.strictEqual(rgba[10 * 4 + 1], 0x8f)
  assert.strictEqual(rgba[0 * 4 + 3], 0)
})

test('buildLakeOverlayRgba uses one rgba buffer for large connected lake regions', () => {
  const width = 32
  const height = 32
  const lakeMask = new Uint8Array(width * height)
  for (let y = 8; y < 24; y += 1) {
    for (let x = 8; x < 24; x += 1) {
      lakeMask[y * width + x] = 1
    }
  }

  const rgba = buildLakeOverlayRgba(lakeMask, width, height)
  assert.ok(rgba)
  assert.strictEqual(rgba.length, width * height * 4)

  let lakePixels = 0
  for (let i = 0; i < lakeMask.length; i += 1) {
    if (rgba[i * 4 + 3] > 0) lakePixels += 1
  }
  assert.strictEqual(lakePixels, 16 * 16)
})

test('buildLakeOverlayCanvas returns null when lakeMask has no lake cells', () => {
  assert.strictEqual(buildLakeOverlayCanvas(new Uint8Array(16), 4, 4), null)
})

test('buildLakeOverlayCanvas returns sized canvas for lake cells', () => {
  globalThis.ImageData = class {
    constructor() {}
  }
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            putImageData() {},
          }
        },
      }
    },
  }

  const lakeMask = new Uint8Array(16)
  lakeMask[5] = 1
  const canvas = buildLakeOverlayCanvas(lakeMask, 4, 4)

  assert.ok(canvas)
  assert.strictEqual(canvas.width, 4)
  assert.strictEqual(canvas.height, 4)

  delete globalThis.document
  delete globalThis.ImageData
})

test('buildLakeOverlayCanvas throws when canvas context is unavailable', () => {
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return null
        },
      }
    },
  }

  const lakeMask = new Uint8Array(16)
  lakeMask[0] = 1
  assert.throws(
    () => buildLakeOverlayCanvas(lakeMask, 4, 4),
    /Could not acquire 2D canvas context for lake overlay/,
  )

  delete globalThis.document
})
