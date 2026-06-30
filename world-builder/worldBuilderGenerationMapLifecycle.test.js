import assert from 'node:assert/strict'
import test from 'node:test'
import { createGenerationMapLifecycle } from './worldBuilderGenerationMapLifecycle.js'
import { diffWorldDocumentMapLayers } from './renderer/diffWorldDocumentMapLayers.js'

/**
 * @param {Object} [overrides]
 * @returns {import('./core/types.js').WorldDocument}
 */
function fakeWorldDocument(overrides = {}) {
  return {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
    ...overrides,
  }
}

/**
 * @param {Object} options
 * @param {() => unknown} [options.getMapHost]
 * @param {() => ((host: unknown, doc: import('./core/types.js').WorldDocument) => Promise<{
 *   updateWorldDocument: (doc: import('./core/types.js').WorldDocument) => void,
 *   fitToWorld: () => void,
 *   destroy: () => void,
 * }>) | null} [options.getCreateViewport]
 */
function createTestLifecycle(options = {}) {
  let createCount = 0
  let updateCount = 0
  let fitToWorldCount = 0
  /** @type {import('./core/types.js').WorldDocument[]} */
  const createdWith = []
  /** @type {import('./core/types.js').WorldDocument[]} */
  const updatedWith = []
  /** @type {Array<import('./renderer/mapLayerRefresh.js').MapLayerId[] | null | undefined>} */
  const updateChangedLayers = []

  const lifecycle = createGenerationMapLifecycle({
    getMapHost: options.getMapHost ?? (() => ({})),
    getCreateViewport:
      options.getCreateViewport ??
      (() => async (_host, doc) => {
        createCount += 1
        createdWith.push(doc)
        await new Promise((resolve) => setTimeout(resolve, 5))
        return {
          updateWorldDocument(nextDoc, updateOptions) {
            updateCount += 1
            updatedWith.push(nextDoc)
            updateChangedLayers.push(updateOptions?.changedLayers ?? null)
          },
          fitToWorld() {
            fitToWorldCount += 1
          },
          destroy() {},
        }
      }),
  })

  return {
    lifecycle,
    metrics: () => ({
      createCount,
      updateCount,
      fitToWorldCount,
      createdWith,
      updatedWith,
      updateChangedLayers,
    }),
  }
}

test('concurrent applyWorldDocument calls create viewport only once', async () => {
  const { lifecycle, metrics } = createTestLifecycle()
  const docA = fakeWorldDocument({ gridWidth: 4 })
  const docB = fakeWorldDocument({ gridWidth: 8 })

  await Promise.all([lifecycle.applyWorldDocument(docA), lifecycle.applyWorldDocument(docB)])

  const { createCount, updateCount, createdWith, updatedWith, fitToWorldCount } = metrics()
  assert.strictEqual(createCount, 1)
  assert.strictEqual(createdWith.length, 1)
  assert.strictEqual(createdWith[0], docA)
  assert.strictEqual(updateCount, 1)
  assert.strictEqual(updatedWith[0], docB)
  assert.strictEqual(fitToWorldCount, 0)
})

test('sequential applyWorldDocument updates without recreating viewport', async () => {
  const { lifecycle, metrics } = createTestLifecycle()
  const docA = fakeWorldDocument()
  const docB = fakeWorldDocument({ gridWidth: 6 })

  await lifecycle.applyWorldDocument(docA)
  await lifecycle.applyWorldDocument(docB)

  const { createCount, updateCount, fitToWorldCount } = metrics()
  assert.strictEqual(createCount, 1)
  assert.strictEqual(updateCount, 1)
  assert.strictEqual(fitToWorldCount, 0)
})

test('applyWorldDocument no-ops when map host or factory is unavailable', async () => {
  const { lifecycle, metrics } = createTestLifecycle({
    getMapHost: () => null,
    getCreateViewport: () => null,
  })

  await lifecycle.applyWorldDocument(fakeWorldDocument())

  assert.strictEqual(metrics().createCount, 0)
  assert.strictEqual(lifecycle.getViewport(), null)
})

