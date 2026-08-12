import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultResourceOverlayVisibility } from './resourceOverlays.js'
import {
  RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY,
  loadPersistedResourceOverlayVisibility,
  persistResourceOverlayVisibility,
} from './resourceOverlayVisibilityStorage.js'

/**
 * @returns {Storage}
 */
function createMemoryStorage(initial = {}) {
  /** @type {Record<string, string>} */
  const store = { ...initial }
  return {
    get length() {
      return Object.keys(store).length
    },
    clear() {
      for (const key of Object.keys(store)) {
        delete store[key]
      }
    },
    getItem(key) {
      return Object.hasOwn(store, key) ? store[key] : null
    },
    key(index) {
      return Object.keys(store)[index] ?? null
    },
    removeItem(key) {
      delete store[key]
    },
    setItem(key, value) {
      store[key] = value
    },
  }
}

test('persistResourceOverlayVisibility writes only the visibility map', () => {
  const storage = createMemoryStorage({
    'portfolio-world-builder-settings': JSON.stringify({
      colonizationSession: { epoch: 99, historyLog: [{ kind: 'founding', epoch: 0 }] },
    }),
  })

  persistResourceOverlayVisibility({ salt: true, timber: false }, storage)

  const dedicated = JSON.parse(storage.getItem(RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY) ?? '{}')
  assert.strictEqual(dedicated.salt, true)
  assert.strictEqual(dedicated.timber, false)

  const settings = JSON.parse(storage.getItem('portfolio-world-builder-settings') ?? '{}')
  assert.strictEqual(settings.colonizationSession.epoch, 99)
  assert.strictEqual(settings.resourceOverlayVisibility, undefined)
})

test('loadPersistedResourceOverlayVisibility prefers dedicated storage key', () => {
  const storage = createMemoryStorage({
    [RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY]: JSON.stringify({ metals: true }),
    'portfolio-world-builder-settings': JSON.stringify({
      resourceOverlayVisibility: { metals: false, salt: true },
    }),
  })

  const loaded = loadPersistedResourceOverlayVisibility(storage)
  assert.strictEqual(loaded.metals, true)
  assert.strictEqual(loaded.salt, false)
})

test('loadPersistedResourceOverlayVisibility migrates legacy settings blob once', () => {
  const storage = createMemoryStorage({
    'portfolio-world-builder-settings': JSON.stringify({
      resourceOverlayVisibility: { routes: true },
    }),
  })

  const loaded = loadPersistedResourceOverlayVisibility(storage)
  assert.strictEqual(loaded.routes, true)
})

test('loadPersistedResourceOverlayVisibility returns defaults when storage is empty', () => {
  const loaded = loadPersistedResourceOverlayVisibility(createMemoryStorage())
  assert.deepStrictEqual(loaded, createDefaultResourceOverlayVisibility())
})
