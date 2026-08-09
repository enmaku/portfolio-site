import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from './biomeIds.js'
import { buildGenerationReport } from './buildGenerationReport.js'
import { assembleRiverNetwork } from './hydrology/riverNetwork.js'
import { strategicResourceNodeSpacingForGrid } from './resourcePlacementScaling.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'

function makeReportParams(overrides = {}) {
  const riverGraph = overrides.riverGraph ?? {
    nodes: [
      { id: 'a', x: 1, y: 1, kind: 'source' },
      { id: 'b', x: 1, y: 2, kind: 'mouth' },
    ],
    edges: [
      { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [5, 9] },
    ],
  }
  const centerline = new Uint8Array(16)
  centerline[5] = 1
  centerline[9] = 1
  const riverNetwork =
    overrides.riverNetwork ??
    assembleRiverNetwork({
      centerline,
      corridor: centerline,
      flowDirection: new Int16Array(16).fill(-1),
      flowAccumulation: new Float32Array(16).fill(0.5),
      graph: riverGraph,
      width: 4,
      height: 4,
    })

  return {
    erosionStepCount: 24,
    riverGraph,
    riverNetwork,
    coastalNodes: [{ id: 'c1', x: 1, y: 2, kind: 'mouth' }],
    fields: {
      elevation: new Float32Array(16).fill(0.5),
      temperature: new Float32Array(16).fill(0.5),
      rainfall: new Float32Array(16).fill(0.5),
      drainage: new Float32Array(16).fill(0.5),
      salinity: new Float32Array(16).fill(0.1),
    },
    biomes: new Uint8Array(16).fill(1),
    gridWidth: 4,
    gridHeight: 4,
    hydrologySubstepTimings: [{ substepId: 'hydrologyFill', label: 'Fill lakes', durationMs: 1.2 }],
    hydrologyStats: {
      breachCount: 2,
      endorheicCount: 1,
      lakeCount: 4,
    },
    validationOptions: undefined,
    ...overrides,
  }
}

test('buildGenerationReport hydrology riverCellCount uses simulation centerline', () => {
  const gridWidth = 4
  const gridHeight = 4
  const cellCount = gridWidth * gridHeight
  const simulationCenterline = new Uint8Array(cellCount)
  simulationCenterline[5] = 1
  simulationCenterline[9] = 1
  const presentationCenterline = new Uint8Array(cellCount)
  presentationCenterline[5] = 1
  presentationCenterline[9] = 1
  presentationCenterline[10] = 1
  presentationCenterline[11] = 1
  const riverGraph = {
    nodes: [
      { id: 'a', x: 1, y: 1, kind: 'source' },
      { id: 'b', x: 1, y: 2, kind: 'mouth' },
    ],
    edges: [{ fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [5, 9] }],
  }
  const riverNetwork = assembleRiverNetwork({
    centerline: presentationCenterline,
    corridor: presentationCenterline,
    simulationCenterline,
    flowDirection: new Int16Array(cellCount).fill(-1),
    flowAccumulation: new Float32Array(cellCount).fill(0.5),
    graph: riverGraph,
    width: gridWidth,
    height: gridHeight,
  })

  const report = buildGenerationReport(
    makeReportParams({
      gridWidth,
      gridHeight,
      riverGraph,
      riverNetwork,
      fields: {
        elevation: new Float32Array(cellCount).fill(0.5),
        temperature: new Float32Array(cellCount).fill(0.5),
        rainfall: new Float32Array(cellCount).fill(0.5),
        drainage: new Float32Array(cellCount).fill(0.5),
        salinity: new Float32Array(cellCount).fill(0.1),
      },
      biomes: new Uint8Array(cellCount).fill(1),
    }),
  )

  assert.strictEqual(report.hydrology.riverCellCount, 2)
})

