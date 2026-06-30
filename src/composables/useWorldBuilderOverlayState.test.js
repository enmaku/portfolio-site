import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from '../../world-builder/resourceOverlays.js'
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
 * @param {import('vue').EffectScope} scope
 * @param {{
 *   getViewport?: () => { syncOverlayRenderCache: (state: import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState) => void } | null,
 *   settingsStore?: ReturnType<typeof createMockSettingsStore>,
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
      }),
    ),
  }
}

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
