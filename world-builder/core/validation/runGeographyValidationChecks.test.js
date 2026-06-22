import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import {
  maxEndorheicFractionForOptions,
  runGeographyValidationChecks,
} from './runGeographyValidationChecks.js'

function makeSlice(overrides = {}) {
  const gridWidth = 32
  const gridHeight = 32
  const cellCount = gridWidth * gridHeight
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.5),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salidity: new Float32Array(cellCount).fill(0.1),
  }
  fields.elevation[16] = 0.85
  const biomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  biomes.fill(BIOMES.OCEAN, 0, gridWidth)
  biomes[100] = BIOMES.DESERT
  biomes[101] = BIOMES.TEMPERATE_FOREST
  fields.rainfall[100] = 0.7

  return {
    fields,
    biomes,
    riverGraph: { nodes: [], edges: [] },
    coastalNodes: [],
    gridWidth,
    gridHeight,
    hydrologyStats: {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    validationOptions: DEFAULT_WORLD_GENERATION_OPTIONS,
    ...overrides,
  }
}

test('runGeographyValidationChecks returns all check ids', () => {
  const rows = runGeographyValidationChecks(makeSlice())
  const ids = rows.map((row) => row.checkId)
  assert.deepStrictEqual(ids, [
    'navigableRiverQuota',
    'coastMouth',
    'hacksLawExponent',
    'slopeAreaConcavity',
    'parallelStrandRatio',
    'coastConnectedNavigablePath',
    'endorheicFractionCap',
    'highlandPresence',
    'biomeDiversity',
    'resourceMismatch',
  ])
})

test('runGeographyValidationChecks warns on missing navigable rivers', () => {
  const rows = runGeographyValidationChecks(makeSlice())
  const row = rows.find((entry) => entry.checkId === 'navigableRiverQuota')
  assert.ok(row)
  assert.strictEqual(row.status, 'warn')
  assert.ok(row.mapFocus)
})

test('runGeographyValidationChecks hard-fails navigableRiverQuota when enforced', () => {
  const row = runGeographyValidationChecks(
    makeSlice({
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceNavigableRiverQuota: true,
      },
    }),
  ).find((entry) => entry.checkId === 'navigableRiverQuota')
  assert.strictEqual(row?.status, 'fail')
  assert.match(row?.summary ?? '', /navigable river/i)
})

test('runGeographyValidationChecks passes with sufficient navigable edges', () => {
  const slice = makeSlice({
    riverGraph: {
      nodes: [
        { id: 'a', x: 10, y: 10, kind: 'source' },
        { id: 'b', x: 12, y: 12, kind: 'mouth' },
      ],
      edges: [
        { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [320, 384] },
        { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [321, 385] },
        { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [322, 386] },
      ],
    },
    coastalNodes: [{ id: 'c1', x: 12, y: 12, kind: 'mouth' }],
  })
  const row = runGeographyValidationChecks(slice).find(
    (entry) => entry.checkId === 'navigableRiverQuota',
  )
  assert.strictEqual(row?.status, 'pass')
})

test('runGeographyValidationChecks hard-fails coastMouth when enforced', () => {
  const row = runGeographyValidationChecks(
    makeSlice({
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceCoastMouth: true,
      },
    }),
  ).find((entry) => entry.checkId === 'coastMouth')
  assert.strictEqual(row?.status, 'fail')
})

test('runGeographyValidationChecks enforces endorheic fraction cap from breach threshold', () => {
  const row = runGeographyValidationChecks(
    makeSlice({
      hydrologyStats: {
        breachCount: 0,
        endorheicCount: 4,
        endorheicFraction: 1,
        lakeCount: 4,
      },
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        breachThreshold: 0.3,
        enforceEndorheicFractionCap: true,
      },
    }),
  ).find((entry) => entry.checkId === 'endorheicFractionCap')
  assert.strictEqual(row?.status, 'fail')
  assert.match(row?.summary ?? '', /endorheic/i)
})

test('runGeographyValidationChecks detects resource mismatch', () => {
  const row = runGeographyValidationChecks(makeSlice()).find(
    (entry) => entry.checkId === 'resourceMismatch',
  )
  assert.strictEqual(row?.status, 'warn')
  assert.ok(row?.mapFocus)
})

