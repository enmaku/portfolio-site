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
 *   mapImages?: Blob[] | null,
 *   mapImage?: Blob | null,
 * }} options
 * @returns {Promise<{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   overview: string,
 *   notableSettlements: Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>,
 *   factionProfiles: Array<{ factionId: string, summary: string }>,
 *   writeupSettlementIds: string[],
 *   regionWriteup: string,
 * }>}
 */
export async function generateSettlementNamesWithGemini(options) {
  const annotations = buildSettlementNameAnnotations(options.slice, options.worldDocument)
  const settlementRows = Array.isArray(annotations.settlements) ? annotations.settlements : []

  if (!settlementRows.length) {
    return {
      settlements: {},
      factions: {},
      overview: '',
      notableSettlements: [],
      factionProfiles: [],
      writeupSettlementIds: [],
      regionWriteup: '',
    }
  }

  /** @type {Blob[]} */
  const mapImages = []
  if (Array.isArray(options.mapImages)) {
    for (const blob of options.mapImages) {
      if (blob instanceof Blob && blob.size > 0) mapImages.push(blob)
    }
  } else if (options.mapImage instanceof Blob && options.mapImage.size > 0) {
    mapImages.push(options.mapImage)
  }

  const prompt = buildSettlementNamePrompt({
    annotations,
    flavorPrompt: options.flavorPrompt,
    includeRegionWriteup: true,
    includeMapImage: mapImages.length > 0,
    includePoliticalMap: mapImages.length > 1,
  })
  const model = await createSettlementNamesModel({ includeRegionWriteup: true })

  /** @type {Array<string | { inlineData: { data: string, mimeType: string } }>} */
  const parts = [prompt]
  for (const blob of mapImages) {
    parts.push(await blobToGenerativeInlinePart(blob))
  }

  const result = await model.generateContent(parts)
  return parseSettlementNameResponse(result.response.text())
}
