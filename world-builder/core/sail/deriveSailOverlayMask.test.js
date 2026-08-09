import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { deriveSailOverlayMask } from './deriveSailOverlayMask.js'

/**
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} fromIdx
 * @param {number} toIdx
 */
function hasEightConnectedPath(mask, width, fromIdx, toIdx) {
  if (!mask[fromIdx] || !mask[toIdx]) return false
  const height = mask.length / width
  const visited = new Uint8Array(mask.length)
  /** @type {number[]} */
  const queue = [fromIdx]
  visited[fromIdx] = 1
  const offsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ]

  while (queue.length > 0) {
    const idx = queue.shift()
    if (idx === toIdx) return true
    const x = idx % width
    const y = Math.floor(idx / width)
    for (const [dx, dy] of offsets) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (visited[nIdx] || !mask[nIdx]) continue
      visited[nIdx] = 1
      queue.push(nIdx)
    }
  }
  return false
}

test('deriveSailOverlayMask connects nearby waterways separated by a one-cell land gap', () => {
  const width = 7
  const height = 5
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  for (let x = 0; x < width; x += 1) {
    elevation[x] = 0.2
  }
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[2 * width + 2] = 1
  riverCorridorMask[2 * width + 4] = 1

  const mask = deriveSailOverlayMask({
    elevation,
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    gridWidth: width,
    gridHeight: height,
    seaLevel: SEA_LEVEL,
  })

  assert.ok(
    hasEightConnectedPath(mask, width, 2 * width + 2, 2 * width + 4),
    'sail overlay should bridge the corridor gap',
  )
})

test('deriveSailOverlayMask includes waterfront sliver beyond raw water union cells', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  const riverCorridorMask = new Uint8Array(cellCount)
  const corridorIdx = 2 * width + 2
  riverCorridorMask[corridorIdx] = 1

  const mask = deriveSailOverlayMask({
    elevation,
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    gridWidth: width,
    gridHeight: height,
    seaLevel: SEA_LEVEL,
  })

  assert.ok(mask[corridorIdx] === 1)
  const waterfrontNeighbor = corridorIdx + 1
  assert.equal(riverCorridorMask[waterfrontNeighbor], 0)
  assert.ok(mask[waterfrontNeighbor] === 1, 'waterfront sliver should extend onto adjacent land')
})
