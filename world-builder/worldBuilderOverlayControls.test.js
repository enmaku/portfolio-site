import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  createDefaultOverlayDisplaySettings,
  formatOverlayControlValue,
} from './worldBuilderOverlayControls.js'

test('createDefaultOverlayDisplaySettings includes arableMinimumProductivity default', () => {
  assert.deepStrictEqual(createDefaultOverlayDisplaySettings(), {
    arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  })
})

test('formatOverlayControlValue formats arableMinimumProductivity to two decimals', () => {
  assert.strictEqual(formatOverlayControlValue('arableMinimumProductivity', 0.4), '0.40')
})
