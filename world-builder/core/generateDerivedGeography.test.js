import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES_COUNT } from './biomeIds.js'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import { generatePhysicalTerrainBaseline } from './generatePhysicalTerrainBaseline.js'
import { assertLakeMaskSurfacesMatchMeta } from './hydrology/lakeDisplayCoherence.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../worldBuilderPageModel.js'
import { DEFAULT_GRID_SIZE, PIPELINE_STAGE_DERIVED_GEOGRAPHY } from './types.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 256,
  height: 256,
}

test('generateDerivedGeography defaults to 1024 grid', () => {
  const doc = generateDerivedGeography({
    geographySeed: 42,
    prevailingWindDegrees: 180,
  })
  assert.strictEqual(doc.gridWidth, DEFAULT_GRID_SIZE)
  assert.strictEqual(doc.gridHeight, DEFAULT_GRID_SIZE)
})

test('generateDerivedGeography returns extended world document shape', () => {
  const doc = generateDerivedGeography(params)
  const cellCount = params.width * params.height

  assert.strictEqual(doc.gridWidth, 256)
  assert.strictEqual(doc.gridHeight, 256)
  assert.strictEqual(doc.geographySeed, 12345)
  assert.strictEqual(doc.prevailingWindDegrees, 90)
  assert.strictEqual(doc.pipelineStage, PIPELINE_STAGE_DERIVED_GEOGRAPHY)
  assert.strictEqual(doc.biomeCatalog.length, BIOMES_COUNT)
  assert.strictEqual(doc.fields.elevation.length, cellCount)
  assert.strictEqual(doc.fields.drainage.length, cellCount)
  assert.strictEqual(doc.biomes.length, cellCount)
  assert.ok(doc.riverGraph)
  assert.ok(Array.isArray(doc.riverGraph.nodes))
  assert.ok(Array.isArray(doc.riverGraph.edges))
  assert.ok(doc.lakeMask)
  assert.strictEqual(doc.lakeMask.length, cellCount)
  assert.ok(doc.coastNavigability)
  assert.ok(Array.isArray(doc.coastalNodes))
  assert.ok(Array.isArray(doc.saltNodes))
  assert.ok(doc.generationReport)
  assert.strictEqual(typeof doc.generationReport.erosionStepCount, 'number')
  assert.ok(Array.isArray(doc.generationReport.validationRows))
  assert.ok(doc.generationReport.hydrology)
  assert.strictEqual(typeof doc.generationReport.hydrology.breachCount, 'number')
  assert.strictEqual(typeof doc.generationReport.hydrology.endorheicCount, 'number')
  assert.strictEqual(typeof doc.generationReport.hydrology.riverCellCount, 'number')
  assert.strictEqual(typeof doc.generationReport.hydrology.navigableKmEstimate, 'number')
  assert.ok('hacksLawExponent' in doc.generationReport.hydrology)
  assert.ok(Array.isArray(doc.generationReport.hydrology.slopeAreaConcavitySamples))
  assert.strictEqual(typeof doc.generationReport.hydrology.parallelStrandRatio, 'number')
  assert.strictEqual(
    typeof doc.generationReport.hydrology.coastConnectedNavigablePathLength,
    'number',
  )
  assert.strictEqual(typeof doc.generationReport.hydrology.mouthCount, 'number')
  assert.strictEqual(typeof doc.generationReport.shouldReject, 'boolean')
  assert.ok(Array.isArray(doc.generationReport.rejectionReasons))
  for (const [key, value] of Object.entries(doc.generationReport.hydrology)) {
    if (key === 'hacksLawExponent') {
      assert.ok(value === null || Number.isFinite(value))
      continue
    }
    if (key === 'slopeAreaConcavitySamples') {
      assert.ok(Array.isArray(value))
      continue
    }
    assert.ok(Number.isFinite(value), `${key} should be finite`)
    assert.ok(value >= 0, `${key} should be non-negative`)
  }
  assert.ok(Array.isArray(doc.lakeMeta))
  assert.ok(Array.isArray(doc.erosionSnapshots))
  assert.ok(doc.erosionSnapshots.length > 0)
})

test('generateDerivedGeography is deterministic for same seed and wind', () => {
  const first = generateDerivedGeography(params)
  const second = generateDerivedGeography(params)

  assert.deepStrictEqual(first.biomes, second.biomes)
  assert.deepStrictEqual(first.fields.elevation, second.fields.elevation)
  assert.deepStrictEqual(first.fields.drainage, second.fields.drainage)
  assert.strictEqual(first.generationReport.navigableRiverEdgeCount,
    second.generationReport.navigableRiverEdgeCount)
})

test('generateDerivedGeography differs for different seeds', () => {
  const first = generateDerivedGeography(params)
  const second = generateDerivedGeography({ ...params, geographySeed: 99999 })

  let same = true
  for (let i = 0; i < first.biomes.length; i += 1) {
    if (first.biomes[i] !== second.biomes[i]) {
      same = false
      break
    }
  }
  assert.strictEqual(same, false)
})

test('generateDerivedGeography completes for default geography seed', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.riverGraph)
  assert.ok(doc.generationReport?.hydrology)
  assert.strictEqual(typeof doc.generationReport.hydrology.lakeCount, 'number')
})

