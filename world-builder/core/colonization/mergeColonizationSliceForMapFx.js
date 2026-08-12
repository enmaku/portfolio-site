/**
 * Mid-tick merge for map FX / live control overlay refresh.
 * Claims often live on epoch context until ruin writes slice.primaryClaim.
 */

import { applyColonizationSliceToWorldDocument } from './colonizationPhaseTransitions.js'

/**
 * @param {import('../types.js').WorldDocument} baseDocument
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {{
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>> | null,
 * }} [overrides]
 * @returns {import('../types.js').WorldDocument}
 */
export function mergeColonizationSliceForMapFx(baseDocument, slice, overrides = {}) {
  const merged = applyColonizationSliceToWorldDocument(baseDocument, slice)
  const primaryClaim = overrides.primaryClaim ?? slice.primaryClaim
  if (primaryClaim && typeof primaryClaim === 'object') {
    return { ...merged, primaryClaim }
  }
  return merged
}
