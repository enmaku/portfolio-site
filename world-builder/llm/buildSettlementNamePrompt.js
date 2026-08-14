/**
 * Shared instruction + annotation prompt for settlement/faction naming
 * (optional regional writeup in the same response).
 *
 * @param {{
 *   annotations: object,
 *   flavorPrompt?: string,
 *   includeAntiRepetition?: boolean,
 *   includeRegionWriteup?: boolean,
 *   includeMapImage?: boolean,
 *   includePoliticalMap?: boolean,
 * }} options
 * @returns {string}
 */
export function buildSettlementNamePrompt(options) {
  const flavor =
    typeof options.flavorPrompt === 'string' ? options.flavorPrompt.trim() : ''
  const includeAntiRepetition = options.includeAntiRepetition !== false
  const includeRegionWriteup = options.includeRegionWriteup === true
  const includeMapImage = options.includeMapImage === true
  const includePoliticalMap = options.includePoliticalMap === true

  /** @type {string[]} */
  const parts = [
    'You invent fantasy names for settlements and factions on a procedural map, then (when asked) write a campaign-facing regional synopsis.',
    includeRegionWriteup
      ? 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }], factionProfiles: [{ factionId, summary }], overview: string, notableSettlements: [{ settlementId, mapNumber, name, description }], writeupSettlementIds: string[] }.'
      : 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }] }.',
    'One settlement entry per settlement in the input — including ruins (status=ruin). Use the exact settlementId values from settlements[].id.',
    'One faction entry per faction in the input. Use the exact factionId values from factions[].id.',
    'Living settlement names should feel like fantasy map labels: short, pronounceable, place-like (towns, ports, strongholds).',
    'Ruin names must still be place-like map labels, but should read as abandoned, ruined, ghost-town, haunted, cursed, war-ravaged, or otherwise post-settlement — shaped by flavor when present (e.g. mystical desolation, plague-scarred, battlefield wreck). Prefer names that sound abandoned without relying on banned biome/goods stems.',
    'Faction names should feel like realms, houses, leagues, or peoples — short and map-legend worthy.',
    'HARD CONSTRAINT: No settlement name may contain any of these substrings (case-insensitive): taiga, tundra, scrub, coast, bog, mire, marsh, swamp, wood, woods, forest, pine, oak, timber, frost, ice, snow, hill, hills, mountain, dune, dust, salt, brine, copper, iron, sea, tide, wave, shore, grain, fish.',
    'Forbidden pattern: <BiomeOrGood><Town|Port|Watch|Hold|End|Gate|Hollow|Reach|Ville> — e.g. Taigaport, Scrubwatch, Coppersville, Frosthold, Oakhaven, Pinehollow, Brinewatch, Tundrasend.',
    'At least 85% of living settlement names must be invented personal, dynastic, event, or opaque proper placenames (Georgetown, Virginia, Christmas Island, or short coined words like Valen / Karn). Prefer proper names over biome calques. Ruin names may lean more openly abandoned/haunted while staying map-label short.',
    'Logistics fields (maritime, ranks, tradeFlows) are evidence for story and role — not naming templates. Generated names are outputs, never evidence about geography.',
  ]

  if (includeAntiRepetition) {
    parts.push(
      'Avoid repetitive morphology across the set: do not reuse the same suffix, prefix, or compound pattern for many names. Vary structure while staying on-theme.',
      'Within a shared flavor, suggest kinship through tone and vocabulary, not by cloning one template with swapped first halves.',
    )
  }

  if (includeRegionWriteup) {
    parts.push(
      'Also write a campaign-facing region synopsis in the same response. overview, notableSettlements, factionProfiles, and writeupSettlementIds are required — do not omit any, and do not leave notableSettlements / factionProfiles / writeupSettlementIds empty.',
      'Canon baseline: map geometry, settlement coordinates/map numbers, faction membership, routes, tradeFlows, rivalries, and chronicle events are true. Treat them as the historical skeleton.',
      'Narrative permission: you may invent rulers, treaties, skirmishes, institutions, customs, motives, and local legends that connect those facts, as long as you do not contradict recorded chronicle events, current membership/rivalries, routes, trade flows, or visible geography/political control.',
      'overview: 2–4 sentences on the region — who holds power, how trade flows, what tensions matter. Use the names you assigned.',
      'factionProfiles: one short summary per living faction (1–3 sentences): territorial character, economic base, political posture, and a concrete vulnerability or rivalry. Use assigned faction names.',
      'notableSettlements: typically 4–8 places (fewer only if the map is small). Prefer capitals, major ports, road hubs, border marches, historically distinctive sites, and occasionally a ruin that still shapes the region’s story.',
      'Each notable entry: exact settlementId; mapNumber when known; the same name you assigned; 2–4 sentences. For living sites, include one strategic advantage, one dependency/vulnerability, and one concrete relationship to another named place. For ruins, explain what they once were and how their abandonment still matters (trade diversion, superstition, border scar). Use superlatives only when rank fields support them (popRank / wealthRank / tollRank; rank 1 = highest among living settlements).',
      'writeupSettlementIds: exact settlementId strings for every settlement discussed in overview or notableSettlements. Never invent ids.',
      'Geography: north is the top of the map images (y = 0); x increases east; y increases south. Ice/snow biomes are not latitude. Read territory from the political map when present. Avoid stamped cardinal templates across many factions (“Eastern Sovereign Alliance”, “Northern Maritime League”).',
    )
    if (includeMapImage) {
      parts.push(
        'Map 1 (physical): biome terrain, elevation contours, gray land routes, dark pins for living sites and lighter gray pins for ruins, with yellow map numbers. Use it for coasts, passes, corridors, and relative placement.',
      )
    }
    if (includePoliticalMap) {
      parts.push(
        'Map 2 (political): faction-control territory colors over dim terrain, routes, and the same map numbers. Color swatches are political control hinterlands — read borders, enclaves, and who sits on which corridor from this image.',
      )
    }
  }

  parts.push(
    flavor
      ? `Author flavor / theme (apply strongly to naming style for settlements and factions${includeRegionWriteup ? ', and to writeup prose voice' : ''}): ${flavor}`
      : `No special author flavor; use grounded fantasy place-name and polity-name style${includeRegionWriteup ? ', and clear campaign voice for the writeup' : ''}.`,
  )

  if (flavorLooksLikePublishedSetting(flavor)) {
    parts.push(
      'HARD CONSTRAINT — published-setting flavors: Match that setting’s naming phonetics and cultural feel ONLY. Do not use any canonical place, city, nation, region, landmark, deity-as-placename, or polity name from that IP (settlements or factions).',
      'Invent original labels that sound like they belong on an unpublished map of that world. Phonetic homage is allowed; copying canon is not.',
    )
  }

  parts.push(
    'Annotated world data (compact JSON). settlements[].id is settlementId; settlements[].n is mapNumber; ranks are 1 = highest among living settlements:',
    JSON.stringify(options.annotations),
    'CRITICAL FINAL CHECK:',
    'Replace any settlement name that uses a banned stem or biome-compound pattern with an invented proper name.',
    'Every status=ruin settlement must have a name that clearly reads as abandoned, ruined, ghost-town, haunted, or war-scarred — not a living town label.',
    'If several faction names look stamped from one cardinal+Alliance/League mold, rewrite toward distinctive proper names grounded in place and chronicle.',
  )

  if (flavorLooksLikePublishedSetting(flavor)) {
    parts.push(
      'Scan settlement and faction names for canonical published gazetteer hits matching the flavor; replace any hit with an original phonetically fitting name.',
    )
  }

  return parts.join('\n\n')
}