test('generateDerivedGeography default seed produces visible river network on full grid', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: DEFAULT_GRID_SIZE,
    height: DEFAULT_GRID_SIZE,
  })

  let maskCount = 0
  for (let i = 0; i < doc.riverNetworkMask.length; i += 1) {
    if (doc.riverNetworkMask[i]) maskCount += 1
  }

  assert.ok(
    maskCount >= 500,
    `expected substantial river network on ${DEFAULT_GRID_SIZE}px grid, got ${maskCount} cells`,
  )
  assert.strictEqual(doc.generationReport.hydrology.riverCellCount, maskCount)
})

test('generateDerivedGeography seed 77814242 detects river mouths at shoreline drainage cells', () => {
  const doc = generateDerivedGeography({
    geographySeed: 77814242,
    prevailingWindDegrees: 90,
  })

  assert.ok(
    doc.generationReport.hydrology.mouthCount > 0,
    `expected river mouths, got ${doc.generationReport.hydrology.mouthCount}`,
  )
  assert.ok(
    doc.generationReport.hydrology.mouthCount <= 32,
    `expected filtered mouths, got ${doc.generationReport.hydrology.mouthCount}`,
  )
  assert.ok(doc.coastalNodes.some((node) => node.kind === 'mouth'))
})

test('generateDerivedGeography default seed keeps lake surfaces aligned with lakeMeta', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 128,
    height: 128,
  })

  assert.ok(
    doc.lakeMeta.length > 0,
    'expected lakes on default geography seed for lake display coherence test',
  )

  assertLakeMaskSurfacesMatchMeta({
    lakeMask: doc.lakeMask,
    lakes: doc.lakes,
    lakeMeta: doc.lakeMeta,
    elevation: doc.fields.elevation,
    width: doc.gridWidth,
    height: doc.gridHeight,
  })
})

test('generateDerivedGeography default seed applies stream-power incision to elevation', () => {
  const grid = {
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  }
  const withIncision = generateDerivedGeography(grid)
  const withoutIncision = generateDerivedGeography({
    ...grid,
    options: { inciseIterations: 0, streamPowerK: 0 },
  })

  let differs = false
  for (let i = 0; i < withIncision.fields.elevation.length; i += 1) {
    if (Math.abs(withIncision.fields.elevation[i] - withoutIncision.fields.elevation[i]) > 1e-6) {
      differs = true
      break
    }
  }
  assert.ok(differs, 'expected default stream-power passes to change final elevation')
})

test('generateDerivedGeography uses flow-derived drainage not noise', () => {
  const small = { ...params, width: 64, height: 64 }
  const doc = generateDerivedGeography(small)
  const baseline = generatePhysicalTerrainBaseline(small)

  let differs = false
  for (let i = 0; i < doc.fields.drainage.length; i += 1) {
    if (doc.fields.drainage[i] !== baseline.fields.drainage[i]) {
      differs = true
      break
    }
  }
  assert.strictEqual(differs, true)
})

test('generateDerivedGeography extreme seed reports identifiable hydrology validation metrics', () => {
  const doc = generateDerivedGeography({
    geographySeed: 999999,
    prevailingWindDegrees: 270,
    width: 16,
    height: 16,
    options: {
      enforceCoastMouth: true,
      enforceCoastConnectedNavigablePath: true,
    },
  })

  const rows = doc.generationReport.validationRows
  const hydrologyCheckIds = [
    'navigableRiverQuota',
    'coastMouth',
    'hacksLawExponent',
    'slopeAreaConcavity',
    'parallelStrandRatio',
    'coastConnectedNavigablePath',
    'endorheicFractionCap',
  ]
  for (const checkId of hydrologyCheckIds) {
    const row = rows.find((entry) => entry.checkId === checkId)
    assert.ok(row, `missing validation row ${checkId}`)
    assert.ok(row.summary.length > 0, `empty summary for ${checkId}`)
  }
  assert.strictEqual(typeof doc.generationReport.shouldReject, 'boolean')
  assert.ok(Array.isArray(doc.generationReport.rejectionReasons))
})

test('generateDerivedGeography sets shouldReject when enforce flags hard-fail validation', () => {
  const doc = generateDerivedGeography({
    geographySeed: 999999,
    prevailingWindDegrees: 270,
    width: 16,
    height: 16,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastConnectedNavigablePath: true,
      minCoastConnectedNavigablePathCells: 99_999,
      maxValidationRetries: 0,
    },
  })

  assert.strictEqual(doc.generationReport.shouldReject, true)
  assert.ok(
    doc.generationReport.rejectionReasons.some((reason) =>
      reason.startsWith('coastConnectedNavigablePath:'),
    ),
  )
})

test('generateDerivedGeography retries with incremented seed when validation rejects', () => {
  const baseSeed = 999999
  const doc = generateDerivedGeography({
    geographySeed: baseSeed,
    prevailingWindDegrees: 270,
    width: 16,
    height: 16,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastMouth: true,
      maxValidationRetries: 2,
    },
  })

  if (doc.generationReport.shouldReject) {
    assert.strictEqual(doc.geographySeed, baseSeed + 2)
  } else {
    assert.ok(doc.geographySeed >= baseSeed && doc.geographySeed <= baseSeed + 2)
  }
})