test('destroy clears viewport and in-flight init', async () => {
  let destroyed = false
  const { lifecycle } = createTestLifecycle({
    getCreateViewport: () => async () => ({
      updateWorldDocument() {},
      fitToWorld() {},
      destroy() {
        destroyed = true
      },
    }),
  })

  await lifecycle.applyWorldDocument(fakeWorldDocument())
  lifecycle.destroy()

  assert.strictEqual(destroyed, true)
  assert.strictEqual(lifecycle.getViewport(), null)
})

test('destroy during in-flight init discards completed viewport', async () => {
  let viewportDestroyed = false
  const { lifecycle } = createTestLifecycle({
    getCreateViewport: () => async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return {
        updateWorldDocument() {},
        fitToWorld() {},
        destroy() {
          viewportDestroyed = true
        },
      }
    },
  })

  const initPromise = lifecycle.applyWorldDocument(fakeWorldDocument())
  lifecycle.destroy()
  await initPromise

  assert.strictEqual(viewportDestroyed, true)
  assert.strictEqual(lifecycle.getViewport(), null)
})

test('applyWorldDocument no-ops after destroy', async () => {
  const { lifecycle, metrics } = createTestLifecycle()

  await lifecycle.applyWorldDocument(fakeWorldDocument())
  lifecycle.destroy()
  await lifecycle.applyWorldDocument(fakeWorldDocument({ gridWidth: 6 }))

  assert.strictEqual(metrics().createCount, 1)
  assert.strictEqual(metrics().updateCount, 0)
  assert.strictEqual(lifecycle.getViewport(), null)
})

test('onViewportReady runs once after first viewport create', async () => {
  let readyCount = 0
  const lifecycleWithReady = createGenerationMapLifecycle({
    getMapHost: () => ({}),
    getCreateViewport: () => async () => ({
      updateWorldDocument() {},
      fitToWorld() {},
      destroy() {},
    }),
    onViewportReady() {
      readyCount += 1
    },
  })

  await Promise.all([
    lifecycleWithReady.applyWorldDocument(fakeWorldDocument()),
    lifecycleWithReady.applyWorldDocument(fakeWorldDocument({ gridWidth: 6 })),
  ])

  assert.strictEqual(readyCount, 1)
})

test('applyWorldDocument forwards changedLayers from upstream layer diff', async () => {
  const { lifecycle, metrics } = createTestLifecycle()
  const cellCount = 4
  const docA = fakeWorldDocument({
    gridWidth: 2,
    gridHeight: 2,
    displayBiomes: new Uint8Array(cellCount),
    arableRaster: new Float32Array(cellCount),
    timberRaster: new Float32Array(cellCount),
    metalsRaster: new Float32Array(cellCount),
  })
  const docB = fakeWorldDocument({
    gridWidth: 2,
    gridHeight: 2,
    displayBiomes: Uint8Array.from(docA.displayBiomes, (value, index) =>
      index === 0 ? value + 1 : value,
    ),
    arableRaster: docA.arableRaster,
    timberRaster: docA.timberRaster,
    metalsRaster: docA.metalsRaster,
  })

  await lifecycle.applyWorldDocument(docA)
  await lifecycle.applyWorldDocument(docB)

  const { updateChangedLayers } = metrics()
  assert.deepStrictEqual(updateChangedLayers[0], diffWorldDocumentMapLayers(docA, docB))
  assert.deepStrictEqual(updateChangedLayers[0], ['terrain'])
})

test('applyWorldDocument omits changedLayers when grid dimensions change', async () => {
  const { lifecycle, metrics } = createTestLifecycle()
  const docA = fakeWorldDocument({ gridWidth: 2, gridHeight: 2 })
  const docB = fakeWorldDocument({ gridWidth: 4, gridHeight: 4 })

  await lifecycle.applyWorldDocument(docA)
  await lifecycle.applyWorldDocument(docB)

  assert.strictEqual(metrics().updateChangedLayers[0], null)
})