/**
 * @param {string} flavor
 * @returns {boolean}
 */
function flavorLooksLikePublishedSetting(flavor) {
  if (!flavor) return false
  const text = flavor.toLowerCase()
  return (
    /golarion|pathfinder|faer[uû]n|forgotten realms|tolkien|middle[- ]earth|westeros|game of thrones|elder scrolls|skyrim|morrowind|warhammer|dragonlance|dark sun|eberron|greyhawk|krynn/.test(
      text,
    )
  )
}

/**
 * @param {string} overview
 * @param {Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>} notableSettlements
 * @param {Array<{ factionId: string, summary: string }>} factionProfiles
 * @returns {string}
 */
function formatRegionWriteupDisplay(overview, notableSettlements, factionProfiles) {
  /** @type {string[]} */
  const displayParts = []
  if (overview) displayParts.push(overview)
  if (factionProfiles.length > 0) {
    displayParts.push(
      factionProfiles
        .map((row) => row.summary)
        .filter(Boolean)
        .join('\n\n'),
    )
  }
  for (const row of notableSettlements) {
    const heading =
      row.name ||
      (row.mapNumber != null ? `#${row.mapNumber}` : row.settlementId)
    const mapBit = row.mapNumber != null && row.name ? ` (#${row.mapNumber})` : ''
    displayParts.push(`${heading}${mapBit}\n${row.description}`)
  }
  return displayParts.filter(Boolean).join('\n\n')
}

/**
 * @param {string} text
 * @returns {{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   overview: string,
 *   notableSettlements: Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>,
 *   factionProfiles: Array<{ factionId: string, summary: string }>,
 *   writeupSettlementIds: string[],
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
   *   factionProfiles?: Array<{ factionId?: string, summary?: string }>,
   *   writeupSettlementIds?: unknown[],
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
      name: (typeof row.name === 'string' ? row.name.trim() : '') || assignedName,
      description,
    })
  }

  /** @type {Array<{ factionId: string, summary: string }>} */
  const factionProfiles = []
  for (const row of parsed.factionProfiles ?? []) {
    if (typeof row?.factionId !== 'string') continue
    const summary = typeof row.summary === 'string' ? row.summary.trim() : ''
    if (!summary) continue
    const factionName = factions[row.factionId]
    factionProfiles.push({
      factionId: row.factionId,
      summary: factionName ? `${factionName}\n${summary}` : summary,
    })
  }

  /** @type {Set<string>} */
  const writeupIdSet = new Set()
  for (const id of parsed.writeupSettlementIds ?? []) {
    if (typeof id === 'string' && id && settlements[id]) {
      writeupIdSet.add(id)
    }
  }
  if (writeupIdSet.size === 0) {
    for (const row of notableSettlements) writeupIdSet.add(row.settlementId)
  }

  return {
    settlements,
    factions,
    overview,
    notableSettlements,
    factionProfiles,
    writeupSettlementIds: [...writeupIdSet],
    regionWriteup: formatRegionWriteupDisplay(overview, notableSettlements, factionProfiles),
  }
}
