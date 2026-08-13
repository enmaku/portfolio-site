import { createSettlementNamesModel } from '../firebase/ai.js'
import { buildSettlementNameAnnotations } from '../../../../world-builder/llm/buildSettlementNameAnnotations.js'

/**
 * @param {{
 *   slice: import('../../../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../../../world-builder/core/types.js').WorldDocument,
 *   flavorPrompt?: string,
 * }} options
 * @returns {Promise<{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 * }>}
 */
export async function generateSettlementNamesWithGemini(options) {
  const flavor = typeof options.flavorPrompt === 'string' ? options.flavorPrompt.trim() : ''
  const annotations = buildSettlementNameAnnotations(options.slice, options.worldDocument)

  if (!annotations.settlements.length) {
    return { settlements: {}, factions: {} }
  }

  const model = await createSettlementNamesModel()
  const prompt = [
    'You invent fantasy names for settlements and factions on a procedural map.',
    'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }] }.',
    'One settlement entry per settlement in the input. Use the exact settlementId values.',
    'One faction entry per faction in the input. Use the exact factionId values.',
    'Settlement names should feel like fantasy map labels: short, pronounceable, place-like (towns, ports, strongholds).',
    'Faction names should feel like realms, houses, leagues, or peoples — short and map-legend worthy.',
    'Use biome, faction membership, wealth, trade, tolls, and history as inspiration — do not narrate; just name.',
    'Avoid repetitive morphology across the set: do not reuse the same suffix, prefix, or compound pattern for many names (e.g. not a run of *-skerry / *-haven / *-hold). Vary structure — single words, different compounds, occasional descriptive phrases — while staying on-theme.',
    'Within a shared flavor, suggest kinship through tone and vocabulary, not by cloning one template with swapped first halves.',
    flavor
      ? `Author flavor / theme (apply strongly to naming style for both settlements and factions): ${flavor}`
      : 'No special author flavor; use grounded fantasy place-name and polity-name style.',
    'Annotated world data:',
    JSON.stringify(annotations),
  ].join('\n\n')

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  /** @type {{
   *   settlements?: Array<{ settlementId?: string, name?: string }>,
   *   factions?: Array<{ factionId?: string, name?: string }>,
   * }} */
  const parsed = JSON.parse(text)

  /** @type {Record<string, string>} */
  const settlements = {}
  for (const row of parsed.settlements ?? []) {
    if (typeof row?.settlementId !== 'string' || typeof row?.name !== 'string') continue
    const name = row.name.trim()
    if (!name) continue
    settlements[row.settlementId] = name
  }

  /** @type {Record<string, string>} */
  const factions = {}
  for (const row of parsed.factions ?? []) {
    if (typeof row?.factionId !== 'string' || typeof row?.name !== 'string') continue
    const name = row.name.trim()
    if (!name) continue
    factions[row.factionId] = name
  }

  return { settlements, factions }
}
