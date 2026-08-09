import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { computeLandCoastDistance } from '../grid/gridTopology.js'
import { isOceanCell } from './applyClosedIslandRim.js'
import {
  applyCoastDistanceBias,
  applySlopeDependentRoughness,
  computeSlopeField,
  reduceGentleSlopeHighFrequency,
  smoothMidLevelElevation,
} from './elevationPriors.js'
import { generateElevation } from './generateElevation.js'
import {
  DEFAULT_WORLD_GENERATION_OPTIONS,
  PRE_PRIORS_ELEVATION_OPTIONS,
} from '../worldGenerationOptions.js'
import { DEFAULT_GRID_SIZE } from '../types.js'
import { parseGeographySeedInput } from '../../worldBuilderPageModel.js'

const gridParams = { geographySeed: 4242, width: 64, height: 64 }

function meanElevation(indices, elevation) {
  if (indices.length === 0) return 0
  let sum = 0
  for (const idx of indices) {
    sum += elevation[idx]
  }
  return sum / indices.length
}

function reliefStdDev(elevation, indices) {
  if (indices.length < 2) return 0
  const mean = meanElevation(indices, elevation)
  let sumSq = 0
  for (const idx of indices) {
    const delta = elevation[idx] - mean
    sumSq += delta * delta
  }
  return Math.sqrt(sumSq / indices.length)
}

function landInteriorIndices(elevation, width, height, seaLevel = SEA_LEVEL) {
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const coastDistance = computeLandCoastDistance(elevation, width, height, seaLevel)
  const nearCoast = []
  const inland = []
  for (let i = 0; i < elevation.length; i += 1) {
    if (ocean[i]) continue
    if (coastDistance[i] <= 3) {
      nearCoast.push(i)
    } else if (coastDistance[i] >= 12) {
      inland.push(i)
    }
  }
  return { nearCoast, inland }
}

test('generateElevation is deterministic with elevation priors enabled', () => {
  const options = { ...DEFAULT_WORLD_GENERATION_OPTIONS }
  const first = generateElevation({ ...gridParams, options })
  const second = generateElevation({ ...gridParams, options })
  assert.deepStrictEqual(first, second)
})

test('domain warp changes elevation relief vs warp disabled', () => {
  const withWarp = generateElevation({
    ...gridParams,
    options: { ...DEFAULT_WORLD_GENERATION_OPTIONS, elevationDomainWarpStrength: 16 },
  })
  const withoutWarp = generateElevation({
    ...gridParams,
    options: { ...DEFAULT_WORLD_GENERATION_OPTIONS, elevationDomainWarpStrength: 0 },
  })
  let sameCount = 0
  for (let i = 0; i < withWarp.length; i += 1) {
    if (Math.abs(withWarp[i] - withoutWarp[i]) < 1e-6) {
      sameCount += 1
    }
  }
  assert.ok(sameCount < withWarp.length * 0.95)
})

test('coast-distance bias lowers near-coast land relative to inland', () => {
  const base = generateElevation({
    ...gridParams,
    options: PRE_PRIORS_ELEVATION_OPTIONS,
  })
  const biased = new Float32Array(base)
  const coastDistance = computeLandCoastDistance(biased, gridParams.width, gridParams.height, SEA_LEVEL)
  applyCoastDistanceBias(
    biased,
    coastDistance,
    gridParams.width,
    gridParams.height,
    SEA_LEVEL,
    0.14,
  )

  const { nearCoast, inland } = landInteriorIndices(biased, gridParams.width, gridParams.height)
  assert.ok(nearCoast.length > 0)
  assert.ok(inland.length > 0)

  const nearMean = meanElevation(nearCoast, biased)
  const inlandMean = meanElevation(inland, biased)
  const baseNearMean = meanElevation(nearCoast, base)
  const baseInlandMean = meanElevation(inland, base)
  const biasedGap = inlandMean - nearMean
  const baseGap = baseInlandMean - baseNearMean
  assert.ok(biasedGap > baseGap + 0.01)
})

