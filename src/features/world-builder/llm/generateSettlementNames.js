import { createSettlementNamesModel } from '../firebase/ai.js'
import { buildSettlementNameAnnotations } from '../../../../world-builder/llm/buildSettlementNameAnnotations.js'
import {
  buildSettlementNamePrompt,
  parseSettlementNameResponse,
} from '../../../../world-builder/llm/buildSettlementNamePrompt.js'

/**
 * @param {{
 *   slice: import('../../../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../../../world-builder/core/types.js').WorldDocument,
 *   flavorPrompt?: string,
 * }} options
 * @returns {Promise<{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   overview: string,
 *   notableSettlements: Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>,
 *   regionWriteup: string,
 * }>}
 */
export async function generateSettlementNamesWithGemini(options) {
  const annotations = buildSettlementNameAnnotations(options.slice, options.worldDocument)

  if (!annotations.settlements.length) {
    return {
      settlements: {},
      factions: {},
      overview: '',
      notableSettlements: [],
      regionWriteup: '',
    }
  }

  const prompt = buildSettlementNamePrompt({
    annotations,
    flavorPrompt: options.flavorPrompt,
    includeRegionWriteup: true,
  })
  const model = await createSettlementNamesModel({ includeRegionWriteup: true })
  const result = await model.generateContent(prompt)
  return parseSettlementNameResponse(result.response.text())
}
