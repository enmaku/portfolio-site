import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../core/biomeIds.js'
import { buildTopographyContourCanvas } from './buildTopographyContourCanvas.js'

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function elevatedIslandDocument() {
  const gridWidth = 16
  const gridHeight = 16
  const elevation = new Float32Array(gridWidth * gridHeight).fill(0.25)
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const dx = x - 8
      const dy = y - 8
      const distance = Math.hypot(dx, dy)
      if (distance < 6) {
        elevation[y * gridWidth + x] = SEA_LEVEL + 0.1 + ((6 - distance) / 6) * 0.35
      }
    }
  }

  return {
    gridWidth,
    gridHeight,
    biomes: new Uint8Array(gridWidth * gridHeight),
    fields: { elevation },
  }
}

test('buildTopographyContourCanvas returns null for flat submerged terrain', () => {
  const doc = {
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16),
    fields: { elevation: new Float32Array(16).fill(0.2) },
  }

  assert.strictEqual(buildTopographyContourCanvas(doc), null)
})

test('buildTopographyContourCanvas throws when canvas context is unavailable', () => {
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

  assert.throws(
    () => buildTopographyContourCanvas(elevatedIslandDocument()),
    /Could not acquire 2D canvas context/,
  )

  delete globalThis.document
})

test('buildTopographyContourCanvas returns sized canvas for elevated land', () => {
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            beginPath() {},
            moveTo() {},
            lineTo() {},
            stroke() {},
          }
        },
      }
    },
  }

  const doc = elevatedIslandDocument()
  const canvas = buildTopographyContourCanvas(doc)

  assert.ok(canvas)
  assert.strictEqual(canvas.width, doc.gridWidth)
  assert.strictEqual(canvas.height, doc.gridHeight)

  delete globalThis.document
})
