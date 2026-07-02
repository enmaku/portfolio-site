import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import {
  assembleRiverNetwork,
  assembleRiverNetworkFromValidationSlice,
} from '../hydrology/riverNetwork.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { computeHydrologyMetrics } from './computeHydrologyMetrics.js'
import {
  assembleRiverNetworkForLogisticsValidation,
  maxEndorheicFractionForOptions,
  riverNetworkForLogisticsMetrics,
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
    salinity: new Float32Array(cellCount).fill(0.15),
  }
  fields.elevation[16] = 0.85
  for (let i = 0; i < gridWidth; i += 1) {
    fields.elevation[i] = 0.2
    fields.salinity[i] = 1
  }
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

/** Checks that intentionally omit mapFocus even when not passing. */
const CONTROLLER_FOCUS_EXEMPT_CHECK_IDS = new Set(['windRainfallAsymmetry'])

/**
 * @param {import('../types.js').MapFocus | undefined} mapFocus
 */
function assertMapFocusContract(mapFocus) {
  assert.ok(mapFocus)
  if ('minX' in mapFocus) {
    assert.equal(typeof mapFocus.minX, 'number')
    assert.equal(typeof mapFocus.minY, 'number')
    assert.equal(typeof mapFocus.maxX, 'number')
    assert.equal(typeof mapFocus.maxY, 'number')
    return
  }
  assert.equal(typeof mapFocus.x, 'number')
  assert.equal(typeof mapFocus.y, 'number')
  assert.equal(typeof mapFocus.zoom, 'number')
}

test('riverNetworkForLogisticsMetrics binds hydrology metrics to simulation centerline', () => {
  const gridWidth = 8
  const gridHeight = 8
  const cellCount = gridWidth * gridHeight
  const simulationCenterline = new Uint8Array(cellCount)
  simulationCenterline[10] = 1
  simulationCenterline[18] = 1
  const presentationCenterline = new Uint8Array(cellCount)
  presentationCenterline[10] = 1
  presentationCenterline[18] = 1
  presentationCenterline[19] = 1
  presentationCenterline[20] = 1
  const drainage = new Float32Array(cellCount).fill(0.2)
  const graph = {
    nodes: [{ id: 'm', x: 2, y: 2, kind: 'mouth' }],
    edges: [{ fromNodeId: 'm', toNodeId: 'm', navigable: true, cellPath: [10, 18] }],
  }
  const riverNetwork = assembleRiverNetwork({
    centerline: presentationCenterline,
    corridor: presentationCenterline,
    simulationCenterline,
    flowDirection: new Int16Array(cellCount).fill(-1),
    flowAccumulation: drainage,
    graph,
    width: gridWidth,
    height: gridHeight,
  })

  const logisticsMetrics = computeHydrologyMetrics({
    elevation: drainage,
    drainage,
    riverNetwork: riverNetworkForLogisticsMetrics(riverNetwork),
    gridWidth,
    gridHeight,
  })
  const presentationMetrics = computeHydrologyMetrics({
    elevation: drainage,
    drainage,
    riverNetwork,
    gridWidth,
    gridHeight,
  })

  assert.strictEqual(logisticsMetrics.riverCellCount, 2)
  assert.strictEqual(presentationMetrics.riverCellCount, 4)
})

test('runGeographyValidationChecks binds slice assembly to simulationRiverMask', () => {
  const gridWidth = 8
  const gridHeight = 8
  const cellCount = gridWidth * gridHeight
  const simulationRiverMask = new Uint8Array(cellCount)
  simulationRiverMask[10] = 1
  simulationRiverMask[18] = 1
  const riverNetworkMask = new Uint8Array(cellCount)
  riverNetworkMask[10] = 1
  riverNetworkMask[18] = 1
  riverNetworkMask[19] = 1
  riverNetworkMask[20] = 1
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[10] = 1
  riverCorridorMask[18] = 1
  riverCorridorMask[19] = 1
  riverCorridorMask[20] = 1
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const drainage = new Float32Array(cellCount).fill(0.2)
  const graph = {
    nodes: [{ id: 'm', x: 2, y: 2, kind: 'mouth' }],
    edges: [{ fromNodeId: 'm', toNodeId: 'm', navigable: true, cellPath: [10, 18] }],
  }
  const slice = {
    fields: {
      elevation: drainage,
      temperature: drainage,
      rainfall: drainage,
      drainage,
      salinity: drainage,
    },
    riverGraph: graph,
    riverNetworkMask,
    riverCorridorMask,
    simulationRiverMask,
    flowDirection,
    gridWidth,
    gridHeight,
  }

  const assembled = assembleRiverNetworkForLogisticsValidation(slice)
  assert.ok(assembled)
  assert.strictEqual(assembled.simulationCenterline, simulationRiverMask)
  assert.strictEqual(assembled.centerline, riverNetworkMask)
  assert.strictEqual(
    computeHydrologyMetrics({
      elevation: drainage,
      drainage,
      riverNetwork: riverNetworkForLogisticsMetrics(assembled),
      gridWidth,
      gridHeight,
    }).riverCellCount,
    2,
  )
})

