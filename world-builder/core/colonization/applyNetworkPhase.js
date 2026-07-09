import { applyExpeditionNetworkPhase, applyExpeditionNetworkPhaseAsync } from './expeditions/expeditionScheduler.js'

/**
 * @typedef {Object} ApplyNetworkPhaseOptions
 * @property {import('./expeditions/expeditionScheduler.js').ExpeditionNetworkPhaseHooks} [hooks]
 */

/**
 * Colonization network phase: expeditions, founding, roads, visit raster.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {ApplyNetworkPhaseOptions} [options]
 * @returns {{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../types.js').WorldDocument,
 *   events: object[],
 * }}
 */
export function applyNetworkPhase(slice, worldDocument, options = {}) {
  const result = applyExpeditionNetworkPhase(slice, worldDocument, options)
  return {
    slice: result.slice,
    worldDocument: result.worldDocument,
    events: result.foundingEvents,
  }
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {ApplyNetworkPhaseOptions & { yieldToUi?: () => Promise<void> }} [options]
 * @returns {Promise<{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../types.js').WorldDocument,
 *   events: object[],
 * }>}
 */
export async function applyNetworkPhaseAsync(slice, worldDocument, options = {}) {
  const result = await applyExpeditionNetworkPhaseAsync(slice, worldDocument, options)
  return {
    slice: result.slice,
    worldDocument: result.worldDocument,
    events: result.foundingEvents,
  }
}
