import assert from 'node:assert/strict'
import test from 'node:test'
import { computeMoistureAdvection } from './computeMoistureAdvection.js'

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
