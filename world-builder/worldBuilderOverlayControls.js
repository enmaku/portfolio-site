import {
  createDefaultOverlayDisplaySettings,
  DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
} from './resourceOverlays.js'

/** @typedef {import('./resourceOverlays.js').OverlayDisplaySettings} OverlayDisplaySettings */

export { createDefaultOverlayDisplaySettings, DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY }

/**
 * Sidebar overlay display controls (do not trigger world regeneration).
 * @type {ReadonlyArray<{
 *   key: keyof OverlayDisplaySettings,
 *   label: string,
 *   tooltip: string,
 *   min: number,
 *   max: number,
 *   step: number,
 *   testId: string,
 * }>}
 */
export const WORLD_BUILDER_OVERLAY_CONTROL_DEFINITIONS = [
  {
    key: 'arableMinimumProductivity',
    label: 'Arable overlay cutoff',
    tooltip:
      'Display-only filter: minimum arable productivity before the overlay draws a cell. Defaults to the generation threshold; raising it hides marginal land without regenerating the world.',
    min: 0,
    max: 0.6,
    step: 0.01,
    testId: 'world-builder-overlay-arable-minimum',
  },
]

/**
 * @param {keyof OverlayDisplaySettings} key
 * @param {number} value
 * @returns {string}
 */
export function formatOverlayControlValue(key, value) {
  if (key === 'arableMinimumProductivity') {
    return value.toFixed(2)
  }
  return value.toFixed(2)
}
