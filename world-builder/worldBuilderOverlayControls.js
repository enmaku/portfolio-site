/** Minimum arable productivity (0–1) required before the overlay draws a cell. */
export const DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY = 0.4

/**
 * @typedef {Object} OverlayDisplaySettings
 * @property {number} arableMinimumProductivity
 */

/**
 * @returns {OverlayDisplaySettings}
 */
export function createDefaultOverlayDisplaySettings() {
  return {
    arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  }
}

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
      'Minimum arable productivity before the overlay draws a cell. Higher values hide marginal scrub, hills, and desert; lower values show the full continuous raster.',
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
