import { createSettlementNamesModel } from '../firebase/ai.js'
import { buildSettlementNameAnnotations } from '../../../../world-builder/llm/buildSettlementNameAnnotations.js'
import {
  buildSettlementNamePrompt,
  parseSettlementNameResponse,
} from '../../../../world-builder/llm/buildSettlementNamePrompt.js'
import { resolveSettlementNameGenerationMode } from '../../../../world-builder/llm/settlementNameCatalog.js'
import { blobToGenerativeInlinePart } from './mapImageForGemini.js'

/**
 * @param {object} annotations
 * @returns {{ settlementIds: string[], factionIds: string[] }}
 */
export function expectedNameIdsFromAnnotations(annotations) {
  const settlements = Array.isArray(annotations?.settlements) ? annotations.settlements : []
  const factions = Array.isArray(annotations?.factions) ? annotations.factions : []
  return {
    settlementIds: settlements
      .map((row) => row?.id)
      .filter((id) => typeof id === 'string' && id),
    factionIds: factions
      .map((row) => row?.id)
      .filter((id) => typeof id === 'string' && id),
  }
}

/**
 * @param {{
 *   slice: import('../../../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../../../world-builder/core/types.js').WorldDocument,
 *   flavorPrompt?: string,
 *   mapImages?: Blob[] | null,
 *   mapImage?: Blob | null,
 *   catalog?: import('../../../../world-builder/llm/settlementNameCatalog.js').SettlementNameCatalogInput | null,
 * }} options
 * @returns {Promise<{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   regionName: string,
 *   overview: string,
 *   notableSettlements: Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>,
 *   factionProfiles: Array<{ factionId: string, summary: string }>,
 *   writeupSettlementIds: string[],
 *   regionWriteup: string,
 *   generationMode: import('../../../../world-builder/llm/settlementNameCatalog.js').SettlementNameGenerationMode,
 * }>}
 */
export async function generateSettlementNamesWithGemini(options) {
  const annotations = buildSettlementNameAnnotations(options.slice, options.worldDocument)
  const { settlementIds, factionIds } = expectedNameIdsFromAnnotations(annotations)
  const plan = resolveSettlementNameGenerationMode({
    expectedSettlementIds: settlementIds,
    expectedFactionIds: factionIds,
    catalog: options.catalog,
  })

  if (!settlementIds.length) {
    return {
      settlements: plan.provided.settlements,
      factions: plan.provided.factions,
      regionName: plan.provided.regionName,
      overview: '',
      notableSettlements: [],
      factionProfiles: [],
      writeupSettlementIds: [],
      regionWriteup: '',
      generationMode: plan.mode,
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
    generationMode: plan.mode,
    providedNames: plan.provided,
    missingSettlementIds: plan.missingSettlementIds,
    missingFactionIds: plan.missingFactionIds,
    missingRegionName: plan.missingRegionName,
  })
  const model = await createSettlementNamesModel({
    includeRegionWriteup: true,
    generationMode: plan.mode,
  })

  /** @type {Array<string | { inlineData: { data: string, mimeType: string } }>} */
  const parts = [prompt]
  for (const blob of mapImages) {
    parts.push(await blobToGenerativeInlinePart(blob))
  }

  const result = await model.generateContent(parts)
  const parsed = parseSettlementNameResponse(result.response.text(), {
    providedNames: plan.provided,
    expectedSettlementIds: settlementIds,
    expectedFactionIds: factionIds,
  })
  return { ...parsed, generationMode: plan.mode }
}
