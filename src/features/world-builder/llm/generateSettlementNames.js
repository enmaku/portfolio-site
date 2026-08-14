import { createSettlementNamesModel } from '../firebase/ai.js'
import { buildSettlementNameAnnotations } from '../../../../world-builder/llm/buildSettlementNameAnnotations.js'
import {
  buildSettlementNamePrompt,
  parseSettlementNameResponse,
} from '../../../../world-builder/llm/buildSettlementNamePrompt.js'
import { blobToGenerativeInlinePart } from './mapImageForGemini.js'

/**
 * @param {{
 *   slice: import('../../../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../../../world-builder/core/types.js').WorldDocument,
 *   flavorPrompt?: string,
 *   mapImage?: Blob | null,
 * }} options
 * @returns {Promise<{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   overview: string,
 *   notableSettlements: Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>,
 *   writeupSettlementIds: string[],
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
      writeupSettlementIds: [],
      regionWriteup: '',
    }
  }

  const hasMapImage = options.mapImage instanceof Blob && options.mapImage.size > 0
  const prompt = buildSettlementNamePrompt({
    annotations,
    flavorPrompt: options.flavorPrompt,
    includeRegionWriteup: true,
    includeMapImage: hasMapImage,
  })
  const model = await createSettlementNamesModel({ includeRegionWriteup: true })

  /** @type {Array<string | { inlineData: { data: string, mimeType: string } }>} */
  const parts = [prompt]
  if (hasMapImage) {
    parts.push(await blobToGenerativeInlinePart(options.mapImage))
  }

  const result = await model.generateContent(parts)
  return parseSettlementNameResponse(result.response.text())
}
