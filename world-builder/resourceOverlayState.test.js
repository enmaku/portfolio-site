import assert from 'node:assert/strict'
import test from 'node:test'
import {
  commitResourceOverlayState,
  createResourceOverlayPageState,
  normalizeResourceOverlayVisibility,
  resetResourceOverlayVisibilityState,
  syncResourceOverlayStateToViewport,
  toggleResourceOverlayVisibility,
  updateOverlayDisplaySetting,
} from './resourceOverlayState.js'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from './resourceOverlays.js'

/**
 * @returns {{ syncOverlayRenderCache: (state: import('./resourceOverlayState.js').ResourceOverlayPageState) => void, syncedStates: import('./resourceOverlayState.js').ResourceOverlayPageState[] }}
 */
function createSyncViewportMock() {
  /** @type {import('./resourceOverlayState.js').ResourceOverlayPageState[]} */
  const syncedStates = []
  return {
    syncedStates,
    syncOverlayRenderCache(state) {
      syncedStates.push(state)
    },
  }
}

test('createResourceOverlayPageState defaults visibility off and uses persisted display settings', () => {
  const state = createResourceOverlayPageState({
    arableMinimumProductivity: 0.25,
  })
  assert.deepStrictEqual(state.visibility, {
    arable: false,
    timber: false,
    metals: false,
    salt: false,
    sail: false,
  })
  assert.strictEqual(state.displaySettings.arableMinimumProductivity, 0.25)
})

test('toggleResourceOverlayVisibility updates page state immutably', () => {
  const initial = createResourceOverlayPageState()
  const visible = toggleResourceOverlayVisibility(initial, 'timber', true)
  assert.strictEqual(initial.visibility.timber, false)
  assert.strictEqual(visible.visibility.timber, true)
})

test('resetResourceOverlayVisibilityState clears toggles without changing display settings', () => {
  const state = toggleResourceOverlayVisibility(
    createResourceOverlayPageState({ arableMinimumProductivity: 0.3 }),
    'salt',
    true,
  )
  const reset = resetResourceOverlayVisibilityState(state)
  assert.strictEqual(reset.visibility.salt, false)
  assert.strictEqual(reset.displaySettings.arableMinimumProductivity, 0.3)
})

test('updateOverlayDisplaySetting updates persisted arable cutoff immutably', () => {
  const state = createResourceOverlayPageState()
  const next = updateOverlayDisplaySetting(state, 'arableMinimumProductivity', 0.15)
  assert.strictEqual(state.displaySettings.arableMinimumProductivity, DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY)
  assert.strictEqual(next.displaySettings.arableMinimumProductivity, 0.15)
})

test('commitResourceOverlayState returns next state and syncs viewport when provided', () => {
  const viewport = createSyncViewportMock()
  const initial = createResourceOverlayPageState()
  const next = commitResourceOverlayState(
    viewport,
    toggleResourceOverlayVisibility(initial, 'timber', true),
  )

  assert.notStrictEqual(next, initial)
  assert.strictEqual(next.visibility.timber, true)
  assert.strictEqual(viewport.syncedStates.length, 1)
  assert.strictEqual(viewport.syncedStates[0], next)
})

test('commitResourceOverlayState skips viewport sync when viewport is absent', () => {
  const initial = createResourceOverlayPageState()
  const next = commitResourceOverlayState(
    null,
    toggleResourceOverlayVisibility(initial, 'salt', true),
  )
  assert.strictEqual(next.visibility.salt, true)
})

test('commitResourceOverlayState syncs slider display setting changes to viewport', () => {
  const viewport = createSyncViewportMock()
  const initial = createResourceOverlayPageState()
  const next = commitResourceOverlayState(
    viewport,
    updateOverlayDisplaySetting(initial, 'arableMinimumProductivity', 0.18),
  )

  assert.strictEqual(next.displaySettings.arableMinimumProductivity, 0.18)
  assert.strictEqual(viewport.syncedStates.length, 1)
  assert.strictEqual(viewport.syncedStates[0].displaySettings.arableMinimumProductivity, 0.18)
})

