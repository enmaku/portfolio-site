import assert from 'node:assert/strict'
import test from 'node:test'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import {
  connectNearbyRiverCorridors,
} from './connectNearbyRiverCorridors.js'

test('connectNearbyRiverCorridors is a no-op when radius is zero', () => {
  const mask = new Uint8Array([1, 0, 0, 1])
  const elevation = new Float32Array([0.6, 0.55, 0.55, 0.6])
  const ocean = [false, false, false, false]
  const connected = connectNearbyRiverCorridors({
    riverNetworkMask: mask,
    elevation,
    ocean,
    width: 2,
    height: 2,
    attractionRadius: 0,
  })
  assert.strictEqual(connected, mask)
})

test('connectNearbyRiverCorridors links nearby components through a low saddle', () => {
  const width = 16
  const height = 16
  const mask = new Uint8Array(width * height)
  for (let x = 2; x <= 5; x += 1) {
    mask[4 * width + x] = 1
    mask[11 * width + x] = 1
  }

  const elevation = new Float32Array(width * height).fill(0.72)
  for (let y = 6; y <= 9; y += 1) {
    for (let x = 6; x <= 9; x += 1) {
      elevation[y * width + x] = 0.45
    }
  }

  const { ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(0.5),
  })

  const connected = connectNearbyRiverCorridors({
    riverNetworkMask: mask,
    elevation,
    ocean,
    width,
    height,
    attractionRadius: 8,
  })

  assert.ok(countMarked(connected) > countMarked(mask))
  assert.strictEqual(componentCount(connected, width, height), 1)
  assert.strictEqual(componentCount(mask, width, height), 2)
})

test('connectNearbyRiverCorridors meanders instead of cutting straight across', () => {
  const width = 32
  const height = 32
  const mask = new Uint8Array(width * height)
  for (let x = 4; x <= 8; x += 1) {
    mask[8 * width + x] = 1
    mask[22 * width + x] = 1
  }

  const elevation = new Float32Array(width * height).fill(0.78)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wave = 0.06 * Math.sin((2 * Math.PI * x) / 10 + y * 0.18)
      elevation[y * width + x] = 0.72 + wave + Math.abs(y - 15) * 0.004
    }
  }

  const { ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall: new Float32Array(width * height).fill(0.5),
  })
  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let x = 4; x < 8; x += 1) {
    flowDirection[8 * width + x] = 4
    flowDirection[22 * width + x] = 4
  }

  const connected = connectNearbyRiverCorridors({
    riverNetworkMask: mask,
    elevation,
    ocean,
    width,
    height,
    flowDirection,
    attractionRadius: 18,
    geographySeed: 4242,
  })

  const bridgeCells = collectBridgeCells(mask, connected)
  assert.ok(bridgeCells.length > 0)
  const maxDeviation = maxLateralDeviation(bridgeCells, 6, 8, 6, 22, width)
  assert.ok(
    maxDeviation >= 2,
    `expected meandering bridge, max lateral deviation=${maxDeviation.toFixed(2)}`,
  )
})
test('connectNearbyRiverCorridors merges tributaries at acute angles', () => {
  const width = 32
  const height = 32
  const mask = new Uint8Array(width * height)
  for (let x = 6; x <= 24; x += 1) {
    mask[16 * width + x] = 1
  }
  for (let y = 4; y <= 13; y += 1) {
    mask[y * width + 12] = 1
  }

  const elevation = new Float32Array(width * height).fill(0.72)
  const ocean = isOceanCell(elevation, width, height)
  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let x = 6; x < 24; x += 1) {
    flowDirection[16 * width + x] = 4
  }
  for (let y = 4; y < 13; y += 1) {
    flowDirection[y * width + 12] = 6
  }

  const connected = connectNearbyRiverCorridors({
    riverNetworkMask: mask,
    elevation,
    ocean,
    width,
    height,
    flowDirection,
    attractionRadius: 8,
    geographySeed: 9001,
  })

  const junctionIdx = 16 * width + 12
  assert.strictEqual(connected[junctionIdx], 1)
  const mergeAngle = tributaryMergeAngleAtJunction(connected, junctionIdx, flowDirection, width)
  assert.ok(
    mergeAngle >= 20 && mergeAngle <= 70,
    `expected acute tributary junction, merge angle=${mergeAngle.toFixed(1)}°`,
  )
})
test('connectNearbyRiverCorridors does not connect parallel coastal rivers', () => {
  const width = 32
  const height = 32
  const mask = new Uint8Array(width * height)
  for (let x = 2; x <= 14; x += 1) {
    mask[10 * width + x] = 1
    mask[12 * width + x] = 1
  }

  const elevation = new Float32Array(width * height).fill(0.72)
  for (let x = 0; x < width; x += 1) {
    elevation[10 * width + x] = 0.55 - x * 0.002
    elevation[12 * width + x] = 0.55 - x * 0.002
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 15; x < width; x += 1) {
      elevation[y * width + x] = 0.35
    }
  }

  const ocean = new Array(width * height).fill(false)
  for (let y = 0; y < height; y += 1) {
    for (let x = 15; x < width; x += 1) {
      ocean[y * width + x] = true
    }
  }

  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let x = 2; x < 14; x += 1) {
    flowDirection[10 * width + x] = 4
    flowDirection[12 * width + x] = 4
  }

  const connected = connectNearbyRiverCorridors({
    riverNetworkMask: mask,
    elevation,
    ocean,
    width,
    height,
    flowDirection,
    attractionRadius: 10,
    geographySeed: 77,
  })

  assert.strictEqual(countMarked(connected), countMarked(mask))
})

