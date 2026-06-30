import assert from 'node:assert/strict'
import test from 'node:test'
import { createGenerationMapLifecycle } from './worldBuilderGenerationMapLifecycle.js'

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
 *   destroy: () => void,
 * }>) | null} [options.getCreateViewport]
 */
function createTestLifecycle(options = {}) {
  let createCount = 0
  let updateCount = 0
  /** @type {import('./core/types.js').WorldDocument[]} */
  const createdWith = []
  /** @type {import('./core/types.js').WorldDocument[]} */
  const updatedWith = []

  const lifecycle = createGenerationMapLifecycle({
    getMapHost: options.getMapHost ?? (() => ({})),
    getCreateViewport:
      options.getCreateViewport ??
      (() => async (_host, doc) => {
        createCount += 1
        createdWith.push(doc)
        await new Promise((resolve) => setTimeout(resolve, 5))
        return {
          updateWorldDocument(nextDoc) {
            updateCount += 1
            updatedWith.push(nextDoc)
          },
          destroy() {},
        }
      }),
  })

  return {
    lifecycle,
    metrics: () => ({ createCount, updateCount, createdWith, updatedWith }),
  }
}

test('concurrent applyWorldDocument calls create viewport only once', async () => {
  const { lifecycle, metrics } = createTestLifecycle()
  const docA = fakeWorldDocument({ gridWidth: 4 })
  const docB = fakeWorldDocument({ gridWidth: 8 })

  await Promise.all([lifecycle.applyWorldDocument(docA), lifecycle.applyWorldDocument(docB)])

  const { createCount, updateCount, createdWith, updatedWith } = metrics()
  assert.strictEqual(createCount, 1)
  assert.strictEqual(createdWith.length, 1)
  assert.strictEqual(createdWith[0], docA)
  assert.strictEqual(updateCount, 1)
  assert.strictEqual(updatedWith[0], docB)
})

test('sequential applyWorldDocument updates without recreating viewport', async () => {
  const { lifecycle, metrics } = createTestLifecycle()
  const docA = fakeWorldDocument()
  const docB = fakeWorldDocument({ gridWidth: 6 })

  await lifecycle.applyWorldDocument(docA)
  await lifecycle.applyWorldDocument(docB)

  const { createCount, updateCount } = metrics()
  assert.strictEqual(createCount, 1)
  assert.strictEqual(updateCount, 1)
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