test('mid-level smoothing reduces relief in mid elevations while preserving peaks', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height)
  for (let i = 0; i < elevation.length; i += 1) {
    elevation[i] = 0.52 + (i % 11) * 0.015
  }
  elevation[10 * width + 10] = 0.88
  const before = new Float32Array(elevation)
  smoothMidLevelElevation(elevation, width, height, SEA_LEVEL, 0.8, 0.78)

  const midIndices = []
  for (let i = 0; i < elevation.length; i += 1) {
    if (before[i] > SEA_LEVEL + 0.05 && before[i] < 0.72) {
      midIndices.push(i)
    }
  }
  assert.ok(midIndices.length > 0)
  assert.ok(
    reliefStdDev(elevation, midIndices) < reliefStdDev(before, midIndices),
    'mid-level relief should decrease',
  )
  assert.ok(Math.abs(elevation[10 * width + 10] - before[10 * width + 10]) < 1e-5)
})

function meanAbsDelta(indices, before, after) {
  if (indices.length === 0) return 0
  let sum = 0
  for (const idx of indices) {
    sum += Math.abs(after[idx] - before[idx])
  }
  return sum / indices.length
}

test('slope-dependent roughness adds more relief on steep cells than gentle cells', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.35)
  for (let x = 0; x < width; x += 1) {
    elevation[16 * width + x] = SEA_LEVEL + 0.2 + (x / width) * 0.45
  }
  const roughened = new Float32Array(elevation)
  applySlopeDependentRoughness(roughened, width, height, 99, 0.1)

  const gentleIndices = []
  const steepIndices = []
  for (let x = 1; x < width - 1; x += 1) {
    gentleIndices.push(8 * width + x)
    steepIndices.push(16 * width + x)
  }

  const gentleDelta = meanAbsDelta(gentleIndices, elevation, roughened)
  const steepDelta = meanAbsDelta(steepIndices, elevation, roughened)
  assert.ok(steepDelta > gentleDelta * 1.5)
  assert.ok(steepDelta > 0.001)
})

test('gentle-slope HF reduction lowers relief on low-slope cells', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(0.5)
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const idx = y * width + x
      elevation[idx] += Math.sin(x * 1.7) * 0.02 + Math.cos(y * 2.3) * 0.015
    }
  }
  for (let x = 0; x < width; x += 1) {
    elevation[16 * width + x] = 0.35 + (x / width) * 0.35
  }
  const before = new Float32Array(elevation)
  reduceGentleSlopeHighFrequency(elevation, width, height, 0.35)

  const slopes = computeSlopeField(before, width, height)
  const gentleIndices = []
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const idx = y * width + x
      if (y === 16) continue
      if (slopes[idx] < 0.015) gentleIndices.push(idx)
    }
  }

  assert.ok(gentleIndices.length > 32)
  assert.ok(
    reliefStdDev(elevation, gentleIndices) < reliefStdDev(before, gentleIndices) * 0.85,
    'gentle cells should lose high-frequency relief',
  )
})

test('computeLandCoastDistance completes on full grid without queue blow-up', () => {
  const seed = parseGeographySeedInput('4154732154')
  assert.ok(seed !== null)
  const elevation = generateElevation({
    geographySeed: seed,
    width: DEFAULT_GRID_SIZE,
    height: DEFAULT_GRID_SIZE,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      seaLevel: 0.38,
      elevationCoastBiasStrength: 0.14,
    },
  })
  const coastDistance = computeLandCoastDistance(
    elevation,
    DEFAULT_GRID_SIZE,
    DEFAULT_GRID_SIZE,
    0.38,
  )
  let finiteLandDistances = 0
  for (let i = 0; i < coastDistance.length; i += 1) {
    if (Number.isFinite(coastDistance[i]) && coastDistance[i] > 0) {
      finiteLandDistances += 1
    }
  }
  assert.ok(finiteLandDistances > 0)
})

test('default elevation priors widen inland-coastal elevation gap vs pre-priors baseline', () => {
  const withPriors = generateElevation({ ...gridParams, options: DEFAULT_WORLD_GENERATION_OPTIONS })
  const withoutPriors = generateElevation({ ...gridParams, options: PRE_PRIORS_ELEVATION_OPTIONS })

  const { nearCoast: nearWith, inland: inlandWith } = landInteriorIndices(
    withPriors,
    gridParams.width,
    gridParams.height,
  )
  const { nearCoast: nearWithout, inland: inlandWithout } = landInteriorIndices(
    withoutPriors,
    gridParams.width,
    gridParams.height,
  )

  assert.ok(nearWith.length > 0 && inlandWith.length > 0)
  const gapWith = meanElevation(inlandWith, withPriors) - meanElevation(nearWith, withPriors)
  const gapWithout =
    meanElevation(inlandWithout, withoutPriors) - meanElevation(nearWithout, withoutPriors)
  assert.ok(gapWith > gapWithout + 0.005)
})