test('buildGenerationReport includes hydrology breach and endorheic stats', () => {
  const report = buildGenerationReport(makeReportParams())

  assert.strictEqual(report.hydrology.breachCount, 2)
  assert.strictEqual(report.hydrology.endorheicCount, 1)
  assert.strictEqual(report.hydrology.endorheicFraction, 0.25)
})

test('buildGenerationReport lists hydrology validation metrics', () => {
  const report = buildGenerationReport(makeReportParams())

  assert.strictEqual(typeof report.hydrology.riverCellCount, 'number')
  assert.strictEqual(typeof report.hydrology.navigableEdgeCount, 'number')
  assert.strictEqual(typeof report.hydrology.navigableKmEstimate, 'number')
  assert.strictEqual(typeof report.hydrology.mouthCount, 'number')
  assert.ok('hacksLawExponent' in report.hydrology)
  assert.ok(Array.isArray(report.hydrology.slopeAreaConcavitySamples))
  assert.strictEqual(typeof report.hydrology.parallelStrandRatio, 'number')
  assert.strictEqual(typeof report.hydrology.coastConnectedNavigablePathLength, 'number')
  assert.strictEqual(report.hydrologySubstepTimings.length, 1)
})

test('buildGenerationReport includes hydrology validation rows', () => {
  const report = buildGenerationReport(makeReportParams())
  const ids = report.validationRows.map((row) => row.checkId)
  assert.ok(ids.includes('hacksLawExponent'))
  assert.ok(ids.includes('parallelStrandRatio'))
  assert.ok(ids.includes('endorheicFractionCap'))
  assert.ok(ids.includes('salinityOceanGradient'))
  assert.strictEqual(report.shouldReject, false)
  assert.deepStrictEqual(report.rejectionReasons, [])
  assert.deepStrictEqual(report.structuredRejectionReasons, [])
  assert.strictEqual(report.rejectionSamplingEnforced, false)
})

test('buildGenerationReport exposes logistics-facing validation signals', () => {
  const report = buildGenerationReport(makeReportParams())
  assert.strictEqual(typeof report.hydrology.largestSailComponentCellCount, 'number')
  assert.strictEqual(typeof report.hydrology.coastalRiverAccess, 'boolean')
  assert.strictEqual(typeof report.hydrology.coastToInteriorSailPathLength, 'number')
  assert.strictEqual(typeof report.validationSignals.coast.coastalNodeCount, 'number')
  assert.strictEqual(typeof report.validationSignals.movement.largestSailComponentCellCount, 'number')
  assert.strictEqual(
    typeof report.validationSignals.movement.coastToInteriorSailPathLength,
    'number',
  )
  assert.strictEqual(typeof report.validationSignals.resources.meanInlandSalinity, 'number')
  assert.strictEqual(typeof report.validationSignals.resources.oceanSalinityMean, 'number')
  assert.strictEqual(typeof report.validationSignals.resources.arableLandFraction, 'number')
  assert.strictEqual(typeof report.validationSignals.resources.saltNodeProximityViolationCount, 'number')
  assert.strictEqual(
    typeof report.validationSignals.resources.strategicResourceSpacingViolationCount,
    'number',
  )
  assert.strictEqual(typeof report.validationSignals.landmassPlausibility.highlandFraction, 'number')
  assert.strictEqual(typeof report.validationSignals.climate.windRainfallAsymmetryActive, 'boolean')
})

test('buildGenerationReport surfaces structured rejection reasons for enforced failures', () => {
  const report = buildGenerationReport(
    makeReportParams({
      riverGraph: { nodes: [], edges: [] },
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceCoastMouth: true,
      },
    }),
  )
  assert.strictEqual(report.shouldReject, true)
  assert.strictEqual(report.rejectionSamplingEnforced, true)
  assert.deepStrictEqual(report.structuredRejectionReasons, [
    { checkId: 'coastMouth', category: 'coast' },
  ])
})

