import assert from 'node:assert/strict'
import test from 'node:test'
import { generatePhysicalTerrainBaseline } from '../generatePhysicalTerrainBaseline.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../core/worldGenerationOptions.js'
import { computeMoistureAdvection } from './computeMoistureAdvection.js'

const REPRESENTATIVE_GEOGRAPHY_SEEDS = [12345, 31842, DEFAULT_GEOGRAPHY_SEED]

function rasterChecksum(arr, stride = 97) {
  let checksum = 0
  for (let i = 0; i < arr.length; i += stride) {
    checksum = (checksum + Math.round(arr[i] * 1e6) * (i + 1)) % 2147483647
  }
  return checksum
}

const ADVECTION_GOLDEN_CHECKSUMS = new Map([
  [12345, 104894547],
  [31842, 1257282474],
  [DEFAULT_GEOGRAPHY_SEED, 1252986939],
])

function buildIsland(width, height, landColStart, landColEnd) {
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = landColStart; x <= landColEnd; x += 1) {
      elevation[y * width + x] = 0.6
    }
  }
  return elevation
}

test('computeMoistureAdvection makes the windward coast wetter than the interior', () => {
  const width = 24
  const height = 6
  const landColStart = 6
  const landColEnd = 17
  const elevation = buildIsland(width, height, landColStart, landColEnd)
  const row = 3

  const westWind = computeMoistureAdvection({
    elevation,
    width,
    height,
    prevailingWindDegrees: 270,
  })

  const westEdge = row * width + landColStart
  const interior = row * width + Math.round((landColStart + landColEnd) / 2)

  assert.ok(westWind[westEdge] > westWind[interior])
})

test('rotating the wind 180 degrees swaps which coast is wetter', () => {
  const width = 24
  const height = 6
  const landColStart = 6
  const landColEnd = 17
  const elevation = buildIsland(width, height, landColStart, landColEnd)
  const row = 3
  const westEdge = row * width + landColStart
  const eastEdge = row * width + landColEnd

  const westWind = computeMoistureAdvection({
    elevation,
    width,
    height,
    prevailingWindDegrees: 270,
  })
  const eastWind = computeMoistureAdvection({
    elevation,
    width,
    height,
    prevailingWindDegrees: 90,
  })

  assert.ok(westWind[westEdge] > westWind[eastEdge])
  assert.ok(eastWind[eastEdge] > eastWind[westEdge])
})

test('computeMoistureAdvection is deterministic for the same inputs', () => {
  const width = 16
  const height = 8
  const elevation = buildIsland(width, height, 4, 11)
  const params = {
    elevation,
    width,
    height,
    prevailingWindDegrees: 225,
  }

  const first = computeMoistureAdvection(params)
  const second = computeMoistureAdvection(params)
  assert.deepStrictEqual(Array.from(first), Array.from(second))
})

test('computeMoistureAdvection preserves golden checksums for representative seeds', () => {
  for (const geographySeed of REPRESENTATIVE_GEOGRAPHY_SEEDS) {
    const width = 64
    const height = 64
    const doc = generatePhysicalTerrainBaseline({
      geographySeed,
      prevailingWindDegrees: 90,
      width,
      height,
    })
    const advection = computeMoistureAdvection({
      elevation: doc.fields.elevation,
      width,
      height,
      prevailingWindDegrees: 90,
    })
    assert.strictEqual(
      rasterChecksum(advection),
      ADVECTION_GOLDEN_CHECKSUMS.get(geographySeed),
      `advection checksum drift for seed ${geographySeed}`,
    )
  }
})
