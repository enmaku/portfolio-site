import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from '../../world-builder/resourceOverlays.js'
import { RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY } from '../../world-builder/resourceOverlayVisibilityStorage.js'
import { useWorldBuilderOverlayState } from './useWorldBuilderOverlayState.js'

/**
 * @param {Partial<import('../../world-builder/resourceOverlays.js').OverlayDisplaySettings>} [initial]
 */
function createMockSettingsStore(initial = {}) {
  const overlayDisplaySettings = {
    arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
    ...initial,
  }
  return {
    overlayDisplaySettings,
    setOverlayDisplaySetting(key, value) {
      overlayDisplaySettings[key] = value
    },
    resetToDefaults() {
      overlayDisplaySettings.arableMinimumProductivity = DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY
    },
  }
}

/**
 * @returns {Storage}
 */
function createMemoryVisibilityStorage(initial = {}) {
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

/**
 * @param {import('vue').EffectScope} scope
 * @param {{
 *   getViewport?: () => { syncOverlayRenderCache: (state: import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState) => void } | null,
 *   settingsStore?: ReturnType<typeof createMockSettingsStore>,
 *   visibilityStorage?: Storage,
 * }} [overrides]
 */
function mountOverlayState(scope, overrides = {}) {
  /** @type {import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState[]} */
  const syncedStates = []
  const viewport =
    overrides.getViewport === undefined
      ? {
          syncOverlayRenderCache(state) {
            syncedStates.push(state)
          },
        }
      : overrides.getViewport?.()

  return {
    syncedStates,
    ctx: scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: overrides.getViewport ?? (() => viewport),
        settingsStore: overrides.settingsStore ?? createMockSettingsStore(),
        visibilityStorage: overrides.visibilityStorage,
      }),
    ),
  }
}

test('toggleVisibility on then off stores false for checkbox binding', () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountOverlayState(scope)

    ctx.toggleVisibility('arable', true)
    ctx.toggleVisibility('arable', false)
    ctx.toggleVisibility('arable', null)

    assert.strictEqual(ctx.visibility.value.arable, false)
    for (const value of Object.values(ctx.visibility.value)) {
      assert.strictEqual(typeof value, 'boolean')
    }
  } finally {
    scope.stop()
  }
})

test('toggleVisibility updates owner state and syncs viewport', () => {
  const scope = effectScope(true)
  try {
    const { ctx, syncedStates } = mountOverlayState(scope)

    ctx.toggleVisibility('timber', true)

    assert.strictEqual(ctx.visibility.value.timber, true)
    assert.strictEqual(syncedStates.length, 1)
    assert.strictEqual(syncedStates[0].visibility.timber, true)
    assert.strictEqual(
      syncedStates[0].displaySettings.arableMinimumProductivity,
      DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
    )
  } finally {
    scope.stop()
  }
})

test('toggleVisibility exposes the economy inspect layer ids', () => {
  const scope = effectScope(true)
  try {
    const { ctx, syncedStates } = mountOverlayState(scope)

    ctx.toggleVisibility('wealth', true)
    ctx.toggleVisibility('tradeRoutes', true)

    assert.strictEqual(ctx.visibility.value.wealth, true)
    assert.strictEqual(ctx.visibility.value.tradeRoutes, true)
    assert.strictEqual(syncedStates.at(-1).visibility.wealth, true)
    assert.strictEqual(syncedStates.at(-1).visibility.tradeRoutes, true)
  } finally {
    scope.stop()
  }
})

test('setDisplaySetting persists to settings store once and syncs viewport', () => {
  const scope = effectScope(true)
  try {
    const settingsStore = createMockSettingsStore()
    const { ctx, syncedStates } = mountOverlayState(scope, { settingsStore })

    ctx.setDisplaySetting('arableMinimumProductivity', 0.18)

    assert.strictEqual(
      settingsStore.overlayDisplaySettings.arableMinimumProductivity,
      0.18,
    )
    assert.strictEqual(ctx.overlayDisplaySetting('arableMinimumProductivity'), 0.18)
    assert.strictEqual(syncedStates.length, 1)
    assert.strictEqual(syncedStates[0].displaySettings.arableMinimumProductivity, 0.18)
  } finally {
    scope.stop()
  }
})