test('runGeographyValidationChecks reflects presentation corridor bridges in sailing checks', () => {
  const gridWidth = 10
  const gridHeight = 8
  const cellCount = gridWidth * gridHeight
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.5),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.2),
    salinity: new Float32Array(cellCount).fill(0.15),
  }
  for (let x = 0; x < gridWidth; x += 1) {
    const oceanIdx = (gridHeight - 1) * gridWidth + x
    fields.elevation[oceanIdx] = 0.2
    fields.salinity[oceanIdx] = 1
  }
  const biomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  const baseCorridor = new Uint8Array(cellCount)
  baseCorridor[4 * gridWidth + 5] = 1
  const bridgedCorridor = new Uint8Array(baseCorridor)
  bridgedCorridor[5 * gridWidth + 5] = 1
  bridgedCorridor[6 * gridWidth + 5] = 1

  const baseSlice = {
    fields,
    biomes,
    riverGraph: { nodes: [], edges: [] },
    coastalNodes: [],
    riverCorridorMask: baseCorridor,
    gridWidth,
    gridHeight,
    hydrologyStats: {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    validationOptions: DEFAULT_WORLD_GENERATION_OPTIONS,
  }
  const bridgedSlice = { ...baseSlice, riverCorridorMask: bridgedCorridor }

  const baseRow = runGeographyValidationChecks(baseSlice).find((row) => row.checkId === 'coastMouth')
  const bridgedRow = runGeographyValidationChecks(bridgedSlice).find(
    (row) => row.checkId === 'coastMouth',
  )
  assert.notStrictEqual(baseRow?.status, bridgedRow?.status)
})

test('runGeographyValidationChecks exposes mapFocus on non-pass rows for controller focus seam', () => {
  const rows = runGeographyValidationChecks(makeSlice())

  for (const row of rows) {
    if (row.status === 'pass' || CONTROLLER_FOCUS_EXEMPT_CHECK_IDS.has(row.checkId)) {
      assert.strictEqual(row.mapFocus, undefined, `${row.checkId} should omit mapFocus`)
      continue
    }
    assertMapFocusContract(row.mapFocus)
  }
})

test('runGeographyValidationChecks omits mapFocus on passing coast and sailable rows', () => {
  const gridWidth = 12
  const gridHeight = 10
  const cellCount = gridWidth * gridHeight
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.5),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.2),
    salinity: new Float32Array(cellCount).fill(0.15),
  }
  for (let x = 0; x < gridWidth; x += 1) {
    const oceanIdx = (gridHeight - 1) * gridWidth + x
    fields.elevation[oceanIdx] = 0.2
    fields.salinity[oceanIdx] = 1
  }
  const riverCorridorMask = new Uint8Array(cellCount)
  for (let y = 4; y <= 8; y += 1) {
    riverCorridorMask[y * gridWidth + 6] = 1
  }
  const rows = runGeographyValidationChecks({
    ...makeSlice(),
    gridWidth,
    gridHeight,
    fields,
    riverCorridorMask,
  })
  for (const checkId of ['coastMouth', 'navigableRiverQuota']) {
    const row = rows.find((entry) => entry.checkId === checkId)
    assert.strictEqual(row?.status, 'pass')
    assert.strictEqual(row?.mapFocus, undefined)
  }
})

