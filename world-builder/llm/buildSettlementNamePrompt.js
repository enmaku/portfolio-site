/**
 * Shared instruction + annotation prompt for settlement/faction naming
 * (optional regional writeup in the same response).
 *
 * @param {{
 *   annotations: object,
 *   flavorPrompt?: string,
 *   includeAntiRepetition?: boolean,
 *   includeRegionWriteup?: boolean,
 * }} options
 * @returns {string}
 */
export function buildSettlementNamePrompt(options) {
  const flavor =
    typeof options.flavorPrompt === 'string' ? options.flavorPrompt.trim() : ''
  const includeAntiRepetition = options.includeAntiRepetition !== false
  const includeRegionWriteup = options.includeRegionWriteup === true

  /** @type {string[]} */
  const parts = [
    'You invent fantasy names for settlements and factions on a procedural map.',
    includeRegionWriteup
      ? 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }], overview: string, notableSettlements: [{ settlementId, mapNumber, name, description }] }.'
      : 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }] }.',
    'One settlement entry per settlement in the input. Use the exact settlementId values.',
    'One faction entry per faction in the input. Use the exact factionId values.',
    'Settlement names should feel like fantasy map labels: short, pronounceable, place-like (towns, ports, strongholds).',
    'Faction names should feel like realms, houses, leagues, or peoples — short and map-legend worthy.',
    'Use biome, faction membership, wealth, trade, tolls, and history as inspiration — do not narrate in the name fields; just name.',
  ]

  if (includeAntiRepetition) {
    parts.push(
      'Avoid repetitive morphology across the set: do not reuse the same suffix, prefix, or compound pattern for many names (e.g. not a run of *-skerry / *-haven / *-hold). Vary structure — single words, different compounds, occasional descriptive phrases — while staying on-theme.',
      'Within a shared flavor, suggest kinship through tone and vocabulary, not by cloning one template with swapped first halves.',
    )
  }

  if (includeRegionWriteup) {
    parts.push(
      'Also write a campaign-facing region synopsis in the same response. Both overview and notableSettlements are required — do not omit either, and do not leave notableSettlements empty.',
      'overview: 2–4 sentences on the region as a whole — who holds power, how trade flows, and what tensions matter. Use the names you just assigned.',
      'notableSettlements: pick the most notable / important places (typically 4–8, fewer only if the map is small). Capitals, major ports, wealth hubs, and historically distinctive places first.',
      'Each notable entry: exact settlementId; mapNumber when known; the same name you assigned in settlements; description of 2–4 plain-English sentences — character, why it matters, relationships/histories grounded in the annotated data. Do not invent events absent from the data; you may lightly color tone to match flavor.',
      'Do not list every settlement under notableSettlements, but overview alone is not enough — you must include the notable settlement descriptions.',
    )
  }

  parts.push(
    flavor
      ? `Author flavor / theme (apply strongly to naming style for both settlements and factions${includeRegionWriteup ? ', and to writeup prose voice' : ''}): ${flavor}`
      : `No special author flavor; use grounded fantasy place-name and polity-name style${includeRegionWriteup ? ', and clear campaign voice for the writeup' : ''}.`,
    'Annotated world data:',
    JSON.stringify(options.annotations),
  )

  return parts.join('\n\n')
}

/**
 * @param {string} overview
 * @param {Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>} notableSettlements
 * @returns {string}
 */
function formatRegionWriteupDisplay(overview, notableSettlements) {
  /** @type {string[]} */
  const displayParts = []
  if (overview) displayParts.push(overview)
  for (const row of notableSettlements) {
    const heading =
      row.name ||
      (row.mapNumber != null ? `#${row.mapNumber}` : row.settlementId)
    const mapBit = row.mapNumber != null && row.name ? ` (#${row.mapNumber})` : ''
    displayParts.push(`${heading}${mapBit}\n${row.description}`)
  }
  return displayParts.join('\n\n')
}

/**
 * @param {string} text
 * @returns {{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   overview: string,
 *   notableSettlements: Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>,
 *   regionWriteup: string,
 * }}
 */
export function parseSettlementNameResponse(text) {
  /** @type {{
   *   settlements?: Array<{ settlementId?: string, name?: string }>,
   *   factions?: Array<{ factionId?: string, name?: string }>,
   *   overview?: string,
   *   notableSettlements?: Array<{
   *     settlementId?: string,
   *     mapNumber?: number,
   *     name?: string,
   *     description?: string,
   *   }>,
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

  const overview = typeof parsed.overview === 'string' ? parsed.overview.trim() : ''

  /** @type {Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>} */
  const notableSettlements = []
  for (const row of parsed.notableSettlements ?? []) {
    if (typeof row?.settlementId !== 'string') continue
    const description = typeof row.description === 'string' ? row.description.trim() : ''
    if (!description) continue
    const assignedName = settlements[row.settlementId] ?? ''
    notableSettlements.push({
      settlementId: row.settlementId,
      mapNumber: typeof row.mapNumber === 'number' ? row.mapNumber : null,
      name:
        (typeof row.name === 'string' ? row.name.trim() : '') || assignedName,
      description,
    })
  }

  return {
    settlements,
    factions,
    overview,
    notableSettlements,
    regionWriteup: formatRegionWriteupDisplay(overview, notableSettlements),
  }
}
