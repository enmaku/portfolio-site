import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