test('connectNearbyRiverCorridors does not bridge already-connected rivers', () => {
  const width = 8
  const height = 8
  const mask = new Uint8Array(width * height)
  for (let x = 1; x <= 6; x += 1) {
    mask[4 * width + x] = 1
  }
  const elevation = new Float32Array(width * height).fill(0.6)
  const ocean = isOceanCell(elevation, width, height)

  const connected = connectNearbyRiverCorridors({
    riverNetworkMask: mask,
    elevation,
    ocean,
    width,
    height,
    attractionRadius: 12,
  })

  assert.strictEqual(countMarked(connected), countMarked(mask))
})

/**
 * @param {Uint8Array} mask
 */
function countMarked(mask) {
  let count = 0
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) count += 1
  }
  return count
}

/**
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 */
function componentCount(mask, width, height) {
  const labels = new Int32Array(mask.length).fill(-1)
  let count = 0
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx] || labels[idx] >= 0) continue
    /** @type {number[]} */
    const stack = [idx]
    labels[idx] = count
    while (stack.length > 0) {
      const current = stack.pop()
      const x = current % width
      const y = Math.floor(current / width)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIdx = ny * width + nx
          if (!mask[nIdx] || labels[nIdx] >= 0) continue
          labels[nIdx] = count
          stack.push(nIdx)
        }
      }
    }
    count += 1
  }
  return count
}

/**
 * @param {Uint8Array} before
 * @param {Uint8Array} after
 */
function collectBridgeCells(before, after) {
  /** @type {number[]} */
  const bridge = []
  for (let idx = 0; idx < after.length; idx += 1) {
    if (!after[idx] || before[idx]) continue
    bridge.push(idx)
  }
  return bridge
}

/**
 * @param {number[]} cells
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} width
 */
function maxLateralDeviation(cells, x1, y1, x2, y2, width) {
  let maxDist = 0
  for (const idx of cells) {
    const x = idx % width
    const y = Math.floor(idx / width)
    const dist = pointToSegmentDistance(x, y, x1, y1, x2, y2)
    if (dist > maxDist) maxDist = dist
  }
  return maxDist
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.hypot(px - projX, py - projY)
}

/**
 * @param {Uint8Array} mask
 * @param {number} idx
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 */
function tributaryMergeAngleAtJunction(mask, idx, flowDirection, width) {
  const height = mask.length / width
  const trunkFlow = riverTangentFromDirection(idx, flowDirection)
  if (!trunkFlow) return 90

  const x = idx % width
  const y = Math.floor(idx / width)
  let bestAngle = 180
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (!mask[ny * width + nx]) continue
      const len = Math.hypot(dx, dy)
      const incoming = { x: -dx / len, y: -dy / len }
      const alignment = Math.abs(incoming.x * trunkFlow.x + incoming.y * trunkFlow.y)
      if (alignment > 0.75) continue
      const angle = (Math.acos(
        Math.max(-1, Math.min(1, incoming.x * trunkFlow.x + incoming.y * trunkFlow.y)),
      ) * 180) / Math.PI
      if (angle < bestAngle) bestAngle = angle
    }
  }
  return bestAngle
}

/**
 * @param {number} idx
 * @param {Int16Array} flowDirection
 */
function riverTangentFromDirection(idx, flowDirection) {
  const dir = flowDirection[idx]
  if (dir < 0) return null
  const offsets = [
    [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
  ]
  const [dx, dy] = offsets[dir]
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}
