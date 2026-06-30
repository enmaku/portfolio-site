import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { useWorldBuilderOverlayState } from '../src/composables/useWorldBuilderOverlayState.js'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from './resourceOverlays.js'

/**
 * @returns {{ syncOverlayRenderCache: (state: import('./resourceOverlayState.js').ResourceOverlayPageState) => void, syncedStates: import('./resourceOverlayState.js').ResourceOverlayPageState[], setResourceOverlayVisibility?: never }}
 */
function createViewportSyncSeam() {
  /** @type {import('./resourceOverlayState.js').ResourceOverlayPageState[]} */
  const syncedStates = []
  return {
    syncedStates,
    syncOverlayRenderCache(state) {
      syncedStates.push(state)
    },
  }
}

/**
 * @param {Partial<import('./resourceOverlays.js').OverlayDisplaySettings>} [initial]
 */
function createMockSettingsStore(initial = {}) {
  /** @type {string[]} */
  const persistedKeys = []
  const overlayDisplaySettings = {
    arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
    ...initial,
  }
  return {
    overlayDisplaySettings,
    persistedKeys,
    setOverlayDisplaySetting(key, value) {
      persistedKeys.push(key)
      overlayDisplaySettings[key] = value
    },
    resetToDefaults() {
      overlayDisplaySettings.arableMinimumProductivity = DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY
    },
  }
}

test('useWorldBuilderOverlayState seam routes toggle through syncOverlayRenderCache only', () => {
  const scope = effectScope(true)
  try {
    const viewport = createViewportSyncSeam()
    const settingsStore = createMockSettingsStore()
    const ctx = scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: () => viewport,
        settingsStore,
      }),
    )

    ctx.toggleVisibility('timber', true)

    assert.strictEqual(ctx.visibility.value.timber, true)
    assert.strictEqual(viewport.syncedStates.length, 1)
    assert.strictEqual(viewport.syncedStates[0].visibility.timber, true)
    assert.strictEqual('setResourceOverlayVisibility' in viewport, false)
    assert.deepStrictEqual(settingsStore.persistedKeys, [])
  } finally {
    scope.stop()
  }
})

test('useWorldBuilderOverlayState seam routes resetVisibility through syncOverlayRenderCache only', () => {
  const scope = effectScope(true)
  try {
    const viewport = createViewportSyncSeam()
    const settingsStore = createMockSettingsStore({ arableMinimumProductivity: 0.3 })
    const ctx = scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: () => viewport,
        settingsStore,
      }),
    )

    ctx.toggleVisibility('salt', true)
    viewport.syncedStates.length = 0
    ctx.resetVisibility()

    assert.strictEqual(ctx.visibility.value.salt, false)
    assert.strictEqual(ctx.overlayDisplaySetting('arableMinimumProductivity'), 0.3)
    assert.strictEqual(viewport.syncedStates.length, 1)
    assert.strictEqual(viewport.syncedStates[0].visibility.salt, false)
    assert.strictEqual(viewport.syncedStates[0].displaySettings.arableMinimumProductivity, 0.3)
    assert.strictEqual('setResourceOverlayVisibility' in viewport, false)
    assert.deepStrictEqual(settingsStore.persistedKeys, [])
  } finally {
    scope.stop()
  }
})

test('useWorldBuilderOverlayState seam routes setDisplaySetting through syncOverlayRenderCache and persists once', () => {
  const scope = effectScope(true)
  try {
    const viewport = createViewportSyncSeam()
    const settingsStore = createMockSettingsStore()
    const ctx = scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: () => viewport,
        settingsStore,
      }),
    )

    ctx.setDisplaySetting('arableMinimumProductivity', 0.18)

    assert.strictEqual(ctx.overlayDisplaySetting('arableMinimumProductivity'), 0.18)
    assert.strictEqual(viewport.syncedStates.length, 1)
    assert.strictEqual(
      viewport.syncedStates[0].displaySettings.arableMinimumProductivity,
      0.18,
    )
    assert.deepStrictEqual(settingsStore.persistedKeys, ['arableMinimumProductivity'])
    assert.strictEqual(settingsStore.overlayDisplaySettings.arableMinimumProductivity, 0.18)
    assert.strictEqual('setResourceOverlayVisibility' in viewport, false)
  } finally {
    scope.stop()
  }
})

test('useWorldBuilderOverlayState seam syncToViewport projects owner state when viewport becomes ready', () => {
  const scope = effectScope(true)
  try {
    const viewport = createViewportSyncSeam()
    /** @type {(() => typeof viewport | null) | null} */
    let getViewport = () => null
    const ctx = scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: () => getViewport?.() ?? null,
        settingsStore: createMockSettingsStore(),
      }),
    )

    ctx.toggleVisibility('timber', true)
    assert.strictEqual(viewport.syncedStates.length, 0)

    getViewport = () => viewport
    ctx.syncToViewport()

    assert.strictEqual(viewport.syncedStates.length, 1)
    assert.strictEqual(viewport.syncedStates[0].visibility.timber, true)
  } finally {
    scope.stop()
  }
})

test('useWorldBuilderOverlayState seam applyPersistedDefaults restores store defaults without Pinia dual-write', () => {
  const scope = effectScope(true)
  try {
    const viewport = createViewportSyncSeam()
    const settingsStore = createMockSettingsStore()
    const ctx = scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: () => viewport,
        settingsStore,
      }),
    )

    ctx.toggleVisibility('metals', true)
    ctx.setDisplaySetting('arableMinimumProductivity', 0.42)
    settingsStore.resetToDefaults()
    viewport.syncedStates.length = 0
    settingsStore.persistedKeys.length = 0

    ctx.applyPersistedDefaults()

    assert.strictEqual(ctx.visibility.value.metals, false)
    assert.strictEqual(
      ctx.overlayDisplaySetting('arableMinimumProductivity'),
      DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
    )
    assert.deepStrictEqual(settingsStore.persistedKeys, [])
    assert.strictEqual(viewport.syncedStates.length, 1)
    assert.strictEqual(viewport.syncedStates[0].visibility.metals, false)
  } finally {
    scope.stop()
  }
})
