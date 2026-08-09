import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'

const LEGACY_COAST_DISTANCE_ORTH = 1
const LEGACY_COAST_DISTANCE_DIAG = 1.41421356237

/**
 * Pre-extraction chamfer coast distance from elevationPriors (slice #316 baseline).
 */
function legacyComputeLandCoastDistance(elevation, width, height, seaLevel) {
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const distances = new Float32Array(width * height)

  for (let i = 0; i < elevation.length; i += 1) {
    distances[i] = ocean[i] ? 0 : Number.POSITIVE_INFINITY
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (ocean[idx]) continue

      let best = distances[idx]
      if (x > 0) {
        best = Math.min(best, distances[idx - 1] + LEGACY_COAST_DISTANCE_ORTH)
      }
      if (y > 0) {
        best = Math.min(best, distances[idx - width] + LEGACY_COAST_DISTANCE_ORTH)
      }
      if (x > 0 && y > 0) {
        best = Math.min(best, distances[idx - width - 1] + LEGACY_COAST_DISTANCE_DIAG)
      }
      if (x < width - 1 && y > 0) {
        best = Math.min(best, distances[idx - width + 1] + LEGACY_COAST_DISTANCE_DIAG)
      }
      distances[idx] = best
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const idx = y * width + x
      if (ocean[idx]) continue

      let best = distances[idx]
      if (x < width - 1) {
        best = Math.min(best, distances[idx + 1] + LEGACY_COAST_DISTANCE_ORTH)
      }
      if (y < height - 1) {
        best = Math.min(best, distances[idx + width] + LEGACY_COAST_DISTANCE_ORTH)
      }
      if (x < width - 1 && y < height - 1) {
        best = Math.min(best, distances[idx + width + 1] + LEGACY_COAST_DISTANCE_DIAG)
      }
      if (x > 0 && y < height - 1) {
        best = Math.min(best, distances[idx + width - 1] + LEGACY_COAST_DISTANCE_DIAG)
      }
      distances[idx] = best
    }
  }

  return distances
}

/** Pre-extraction max-abs-delta slope from generateArableRaster. */
function legacyLocalSlopeMaxAbsDelta(elevation, x, y, width, height) {
  const idx = y * width + x
  const center = elevation[idx]
  let maxDelta = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const delta = Math.abs(elevation[ny * width + nx] - center)
      if (delta > maxDelta) maxDelta = delta
    }
  }
  return maxDelta
}

/** Pre-extraction downhill slope from computeHydrologyMetrics. */
function legacyLocalSlopeMaxDropPerDistance(idx, elevation, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  const center = elevation[idx]
  let maxDrop = 0

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const neighbor = elevation[ny * width + nx]
      const drop = center - neighbor
      const distance = Math.hypot(dx, dy)
      maxDrop = Math.max(maxDrop, drop / distance)
    }
  }

  return Math.max(maxDrop, 0)
}

function buildCoastSlopeFixture() {
  const width = 11
  const height = 9
  const elevation = new Float32Array(width * height).fill(0.7)
  for (let x = 0; x < width; x += 1) {
    elevation[x] = 0.15
    elevation[(height - 1) * width + x] = 0.18
  }
  for (let y = 1; y < height - 1; y += 1) {
    elevation[y * width] = 0.2
    elevation[y * width + width - 1] = 0.2
  }
  elevation[4 * width + 5] = 0.92
  elevation[4 * width + 6] = 0.55
  elevation[3 * width + 5] = 0.48
  return { elevation, width, height }
}
import {
  cellDistance,
  cellIndex,
  cellX,
  cellY,
  clamp01,
  collectConnectedComponents,
  computeLandCoastDistance,
  forEachCell,
  forEachNeighbor4,
  isInBounds,
  labelConnectedComponents,
  localSlopeMaxAbsDelta,
  localSlopeMaxDropPerDistance,
  manhattanAdjacent,
} from './gridTopology.js'

test('cellIndex and cellX/cellY round-trip bounded coordinates', () => {
  const width = 16
  const idx = cellIndex(5, 7, width)
  assert.strictEqual(idx, 7 * width + 5)
  assert.strictEqual(cellX(idx, width), 5)
  assert.strictEqual(cellY(idx, width), 7)
})

test('isInBounds rejects out-of-range coordinates', () => {
  assert.strictEqual(isInBounds(0, 0, 8, 8), true)
  assert.strictEqual(isInBounds(7, 7, 8, 8), true)
  assert.strictEqual(isInBounds(-1, 0, 8, 8), false)
  assert.strictEqual(isInBounds(8, 0, 8, 8), false)
})

test('forEachCell visits every cell in row-major order', () => {
  const width = 3
  const height = 2
  const visited = []
  forEachCell(width, height, (x, y, idx) => {
    visited.push([x, y, idx])
  })
  assert.deepStrictEqual(visited, [
    [0, 0, 0],
    [1, 0, 1],
    [2, 0, 2],
    [0, 1, 3],
    [1, 1, 4],
    [2, 1, 5],
  ])
})