test('runGeographyValidationChecks exposes coastMouth mapFocus on failure', () => {
  const row = runGeographyValidationChecks(makeSlice()).find((entry) => entry.checkId === 'coastMouth')
  assert.strictEqual(row?.status, 'warn')
  assertMapFocusContract(row?.mapFocus)
})

test('runGeographyValidationChecks passes coastMouth when sail overlay connects inland water to ocean', () => {
  const gridWidth = 48
  const gridHeight = 48
  const cellCount = gridWidth * gridHeight
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.5),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salinity: new Float32Array(cellCount).fill(0.15),
  }
  for (let i = 0; i < gridWidth; i += 1) {
    fields.elevation[i] = 0.2
    fields.salinity[i] = 1
  }
  const biomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  biomes.fill(BIOMES.OCEAN, 0, gridWidth)
  const riverCorridorMask = new Uint8Array(cellCount)
  for (let y = 1; y < 8; y += 1) {
    riverCorridorMask[y * gridWidth + 3] = 1
  }
  const row = runGeographyValidationChecks({
    fields,
    biomes,
    riverGraph: { nodes: [], edges: [] },
    coastalNodes: [],
    riverCorridorMask,
    gridWidth,
    gridHeight,
    hydrologyStats: {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    validationOptions: DEFAULT_WORLD_GENERATION_OPTIONS,
  }).find((entry) => entry.checkId === 'coastMouth')

  assert.strictEqual(row?.status, 'pass')
})

test('runGeographyValidationChecks resolves river metrics from assembled contract', () => {
  const gridWidth = 8
  const gridHeight = 8
  const cellCount = gridWidth * gridHeight
  const centerline = new Uint8Array(cellCount)
  centerline[10] = 1
  centerline[18] = 1
  const corridor = new Uint8Array(cellCount)
  for (let y = 1; y < 4; y += 1) {
    corridor[10 + y * gridWidth] = 1
  }
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const drainage = new Float32Array(cellCount).fill(0.2)
  const graph = {
    nodes: [{ id: 'm', x: 2, y: 2, kind: 'mouth' }],
    edges: [{ fromNodeId: 'm', toNodeId: 'm', navigable: true, cellPath: [99, 100] }],
  }
  const riverNetwork = assembleRiverNetworkFromValidationSlice({
    fields: {
      elevation: drainage,
      temperature: drainage,
      rainfall: drainage,
      drainage,
      salinity: drainage,
    },
    riverNetworkMask: centerline,
    riverCorridorMask: corridor,
    flowDirection,
    riverGraph: graph,
    gridWidth,
    gridHeight,
  })

  const rows = runGeographyValidationChecks({
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.5),
      drainage,
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    riverGraph: graph,
    riverNetwork,
    riverCorridorMask: corridor,
    coastalNodes: [{ x: 2, y: 2, kind: 'mouth' }],
    gridWidth,
    gridHeight,
    hydrologyStats: { breachCount: 0, endorheicCount: 0, endorheicFraction: 0, lakeCount: 0 },
    hydrologyMetrics: {
      riverCellCount: 2,
      navigableEdgeCount: 1,
      navigableKmEstimate: 1,
      mouthCount: 1,
      hacksLawExponent: null,
      slopeAreaConcavitySamples: [],
      parallelStrandRatio: 0,
      coastConnectedNavigablePathLength: 2,
    },
  })

  const navigableRow = rows.find((row) => row.checkId === 'navigableRiverQuota')
  assert.equal(navigableRow?.status, 'pass')
})

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
    'salinityOceanGradient',
    'highlandPresence',
    'biomeDiversity',
    'windRainfallAsymmetry',
    'resourceMismatch',
    'arableEnvelopeCoverage',
    'saltNodeLandProximity',
    'strategicResourceSpacing',
  ])
})

test('runGeographyValidationChecks marks rejectable rows from contract', () => {
  const rows = runGeographyValidationChecks(makeSlice())
  const coastMouth = rows.find((row) => row.checkId === 'coastMouth')
  const highland = rows.find((row) => row.checkId === 'highlandPresence')
  assert.strictEqual(coastMouth?.rejectable, true)
  assert.strictEqual(coastMouth?.category, 'coast')
  assert.strictEqual(highland?.rejectable, false)
  assert.strictEqual(highland?.category, 'landmassPlausibility')
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
  assert.strictEqual(row?.rejectable, true)
  assertMapFocusContract(row?.mapFocus)
})

