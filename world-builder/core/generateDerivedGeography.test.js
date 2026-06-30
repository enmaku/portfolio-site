import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from './biomeIds.js'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import { runLandmassPipelineRun } from './derivedGeographyPipeline.js'
import { generatePhysicalTerrainBaseline } from './generatePhysicalTerrainBaseline.js'
import { assertLakeMaskSurfacesMatchMeta } from './hydrology/lakeDisplayCoherence.js'
import { DEFAULT_GEOGRAPHY_SEED } from './worldGenerationOptions.js'
import { DEFAULT_GRID_SIZE, PIPELINE_STAGE_DERIVED_GEOGRAPHY } from './types.js'
import { isOceanCell } from './fields/applyClosedIslandRim.js'
import { downstreamIndex } from './hydrology/computeFlowAccumulation.js'
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

test('generateDerivedGeography emits landmass pipeline fields and hydrology report', () => {
  const doc = generateDerivedGeography(params)
  const cellCount = params.width * params.height

  assert.strictEqual(doc.gridWidth, 256)
  assert.strictEqual(doc.gridHeight, 256)
  assert.strictEqual(doc.pipelineStage, PIPELINE_STAGE_DERIVED_GEOGRAPHY)
  assert.strictEqual(doc.fields.elevation.length, cellCount)
  assert.strictEqual(doc.coastNavigability.length, cellCount)
  assert.ok(doc.riverGraph)
  assert.ok(doc.lakeMask)
  assert.ok(doc.arableRaster)
  assert.ok(doc.generationReport?.hydrology)
  assert.strictEqual(doc.generationReport.hydrology.riverCellCount >= 0, true)
  assert.strictEqual(typeof doc.generationReport.shouldReject, 'boolean')
})

test('generateDerivedGeography arable favors river corridor temperate cells over mountain desert', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
  })
  const corridorMask = doc.riverCorridorMask ?? doc.riverNetworkMask
  assert.ok(corridorMask)

  const favorableBiomes = new Set([
    BIOMES.GRASSLAND,
    BIOMES.TEMPERATE_FOREST,
    BIOMES.RIVER_CORRIDOR,
  ])
  const unfavorableBiomes = new Set([BIOMES.MOUNTAIN, BIOMES.DESERT])

  let favorableSum = 0
  let favorableCount = 0
  let unfavorableSum = 0
  let unfavorableCount = 0

  for (let i = 0; i < doc.biomes.length; i += 1) {
    if (corridorMask[i] && favorableBiomes.has(doc.biomes[i])) {
      favorableSum += doc.arableRaster[i]
      favorableCount += 1
    } else if (unfavorableBiomes.has(doc.biomes[i])) {
      unfavorableSum += doc.arableRaster[i]
      unfavorableCount += 1
    }
  }

  assert.ok(favorableCount > 0)
  assert.ok(unfavorableCount > 0)
  assert.ok(
    favorableSum / favorableCount > unfavorableSum / unfavorableCount + 0.05,
    `favorable mean ${favorableSum / favorableCount} should exceed unfavorable mean ${unfavorableSum / unfavorableCount}`,
  )
})

test('generateDerivedGeography is deterministic for same seed and wind', () => {
  const first = generateDerivedGeography(params)
  const second = generateDerivedGeography(params)

  assert.deepStrictEqual(first.biomes, second.biomes)
  assert.deepStrictEqual(first.fields.elevation, second.fields.elevation)
  assert.deepStrictEqual(first.fields.drainage, second.fields.drainage)
  assert.deepStrictEqual(first.arableRaster, second.arableRaster)
  assert.deepStrictEqual(first.timberRaster, second.timberRaster)
  assert.deepStrictEqual(first.metalsRaster, second.metalsRaster)
  assert.deepStrictEqual(first.metalNodes, second.metalNodes)
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

  const mouths = doc.riverGraph.nodes.filter((node) => node.kind === 'mouth')
  assert.strictEqual(mouths.length, doc.generationReport.hydrology.mouthCount)
  const ocean = isOceanCell(doc.fields.elevation, doc.gridWidth, doc.gridHeight)
  for (const mouth of mouths) {
    const idx = mouth.y * doc.gridWidth + mouth.x
    const downstreamIdx = downstreamIndex(idx, doc.gridWidth, doc.flowDirection)
    assert.ok(downstreamIdx >= 0)
    assert.ok(ocean[downstreamIdx])
  }
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

test('runLandmassPipelineRun extreme seed reports identifiable hydrology validation metrics', () => {
  const result = runLandmassPipelineRun({
    geographySeed: 999999,
    prevailingWindDegrees: 270,
    width: 16,
    height: 16,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastMouth: true,
      enforceCoastConnectedNavigablePath: true,
    },
  })

  assert.ok(result.worldDocument)
  assert.ok(result.status === 'success' || result.status === 'exhausted')
  const doc = result.worldDocument

  const rows = doc.generationReport.validationRows
  const hydrologyCheckIds = [
    'navigableRiverQuota',
    'coastMouth',
    'hacksLawExponent',
    'slopeAreaConcavity',
    'parallelStrandRatio',
    'coastConnectedNavigablePath',
    'endorheicFractionCap',
    'salinityOceanGradient',
  ]
  for (const checkId of hydrologyCheckIds) {
    const row = rows.find((entry) => entry.checkId === checkId)
    assert.ok(row, `missing validation row ${checkId}`)
    assert.ok(row.summary.length > 0, `empty summary for ${checkId}`)
  }
  assert.strictEqual(typeof doc.generationReport.shouldReject, 'boolean')
  assert.ok(Array.isArray(doc.generationReport.rejectionReasons))
  assert.ok(Array.isArray(doc.generationReport.structuredRejectionReasons))
  assert.strictEqual(typeof doc.generationReport.rejectionSamplingEnforced, 'boolean')
  assert.ok(doc.generationReport.validationSignals)
})

test('generateDerivedGeography throws when validation retries are exhausted', () => {
  assert.throws(
    () =>
      generateDerivedGeography({
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
      }),
    /validation retries exhausted/,
  )
})

test('runLandmassPipelineRun retries with incremented seed when validation rejects', () => {
  const baseSeed = 999999
  const result = runLandmassPipelineRun({
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

  assert.ok(result.worldDocument)
  if (result.worldDocument.generationReport.shouldReject) {
    assert.strictEqual(result.status, 'exhausted')
    assert.strictEqual(result.worldDocument.geographySeed, baseSeed + 2)
  } else {
    assert.strictEqual(result.status, 'success')
    assert.ok(result.worldDocument.geographySeed >= baseSeed && result.worldDocument.geographySeed <= baseSeed + 2)
  }
})