test('forEachNeighbor4 visits only in-bounds orthogonal neighbors', () => {
  const width = 4
  const height = 4
  const visited = []
  forEachNeighbor4(0, 0, width, height, (nx, ny, nIdx) => {
    visited.push([nx, ny, nIdx])
  })
  assert.deepStrictEqual(
    visited,
    [
      [1, 0, 1],
      [0, 1, width],
    ],
  )
})

test('collectConnectedComponents finds 4-connected mask regions', () => {
  const width = 5
  const height = 4
  const mask = new Uint8Array(width * height)
  mask[cellIndex(1, 1, width)] = 1
  mask[cellIndex(2, 1, width)] = 1
  mask[cellIndex(3, 3, width)] = 1

  const components = collectConnectedComponents(mask, width, height, 4)
  assert.strictEqual(components.length, 2)
  assert.deepStrictEqual(components[0].sort((a, b) => a - b), [6, 7])
  assert.deepStrictEqual(components[1], [18])
})

test('labelConnectedComponents assigns stable component ids', () => {
  const width = 4
  const height = 4
  const mask = new Uint8Array(width * height)
  mask[5] = 1
  mask[6] = 1
  mask[15] = 1

  const { labels, componentCount } = labelConnectedComponents(mask, width, height, 4)
  assert.strictEqual(componentCount, 2)
  assert.strictEqual(labels[5], labels[6])
  assert.notStrictEqual(labels[5], labels[15])
})

test('computeLandCoastDistance increases inland from a coast', () => {
  const width = 9
  const height = 7
  const elevation = new Float32Array(width * height).fill(0.7)
  for (let x = 0; x < width; x += 1) {
    elevation[x] = 0.2
  }

  const coastDistance = computeLandCoastDistance(elevation, width, height, SEA_LEVEL)
  const ocean = isOceanCell(elevation, width, height, SEA_LEVEL)

  let inlandIdx = -1
  for (let y = 1; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const idx = cellIndex(x, y, width)
    if (!ocean[idx]) {
      inlandIdx = idx
      break
    }
  }
    if (inlandIdx >= 0) break
  }

  const coastIdx = cellIndex(4, 0, width)
  assert.ok(coastDistance[inlandIdx] > coastDistance[coastIdx])
})

test('localSlopeMaxAbsDelta and localSlopeMaxDropPerDistance agree on flat terrain', () => {
  const width = 6
  const height = 6
  const elevation = new Float32Array(width * height).fill(0.5)
  const idx = cellIndex(3, 3, width)
  assert.strictEqual(localSlopeMaxAbsDelta(elevation, 3, 3, width, height), 0)
  assert.strictEqual(localSlopeMaxDropPerDistance(elevation, idx, width, height), 0)
})

test('manhattanAdjacent and cellDistance describe orthogonal neighbors', () => {
  const width = 10
  const fromIdx = cellIndex(4, 4, width)
  const toIdx = cellIndex(5, 4, width)
  assert.strictEqual(manhattanAdjacent(fromIdx, toIdx, width), true)
  assert.strictEqual(cellDistance(fromIdx, toIdx, width), 1)
})

test('clamp01 clamps to the unit interval', () => {
  assert.strictEqual(clamp01(-0.2), 0)
  assert.strictEqual(clamp01(1.4), 1)
  assert.strictEqual(clamp01(0.42), 0.42)
})

test('computeLandCoastDistance matches pre-extraction chamfer on fixed fixture', () => {
  const { elevation, width, height } = buildCoastSlopeFixture()
  const legacy = legacyComputeLandCoastDistance(elevation, width, height, SEA_LEVEL)
  const extracted = computeLandCoastDistance(elevation, width, height, SEA_LEVEL)

  assert.strictEqual(legacy.length, extracted.length)
  for (let i = 0; i < legacy.length; i += 1) {
    assert.ok(
      Math.abs(legacy[i] - extracted[i]) < 1e-9,
      `coast distance mismatch at cell ${i}: legacy=${legacy[i]} extracted=${extracted[i]}`,
    )
  }
})

test('localSlopeMaxAbsDelta matches pre-extraction arable slope helper on fixed fixture', () => {
  const { elevation, width, height } = buildCoastSlopeFixture()

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const legacy = legacyLocalSlopeMaxAbsDelta(elevation, x, y, width, height)
      const extracted = localSlopeMaxAbsDelta(elevation, x, y, width, height)
      assert.strictEqual(extracted, legacy)
    }
  }
})

test('localSlopeMaxDropPerDistance matches pre-extraction hydrology slope helper on fixed fixture', () => {
  const { elevation, width, height } = buildCoastSlopeFixture()

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = cellIndex(x, y, width)
      const legacy = legacyLocalSlopeMaxDropPerDistance(idx, elevation, width, height)
      const extracted = localSlopeMaxDropPerDistance(elevation, idx, width, height)
      assert.strictEqual(extracted, legacy)
    }
  }
})