test('runGeographyValidationChecks ignores graph navigable edges without sail overlay area', () => {
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
  assert.strictEqual(row?.status, 'warn')
})

test('runGeographyValidationChecks passes sailable water with sufficient sail overlay area', () => {
  const gridWidth = 32
  const gridHeight = 32
  const cellCount = gridWidth * gridHeight
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.5),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salinity: new Float32Array(cellCount).fill(0.15),
  }
  for (let x = 0; x < gridWidth; x += 1) {
    fields.elevation[x] = 0.2
    fields.salinity[x] = 1
  }
  const riverCorridorMask = new Uint8Array(cellCount)
  for (let y = 1; y < 10; y += 1) {
    riverCorridorMask[y * gridWidth + 8] = 1
  }
  const slice = makeSlice({
    gridWidth,
    gridHeight,
    fields,
    riverCorridorMask,
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
  assertMapFocusContract(row?.mapFocus)
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
})

test('runGeographyValidationChecks hard-fails coastConnectedNavigablePath when enforced and short', () => {
  const gridWidth = 8
  const gridHeight = 8
  const cellCount = gridWidth * gridHeight
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.5),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salinity: new Float32Array(cellCount).fill(0.15),
  }
  for (let x = 0; x < gridWidth; x += 1) {
    const oceanIdx = (gridHeight - 1) * gridWidth + x
    fields.elevation[oceanIdx] = 0.2
    fields.salinity[oceanIdx] = 1
  }
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[5 * gridWidth + 3] = 1
  riverCorridorMask[6 * gridWidth + 3] = 1
  const row = runGeographyValidationChecks({
    fields,
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    riverGraph: { nodes: [], edges: [] },
    coastalNodes: [],
    riverCorridorMask,
    gridWidth,
    gridHeight,
    hydrologyStats: {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    validationOptions: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastConnectedNavigablePath: true,
      minCoastConnectedNavigablePathCells: 12,
    },
  }).find((entry) => entry.checkId === 'coastConnectedNavigablePath')
  assert.strictEqual(row?.status, 'fail')
  assertMapFocusContract(row?.mapFocus)
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

test('runGeographyValidationChecks passes salinityOceanGradient for canonical ocean-inland field', () => {
  const row = runGeographyValidationChecks(makeSlice()).find(
    (entry) => entry.checkId === 'salinityOceanGradient',
  )
  assert.strictEqual(row?.status, 'pass')
  assert.strictEqual(row?.category, 'resources')
  assert.strictEqual(row?.rejectable, false)
})

test('runGeographyValidationChecks warns on flat salinity without ocean gradient', () => {
  const gridWidth = 32
  const gridHeight = 32
  const cellCount = gridWidth * gridHeight
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.5),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salinity: new Float32Array(cellCount).fill(0.5),
  }
  for (let i = 0; i < gridWidth; i += 1) {
    fields.elevation[i] = 0.2
  }

  const row = runGeographyValidationChecks(
    makeSlice({
      fields,
      biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    }),
  ).find((entry) => entry.checkId === 'salinityOceanGradient')

  assert.strictEqual(row?.status, 'warn')
})

test('runGeographyValidationChecks evaluates resource outputs from world document fixture', () => {
  const width = 48
  const height = 48
  const biomes = new Uint8Array(width * height).fill(BIOMES.OCEAN)
  biomes[24 * width + 24] = BIOMES.GRASSLAND
  const cellCount = width * height
  const arableRaster = new Float32Array(cellCount).fill(0.5)

  const rows = runGeographyValidationChecks({
    ...makeSlice({ gridWidth: width, gridHeight: height, biomes }),
    arableRaster,
    saltNodes: [{ id: 'salt-0', x: 24, y: 24, score: 0.9 }],
    metalNodes: [{ id: 'metal-0', x: 10, y: 10, score: 0.9 }],
  })

  const saltRow = rows.find((entry) => entry.checkId === 'saltNodeLandProximity')
  const arableRow = rows.find((entry) => entry.checkId === 'arableEnvelopeCoverage')
  assert.strictEqual(saltRow?.status, 'warn')
  assert.strictEqual(arableRow?.status, 'pass')
})
