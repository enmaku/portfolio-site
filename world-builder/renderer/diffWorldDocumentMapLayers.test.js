import assert from 'node:assert/strict'
import test from 'node:test'
import { diffWorldDocumentMapLayers } from './diffWorldDocumentMapLayers.js'

/**
 * @param {Object} [overrides]
 * @returns {import('../core/types.js').WorldDocument}
 */
function baseDocument(overrides = {}) {
  const gridWidth = 4
  const gridHeight = 4
  const cellCount = gridWidth * gridHeight
  return {
    gridWidth,
    gridHeight,
    biomes: new Uint8Array(cellCount),
    displayBiomes: new Uint8Array(cellCount),
    fields: {
      elevation: new Float32Array(cellCount),
      drainage: new Float32Array(cellCount),
    },
    arableRaster: new Float32Array(cellCount),
    timberRaster: new Float32Array(cellCount),
    metalsRaster: new Float32Array(cellCount),
    lakeMask: new Uint8Array(cellCount),
    riverNetworkMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    flowDirection: new Int16Array(cellCount).fill(-1),
    coastalNodes: [],
    metalNodes: [],
    saltNodes: [],
    ...overrides,
  }
}

test('diffWorldDocumentMapLayers returns null without a previous document', () => {
  const next = baseDocument()
  assert.strictEqual(diffWorldDocumentMapLayers(null, next), null)
  assert.strictEqual(diffWorldDocumentMapLayers(undefined, next), null)
})

test('diffWorldDocumentMapLayers returns null when grid dimensions change', () => {
  const previous = baseDocument()
  const next = baseDocument({ gridWidth: 8, gridHeight: 8 })
  assert.strictEqual(diffWorldDocumentMapLayers(previous, next), null)
})

test('diffWorldDocumentMapLayers returns empty when documents share layer inputs', () => {
  const previous = baseDocument()
  const next = {
    ...previous,
    displayBiomes: previous.displayBiomes,
    fields: previous.fields,
    arableRaster: previous.arableRaster,
    timberRaster: previous.timberRaster,
    metalsRaster: previous.metalsRaster,
    lakeMask: previous.lakeMask,
    riverNetworkMask: previous.riverNetworkMask,
    riverCorridorMask: previous.riverCorridorMask,
    flowDirection: previous.flowDirection,
  }
  assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, next), [])
})

test('diffWorldDocumentMapLayers detects terrain and contour changes independently', () => {
  const previous = baseDocument()
  const nextDisplay = baseDocument({
    displayBiomes: Uint8Array.from(previous.displayBiomes, (value, index) =>
      index === 0 ? value + 1 : value,
    ),
  })
  const nextElevation = baseDocument({
    fields: {
      ...previous.fields,
      elevation: Float32Array.from(previous.fields.elevation, (value, index) =>
        index === 1 ? value + 0.1 : value,
      ),
      drainage: previous.fields.drainage,
    },
  })

  assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, nextDisplay), ['terrain'])
  assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, nextElevation), ['contours'])
})

test('diffWorldDocumentMapLayers detects resource raster changes only for affected layers', () => {
  const previous = baseDocument()
  const nextTimber = baseDocument({
    timberRaster: Float32Array.from(previous.timberRaster, (value, index) =>
      index === 2 ? value + 0.2 : value,
    ),
  })

  assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, nextTimber), ['timber'])
})

test('diffWorldDocumentMapLayers detects hydrology and lake mask changes', () => {
  const previous = baseDocument()
  const nextLakes = baseDocument({
    lakeMask: Uint8Array.from(previous.lakeMask, (value, index) => (index === 3 ? 1 : value)),
  })
  const nextRivers = baseDocument({
    riverCorridorMask: Uint8Array.from(previous.riverCorridorMask, (value, index) =>
      index === 4 ? 1 : value,
    ),
  })

  assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, nextLakes), ['lakes'])
  assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, nextRivers), ['rivers'])
})

test('diffWorldDocumentMapLayers detects vector overlay node changes', () => {
  const previous = baseDocument({
    metalNodes: [{ id: 'm1', x: 1, y: 2, score: 0.5 }],
  })
  const next = baseDocument({
    metalNodes: [{ id: 'm1', x: 1, y: 2, score: 0.6 }],
  })

  assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, next), ['vectorOverlays'])
})
