import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'

test('buildDryLandTraversableMask excludes ocean, lake, and river corridor cells', () => {
  const width = 4
  const height = 4
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  elevation[0] = 0.1

  const doc = {
    gridWidth: width,
    gridHeight: height,
    lakeMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 5 ? 1 : 0)),
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 6 ? 1 : 0)),
    fields: { elevation },
  }

  const mask = buildDryLandTraversableMask(doc)
  assert.strictEqual(mask[0], 0)
  assert.strictEqual(mask[5], 0)
  assert.strictEqual(mask[6], 0)
  assert.strictEqual(mask[10], 1)
})