test('commitResourceOverlayPageState syncs reset visibility to viewport', () => {
  const viewport = createSyncViewportMock()
  const toggled = toggleResourceOverlayVisibility(
    createResourceOverlayPageState({ arableMinimumProductivity: 0.4 }),
    'metals',
    true,
  )
  const next = commitResourceOverlayState(viewport, resetResourceOverlayVisibilityState(toggled))

  assert.strictEqual(next.visibility.metals, false)
  assert.strictEqual(next.displaySettings.arableMinimumProductivity, 0.4)
  assert.strictEqual(viewport.syncedStates.length, 1)
  assert.strictEqual(viewport.syncedStates[0], next)
})

test('commitResourceOverlayState syncs restored persisted display defaults once', () => {
  const viewport = createSyncViewportMock()
  const restored = createResourceOverlayPageState({
    arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  })
  const next = commitResourceOverlayState(viewport, restored)

  assert.strictEqual(next.visibility.metals, false)
  assert.strictEqual(
    next.displaySettings.arableMinimumProductivity,
    DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  )
  assert.strictEqual(viewport.syncedStates.length, 1)
  assert.strictEqual(
    viewport.syncedStates[0].displaySettings.arableMinimumProductivity,
    DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  )
})

test('commitResourceOverlayState can re-project unchanged owner state to viewport', () => {
  const viewport = createSyncViewportMock()
  const state = toggleResourceOverlayVisibility(createResourceOverlayPageState(), 'timber', true)
  const resynced = commitResourceOverlayState(viewport, state)

  assert.deepStrictEqual(resynced.visibility, state.visibility)
  assert.strictEqual(viewport.syncedStates.length, 1)
  assert.deepStrictEqual(viewport.syncedStates[0].visibility, state.visibility)
})

test('normalizeResourceOverlayVisibility coerces null and undefined to false', () => {
  assert.deepStrictEqual(
    normalizeResourceOverlayVisibility({
      arable: true,
      timber: null,
      metals: undefined,
      salt: false,
    }),
    {
      arable: true,
      timber: false,
      metals: false,
      salt: false,
      sail: false,
    },
  )
})

test('normalizeResourceOverlayVisibility fills missing overlay ids with false', () => {
  assert.deepStrictEqual(normalizeResourceOverlayVisibility({ timber: true }), {
    arable: false,
    timber: true,
    metals: false,
    salt: false,
    sail: false,
  })
})

test('toggleResourceOverlayVisibility on then off stores false not null or undefined', () => {
  const initial = createResourceOverlayPageState()
  const on = toggleResourceOverlayVisibility(initial, 'salt', true)
  const off = toggleResourceOverlayVisibility(on, 'salt', null)

  assert.strictEqual(on.visibility.salt, true)
  assert.strictEqual(off.visibility.salt, false)
  assert.notStrictEqual(off.visibility.salt, null)
  assert.notStrictEqual(off.visibility.salt, undefined)
})

test('commitResourceOverlayState normalizes visibility before sync', () => {
  const viewport = createSyncViewportMock()
  const dirty = createResourceOverlayPageState()
  dirty.visibility.timber = null
  delete dirty.visibility.salt

  const committed = commitResourceOverlayState(viewport, dirty)

  assert.deepStrictEqual(committed.visibility, {
    arable: false,
    timber: false,
    metals: false,
    salt: false,
    sail: false,
  })
  assert.deepStrictEqual(viewport.syncedStates[0].visibility, committed.visibility)
})

test('syncResourceOverlayStateToViewport pushes owner state to viewport render cache API', () => {
  const viewport = createSyncViewportMock()
  const state = toggleResourceOverlayVisibility(
    createResourceOverlayPageState({ arableMinimumProductivity: 0.22 }),
    'metals',
    true,
  )

  syncResourceOverlayStateToViewport(viewport, state)

  assert.strictEqual(viewport.syncedStates.length, 1)
  assert.strictEqual(viewport.syncedStates[0], state)
  assert.strictEqual(viewport.syncedStates[0].visibility.metals, true)
  assert.strictEqual(viewport.syncedStates[0].displaySettings.arableMinimumProductivity, 0.22)
})