test('resetVisibility clears toggles without changing persisted display settings', () => {
  const scope = effectScope(true)
  try {
    const settingsStore = createMockSettingsStore({ arableMinimumProductivity: 0.3 })
    const { ctx, syncedStates } = mountOverlayState(scope, { settingsStore })

    ctx.toggleVisibility('salt', true)
    syncedStates.length = 0
    ctx.resetVisibility()

    assert.strictEqual(ctx.visibility.value.salt, false)
    assert.strictEqual(ctx.overlayDisplaySetting('arableMinimumProductivity'), 0.3)
    assert.strictEqual(syncedStates.length, 1)
    assert.strictEqual(syncedStates[0].visibility.salt, false)
    assert.strictEqual(syncedStates[0].displaySettings.arableMinimumProductivity, 0.3)
  } finally {
    scope.stop()
  }
})

test('applyPersistedDefaults restores display settings and visibility from store', () => {
  const scope = effectScope(true)
  try {
    const settingsStore = createMockSettingsStore()
    const { ctx } = mountOverlayState(scope, { settingsStore })

    ctx.toggleVisibility('metals', true)
    ctx.setDisplaySetting('arableMinimumProductivity', 0.42)
    settingsStore.resetToDefaults()
    ctx.applyPersistedDefaults()

    assert.strictEqual(ctx.visibility.value.metals, false)
    assert.strictEqual(
      ctx.overlayDisplaySetting('arableMinimumProductivity'),
      DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
    )
  } finally {
    scope.stop()
  }
})

test('syncToViewport re-projects unchanged owner state when viewport becomes ready', () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState[]} */
    const syncedStates = []
    /** @type {(() => { syncOverlayRenderCache: (state: import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState) => void } | null) | null} */
    let getViewport = null
    const { ctx } = mountOverlayState(scope, {
      getViewport: () => getViewport?.() ?? null,
    })

    ctx.toggleVisibility('timber', true)
    assert.strictEqual(syncedStates.length, 0)

    getViewport = () => ({
      syncOverlayRenderCache(state) {
        syncedStates.push(state)
      },
    })
    ctx.syncToViewport()

    assert.strictEqual(syncedStates.length, 1)
    assert.strictEqual(syncedStates[0].visibility.timber, true)
  } finally {
    scope.stop()
  }
})

test('hydrateFromPersistedSettings loads store display settings without viewport sync', async () => {
  const scope = effectScope(true)
  try {
    const settingsStore = createMockSettingsStore({ arableMinimumProductivity: 0.25 })
    /** @type {import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState[]} */
    const syncedStates = []
    const { ctx } = mountOverlayState(scope, {
      settingsStore,
      getViewport: () => ({
        syncOverlayRenderCache(state) {
          syncedStates.push(state)
        },
      }),
    })

    ctx.hydrateFromPersistedSettings()
    await nextTick()

    assert.strictEqual(ctx.overlayDisplaySetting('arableMinimumProductivity'), 0.25)
    assert.strictEqual(syncedStates.length, 0)
  } finally {
    scope.stop()
  }
})

test('toggleVisibility persists only overlay booleans to isolated storage', () => {
  const scope = effectScope(true)
  try {
    const visibilityStorage = createMemoryVisibilityStorage({
      'portfolio-world-builder-settings': JSON.stringify({ colonizationSession: { epoch: 3 } }),
    })
    const { ctx } = mountOverlayState(scope, { visibilityStorage })

    ctx.toggleVisibility('explorationFog', true)

    const dedicated = JSON.parse(
      visibilityStorage.getItem(RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY) ?? '{}',
    )
    assert.strictEqual(dedicated.explorationFog, true)
    assert.strictEqual(
      JSON.parse(visibilityStorage.getItem('portfolio-world-builder-settings') ?? '{}').epoch,
      undefined,
    )
  } finally {
    scope.stop()
  }
})

test('hydrateFromPersistedSettings restores stored overlay booleans', async () => {
  const scope = effectScope(true)
  try {
    const visibilityStorage = createMemoryVisibilityStorage({
      [RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY]: JSON.stringify({ salt: true }),
    })
    const { ctx } = mountOverlayState(scope, { visibilityStorage })

    ctx.toggleVisibility('timber', true)
    visibilityStorage.setItem(
      RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY,
      JSON.stringify({ salt: true }),
    )
    ctx.hydrateFromPersistedSettings()
    await nextTick()

    assert.strictEqual(ctx.visibility.value.salt, true)
    assert.strictEqual(ctx.visibility.value.timber, false)
  } finally {
    scope.stop()
  }
})