test('runGeographyValidationChecks reports identifiable metric names for empty graph', () => {
  const rows = runGeographyValidationChecks(
    makeSlice({
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceCoastMouth: true,
        enforceCoastConnectedNavigablePath: true,
      },
    }),
  )
  const failingIds = rows.filter((row) => row.status === 'fail').map((row) => row.checkId)
  assert.ok(failingIds.includes('coastMouth'))
  assert.ok(failingIds.includes('coastConnectedNavigablePath'))
})

test('runGeographyValidationChecks hard-fails parallelStrandRatio when enforced', () => {
  const width = 10
  const height = 10
  const sharedPath = [15, 25, 35]
  const parallelPath = [16, 26, 36]
  const row = runGeographyValidationChecks(
    makeSlice({
      gridWidth: width,
      gridHeight: height,
      riverGraph: {
        nodes: [
          { id: 'a', x: 5, y: 1, kind: 'source' },
          { id: 'b', x: 5, y: 3, kind: 'mouth' },
        ],
        edges: [
          { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: sharedPath },
          { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: parallelPath },
        ],
      },
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        maxParallelStrandRatio: 0,
        enforceParallelStrandRatio: true,
      },
    }),
  ).find((entry) => entry.checkId === 'parallelStrandRatio')
  assert.strictEqual(row?.status, 'fail')
  assert.match(row?.summary ?? '', /parallel strand/i)
})

test('runGeographyValidationChecks hard-fails hacksLawExponent when enforced and unavailable', () => {
  const row = runGeographyValidationChecks(
    makeSlice({
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceHacksLawExponent: true,
      },
    }),
  ).find((entry) => entry.checkId === 'hacksLawExponent')
  assert.strictEqual(row?.status, 'fail')
  assert.match(row?.summary ?? '', /hack/i)
})

test('runGeographyValidationChecks hard-fails slopeAreaConcavity when enforced and unavailable', () => {
  const row = runGeographyValidationChecks(
    makeSlice({
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceSlopeAreaConcavity: true,
      },
    }),
  ).find((entry) => entry.checkId === 'slopeAreaConcavity')
  assert.strictEqual(row?.status, 'fail')
  assert.match(row?.summary ?? '', /slope/i)
})

test('runGeographyValidationChecks hard-fails hacksLawExponent when enforced and out of bounds', () => {
  const row = runGeographyValidationChecks(
    makeSlice({
      hydrologyMetrics: {
        riverCellCount: 10,
        navigableEdgeCount: 1,
        navigableKmEstimate: 5,
        mouthCount: 1,
        hacksLawExponent: 0.95,
        slopeAreaConcavitySamples: [0.2],
        parallelStrandRatio: 0,
        coastConnectedNavigablePathLength: 20,
      },
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceHacksLawExponent: true,
        maxHacksLawExponent: 0.75,
      },
    }),
  ).find((entry) => entry.checkId === 'hacksLawExponent')
  assert.strictEqual(row?.status, 'fail')
  assert.match(row?.summary ?? '', /hack/i)
})

test('runGeographyValidationChecks hard-fails coastConnectedNavigablePath when enforced and short', () => {
  const row = runGeographyValidationChecks(
    makeSlice({
      hydrologyMetrics: {
        riverCellCount: 4,
        navigableEdgeCount: 1,
        navigableKmEstimate: 2,
        mouthCount: 1,
        hacksLawExponent: 0.55,
        slopeAreaConcavitySamples: [0.2],
        parallelStrandRatio: 0,
        coastConnectedNavigablePathLength: 3,
      },
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceCoastConnectedNavigablePath: true,
        minCoastConnectedNavigablePathCells: 8,
      },
    }),
  ).find((entry) => entry.checkId === 'coastConnectedNavigablePath')
  assert.strictEqual(row?.status, 'fail')
  assert.match(row?.summary ?? '', /coast-connected navigable path/i)
})

test('maxEndorheicFractionForOptions uses explicit cap when finite', () => {
  assert.strictEqual(
    maxEndorheicFractionForOptions({
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      maxEndorheicFraction: 0.5,
      breachThreshold: 0.3,
    }),
    0.5,
  )
})

test('maxEndorheicFractionForOptions derives cap from breach threshold when unset', () => {
  assert.strictEqual(
    maxEndorheicFractionForOptions({
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      maxEndorheicFraction: Number.NaN,
      breachThreshold: 0.25,
    }),
    0.75,
  )
})
