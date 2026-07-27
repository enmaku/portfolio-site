/**
 * Overlay visibility presets for campaign kit map pages.
 */

import { createDefaultResourceOverlayVisibility } from '../../resourceOverlays.js'

/**
 * Settlements + Routes (Settlement IDs are a separate kit-only label toggle).
 * @returns {Record<string, boolean>}
 */
export function campaignKitSettlementsMapVisibility() {
  const visibility = createDefaultResourceOverlayVisibility()
  visibility.settlements = true
  visibility.routes = true
  return visibility
}

/**
 * Arable, timber, metals, salt.
 * @returns {Record<string, boolean>}
 */
export function campaignKitResourcesMapVisibility() {
  const visibility = createDefaultResourceOverlayVisibility()
  visibility.arable = true
  visibility.timber = true
  visibility.metals = true
  visibility.salt = true
  return visibility
}

/** Stable keys for map page captions (copy lives in the PDF assembler). */
export const CAMPAIGN_KIT_MAP_PAGE_KEYS = /** @type {const} */ ([
  'settlementsRoutes',
  'resources',
])
