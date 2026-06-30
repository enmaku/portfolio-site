import assert from 'node:assert/strict'
import test from 'node:test'
import {
  commitResourceOverlayState,
  createResourceOverlayPageState,
  resetResourceOverlayVisibilityState,
  syncResourceOverlayStateToViewport,
  toggleResourceOverlayVisibility,
  updateOverlayDisplaySetting,
} from './resourceOverlayState.js'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from './resourceOverlays.js'

test('createResourceOverlayPageState defaults visibility off and uses persisted display settings', () => {
  const state = createResourceOverlayPageState({
    arableMinimumProductivity: 0.25,
  })
  assert.deepStrictEqual(state.visibility, {
    arable: false,
    timber: false,
    metals: false,
    salt: false,
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
  const calls = []
  const viewport = {
    setResourceOverlayVisibility(resourceId, visible) {
      calls.push(['visibility', resourceId, visible])
    },
    setArableOverlayMinimumProductivity(value) {
      calls.push(['arableMinimumProductivity', value])
    },
  }
  const initial = createResourceOverlayPageState()
  const next = commitResourceOverlayState(
    viewport,
    toggleResourceOverlayVisibility(initial, 'timber', true),
  )

  assert.notStrictEqual(next, initial)
  assert.strictEqual(next.visibility.timber, true)
  assert.deepStrictEqual(calls, [
    ['arableMinimumProductivity', DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY],
    ['visibility', 'arable', false],
    ['visibility', 'timber', true],
    ['visibility', 'metals', false],
    ['visibility', 'salt', false],
  ])
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
  const calls = []
  const viewport = {
    setResourceOverlayVisibility(resourceId, visible) {
      calls.push(['visibility', resourceId, visible])
    },
    setArableOverlayMinimumProductivity(value) {
      calls.push(['arableMinimumProductivity', value])
    },
  }
  const initial = createResourceOverlayPageState()
  const next = commitResourceOverlayState(
    viewport,
    updateOverlayDisplaySetting(initial, 'arableMinimumProductivity', 0.18),
  )

  assert.strictEqual(next.displaySettings.arableMinimumProductivity, 0.18)
  assert.deepStrictEqual(calls, [
    ['arableMinimumProductivity', 0.18],
    ['visibility', 'arable', false],
    ['visibility', 'timber', false],
    ['visibility', 'metals', false],
    ['visibility', 'salt', false],
  ])
})

test('commitResourceOverlayState syncs reset visibility to viewport', () => {
  const calls = []
  const viewport = {
    setResourceOverlayVisibility(resourceId, visible) {
      calls.push(['visibility', resourceId, visible])
    },
    setArableOverlayMinimumProductivity(value) {
      calls.push(['arableMinimumProductivity', value])
    },
  }
  const toggled = toggleResourceOverlayVisibility(
    createResourceOverlayPageState({ arableMinimumProductivity: 0.4 }),
    'metals',
    true,
  )
  const next = commitResourceOverlayState(viewport, resetResourceOverlayVisibilityState(toggled))

  assert.strictEqual(next.visibility.metals, false)
  assert.strictEqual(next.displaySettings.arableMinimumProductivity, 0.4)
  assert.deepStrictEqual(calls, [
    ['arableMinimumProductivity', 0.4],
    ['visibility', 'arable', false],
    ['visibility', 'timber', false],
    ['visibility', 'metals', false],
    ['visibility', 'salt', false],
  ])
})

test('commitResourceOverlayState can re-project unchanged owner state to viewport', () => {
  const calls = []
  const viewport = {
    setResourceOverlayVisibility(resourceId, visible) {
      calls.push(['visibility', resourceId, visible])
    },
    setArableOverlayMinimumProductivity(value) {
      calls.push(['arableMinimumProductivity', value])
    },
  }
  const state = toggleResourceOverlayVisibility(createResourceOverlayPageState(), 'timber', true)
  const resynced = commitResourceOverlayState(viewport, state)

  assert.strictEqual(resynced, state)
  assert.deepStrictEqual(calls, [
    ['arableMinimumProductivity', DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY],
    ['visibility', 'arable', false],
    ['visibility', 'timber', true],
    ['visibility', 'metals', false],
    ['visibility', 'salt', false],
  ])
})

test('syncResourceOverlayStateToViewport pushes visibility and arable cutoff to viewport API', () => {
  const calls = []
  const viewport = {
    setResourceOverlayVisibility(resourceId, visible) {
      calls.push(['visibility', resourceId, visible])
    },
    setArableOverlayMinimumProductivity(value) {
      calls.push(['arableMinimumProductivity', value])
    },
  }

  syncResourceOverlayStateToViewport(
    viewport,
    toggleResourceOverlayVisibility(
      createResourceOverlayPageState({ arableMinimumProductivity: 0.22 }),
      'metals',
      true,
    ),
  )

  assert.deepStrictEqual(calls, [
    ['arableMinimumProductivity', 0.22],
    ['visibility', 'arable', false],
    ['visibility', 'timber', false],
    ['visibility', 'metals', true],
    ['visibility', 'salt', false],
  ])
})
