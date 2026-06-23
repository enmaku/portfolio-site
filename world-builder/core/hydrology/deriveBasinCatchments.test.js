import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBasinCatchments, OCEAN_SINK } from './deriveBasinCatchments.js'

test('deriveBasinCatchments maps hillside cells into lake catchments', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.8)
  elevation[2 * width + 2] = 0.3
  elevation[2 * width + 1] = 0.5
  elevation[1 * width + 2] = 0.55

  const lakeMask = new Uint8Array(width * height)
  lakeMask[2 * width + 2] = 1

  const lakeIdByCell = new Int32Array(width * height).fill(-1)
  lakeIdByCell[2 * width + 2] = 0

  const { catchmentIndex, catchmentCellsByLake } = deriveBasinCatchments({
    elevation,
    lakeIdByCell,
    width,
    height,
    seaLevel: 0.2,
  })

  assert.equal(catchmentIndex[2 * width + 2], 0)
  assert.ok(catchmentCellsByLake[0].length >= 2)
  assert.equal(catchmentIndex[width * height - 1], OCEAN_SINK)
})
