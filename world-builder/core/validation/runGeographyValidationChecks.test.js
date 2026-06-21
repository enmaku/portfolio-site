import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { runGeographyValidationChecks } from './runGeographyValidationChecks.js'

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
    ...overrides,
  }
}

test('runGeographyValidationChecks returns all check ids', () => {
  const rows = runGeographyValidationChecks(makeSlice())
  const ids = rows.map((row) => row.checkId)
  assert.deepStrictEqual(ids, [
    'navigableRiverQuota',
    'coastMouth',
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

test('runGeographyValidationChecks detects resource mismatch', () => {
  const row = runGeographyValidationChecks(makeSlice()).find(
    (entry) => entry.checkId === 'resourceMismatch',
  )
  assert.strictEqual(row?.status, 'warn')
  assert.ok(row?.mapFocus)
})
