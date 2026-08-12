import assert from 'node:assert/strict'
import test from 'node:test'
import { generateRainfall } from './generateRainfall.js'
import { resolveSecondaryMaximumDegrees } from './prevailingWindField.js'

const params = {
  geographySeed: 42,
  width: 16,
  height: 16,
  prevailingWindDegrees: 90,
  secondaryMaximumDegrees: 180,
  elevation: new Float32Array(16 * 16).fill(0.5),
}

test('generateRainfall scales moisture when rainfallAmountScale differs from 1', () => {
  const baseline = generateRainfall({ ...params, options: { rainfallAmountScale: 1 } })
  const reduced = generateRainfall({ ...params, options: { rainfallAmountScale: 0.5 } })
  const increased = generateRainfall({ ...params, options: { rainfallAmountScale: 2 } })

  let sawReduction = false
  let sawIncrease = false
  for (let i = 0; i < baseline.length; i += 1) {
    assert.ok(reduced[i] <= baseline[i] + 1e-6)
    assert.ok(increased[i] >= baseline[i] - 1e-6)
    if (reduced[i] < baseline[i] - 1e-6) {
      sawReduction = true
    }
    if (increased[i] > baseline[i] + 1e-6) {
      sawIncrease = true
    }
    assert.ok(reduced[i] >= 0 && reduced[i] <= 1)
    assert.ok(increased[i] >= 0 && increased[i] <= 1)
  }
  assert.ok(sawReduction)
  assert.ok(sawIncrease)
})

test('generateRainfall preserves spatial pattern when rainfallAmountScale changes', () => {
  const baseline = generateRainfall({ ...params, options: { rainfallAmountScale: 1 } })
  const doubled = generateRainfall({ ...params, options: { rainfallAmountScale: 2 } })

  let wetIdx = -1
  let dryIdx = -1
  for (let i = 0; i < baseline.length; i += 1) {
    if (wetIdx < 0 && baseline[i] > 0.55) {
      wetIdx = i
    }
    if (dryIdx < 0 && baseline[i] < 0.45) {
      dryIdx = i
    }
  }
  assert.ok(wetIdx >= 0)
  assert.ok(dryIdx >= 0)
  assert.ok(doubled[wetIdx] > doubled[dryIdx])
})

function buildRidgeElevation(width, height, ridgeCol) {
  const elevation = new Float32Array(width * height).fill(0.45)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.abs(x - ridgeCol)
      elevation[y * width + x] = Math.max(0.3, 0.95 - distance * 0.08)
    }
  }
  return elevation
}

function totalAbsDiff(a, b) {
  let total = 0
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i])
  }
  return total
}

test('generateRainfall responds to prevailing wind direction over a ridge', () => {
  const width = 32
  const height = 32
  const elevation = buildRidgeElevation(width, height, 16)
  const ridgeParams = { geographySeed: 7, width, height, elevation }
  const westWind = generateRainfall({
    ...ridgeParams,
    prevailingWindDegrees: 270,
    secondaryMaximumDegrees: 0,
  })
  const eastWind = generateRainfall({
    ...ridgeParams,
    prevailingWindDegrees: 90,
    secondaryMaximumDegrees: 180,
  })
  assert.ok(totalAbsDiff(westWind, eastWind) > 1)
})

test('generateRainfall changes when secondary maximum bearing changes', () => {
  const width = 32
  const height = 32
  const elevation = buildRidgeElevation(width, height, 16)
  const base = {
    geographySeed: 7,
    width,
    height,
    elevation,
    prevailingWindDegrees: 270,
  }
  const linked = generateRainfall({ ...base, secondaryMaximumDegrees: 0 })
  const opposite = generateRainfall({ ...base, secondaryMaximumDegrees: 90 })
  assert.ok(totalAbsDiff(linked, opposite) > 0.5)
})

test('resolveSecondaryMaximumDegrees defaults missing secondary to prevailing plus 90', () => {
  assert.equal(resolveSecondaryMaximumDegrees(200), 290)
  assert.equal(resolveSecondaryMaximumDegrees(200, undefined), 290)
  assert.equal(resolveSecondaryMaximumDegrees(200, 45), 45)
})

test('generateRainfall rose differs from a prevailing-only schedule stand-in', () => {
  const width = 32
  const height = 32
  const elevation = buildRidgeElevation(width, height, 16)
  const prevailingWindDegrees = 270
  const rose = generateRainfall({
    geographySeed: 7,
    width,
    height,
    elevation,
    prevailingWindDegrees,
    secondaryMaximumDegrees: 0,
  })
  // Collapsing secondary onto prevailing still leaves scatter; forcing secondary
  // opposite of prevailing must move the field if the rose is averaged.
  const collapsed = generateRainfall({
    geographySeed: 7,
    width,
    height,
    elevation,
    prevailingWindDegrees,
    secondaryMaximumDegrees: prevailingWindDegrees,
  })
  assert.ok(totalAbsDiff(rose, collapsed) > 0.25)
})