test('buildGenerationReport passes precomputed hydrology metrics into validation', () => {
  const report = buildGenerationReport(
    makeReportParams({
      riverGraph: { nodes: [], edges: [] },
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceHacksLawExponent: true,
      },
    }),
  )
  const hacksRow = report.validationRows.find((row) => row.checkId === 'hacksLawExponent')
  assert.strictEqual(hacksRow?.status, 'fail')
  assert.strictEqual(report.hydrology.hacksLawExponent, null)
})

test('buildGenerationReport includes resource validation rows from current contract', () => {
  const width = 48
  const height = 48
  const cellCount = width * height
  const biomes = new Uint8Array(cellCount).fill(BIOMES.OCEAN)
  biomes[24 * width + 24] = BIOMES.GRASSLAND

  const report = buildGenerationReport(
    makeReportParams({
      gridWidth: width,
      gridHeight: height,
      biomes,
      fields: {
        elevation: new Float32Array(cellCount).fill(SEA_LEVEL + 0.3),
        temperature: new Float32Array(cellCount).fill(0.5),
        rainfall: new Float32Array(cellCount).fill(0.5),
        drainage: new Float32Array(cellCount).fill(0.5),
        salinity: new Float32Array(cellCount).fill(0.1),
      },
      arableRaster: new Float32Array(cellCount).fill(0.5),
      saltNodes: [{ id: 'salt-0', x: 24, y: 24, score: 0.9 }],
      metalNodes: [{ id: 'metal-0', x: 10, y: 10, score: 0.9 }],
    }),
  )

  const resourceIds = [
    'arableEnvelopeCoverage',
    'saltNodeLandProximity',
    'strategicResourceSpacing',
  ]
  for (const checkId of resourceIds) {
    assert.ok(report.validationRows.some((row) => row.checkId === checkId))
  }

  const arableRow = report.validationRows.find((row) => row.checkId === 'arableEnvelopeCoverage')
  const saltRow = report.validationRows.find((row) => row.checkId === 'saltNodeLandProximity')
  assert.strictEqual(arableRow?.rejectable, false)
  assert.strictEqual(arableRow?.category, 'resources')
  assert.strictEqual(saltRow?.rejectable, true)
  assert.strictEqual(saltRow?.status, 'warn')
  assert.strictEqual(report.validationSignals.resources.arableEnvelopeCheckStatus, 'pass')
  assert.strictEqual(report.validationSignals.resources.saltNodeLandProximityCheckStatus, 'warn')
  assert.strictEqual(report.validationSignals.resources.saltNodeProximityViolationCount, 1)
})

test('buildGenerationReport rejects enforced strategic resource spacing violations', () => {
  const gridSize = 256
  const cellCount = gridSize * gridSize
  const minSpacing = strategicResourceNodeSpacingForGrid(gridSize)

  const report = buildGenerationReport(
    makeReportParams({
      gridWidth: gridSize,
      gridHeight: gridSize,
      fields: {
        elevation: new Float32Array(cellCount).fill(SEA_LEVEL + 0.3),
        temperature: new Float32Array(cellCount).fill(0.5),
        rainfall: new Float32Array(cellCount).fill(0.5),
        drainage: new Float32Array(cellCount).fill(0.5),
        salinity: new Float32Array(cellCount).fill(0.1),
      },
      biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
      metalNodes: [
        { id: 'metal-0', x: 80, y: 80, score: 0.9 },
        { id: 'metal-1', x: 80 + minSpacing - 2, y: 80, score: 0.85 },
      ],
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceStrategicResourceSpacing: true,
      },
    }),
  )

  const spacingRow = report.validationRows.find(
    (row) => row.checkId === 'strategicResourceSpacing',
  )
  assert.strictEqual(spacingRow?.status, 'fail')
  assert.strictEqual(report.shouldReject, true)
  assert.strictEqual(report.rejectionSamplingEnforced, true)
  assert.deepStrictEqual(report.structuredRejectionReasons, [
    { checkId: 'strategicResourceSpacing', category: 'resources' },
  ])
  assert.ok(report.validationSignals.resources.strategicResourceSpacingViolationCount >= 1)
})
