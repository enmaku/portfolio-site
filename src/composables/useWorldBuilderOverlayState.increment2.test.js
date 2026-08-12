import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from '../../world-builder/resourceOverlays.js'
import { useWorldBuilderOverlayState } from './useWorldBuilderOverlayState.js'

function createMockSettingsStore() {
  return {
    overlayDisplaySettings: {
      arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
    },
    setOverlayDisplaySetting() {},
    resetToDefaults() {},
  }
}

test('toggleVisibility syncs routes overlay state', () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState[]} */
    const syncedStates = []
    const ctx = scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: () => ({
          syncOverlayRenderCache(state) {
            syncedStates.push(state)
          },
        }),
        settingsStore: createMockSettingsStore(),
      }),
    )

    ctx.toggleVisibility('routes', true)
    assert.strictEqual(ctx.visibility.value.routes, true)
    assert.strictEqual(syncedStates.at(-1)?.visibility.routes, true)

    ctx.toggleVisibility('settlements', true)
    assert.strictEqual(ctx.visibility.value.settlements, true)
  } finally {
    scope.stop()
  }
})
