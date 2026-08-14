import { mergeProtectedSettlementNames } from './settlementNameCatalog.js'

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
 *   generationMode?: import('./settlementNameCatalog.js').SettlementNameGenerationMode,
 *   providedNames?: import('./settlementNameCatalog.js').SettlementNameCatalogInput,
 *   missingSettlementIds?: string[],
 *   missingFactionIds?: string[],
 *   missingRegionName?: boolean,
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
  const generationMode =
    options.generationMode === 'partial' || options.generationMode === 'complete'
      ? options.generationMode
      : 'empty'
  const providedNames = options.providedNames ?? {}
  const missingSettlementIds = Array.isArray(options.missingSettlementIds)
    ? options.missingSettlementIds
    : []
  const missingFactionIds = Array.isArray(options.missingFactionIds)
    ? options.missingFactionIds
    : []
  const missingRegionName = options.missingRegionName === true

  /** @type {string[]} */
  const parts = []

  if (generationMode === 'complete') {
    parts.push(
      'Write a campaign-facing regional synopsis for a procedural map whose settlement, faction, and realm names are already set.',
      'Return JSON matching the schema: { factionProfiles: [{ factionId, summary }], overview: string, notableSettlements: [{ settlementId, mapNumber, name, description }], writeupSettlementIds: string[] }.',
      'Do not return settlements, factions, or regionName fields. Do not invent, respell, or replace any provided name.',
    )
  } else {
    parts.push(
      'You invent fantasy names for settlements and factions on a procedural map, then (when asked) write a campaign-facing regional synopsis.',
      includeRegionWriteup
        ? generationMode === 'partial'
          ? 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }], factionProfiles: [{ factionId, summary }], regionName: string, overview: string, notableSettlements: [{ settlementId, mapNumber, name, description }], writeupSettlementIds: string[] }. Include settlements/factions/regionName only for names that are still missing.'
          : 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }], factionProfiles: [{ factionId, summary }], regionName: string, overview: string, notableSettlements: [{ settlementId, mapNumber, name, description }], writeupSettlementIds: string[] }.'
        : 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }] }.',
    )
    if (generationMode === 'partial') {
      parts.push(
        `Invent names only for the missing ids listed below. Return exactly ${missingSettlementIds.length} settlements entries and ${missingFactionIds.length} factions entries, using those exact settlementId / factionId strings.`,
        missingFactionIds.length > 0
          ? `Both arrays are required. The factions array is not optional: every one of these ${missingFactionIds.length} faction ids needs a new name — ${JSON.stringify(missingFactionIds)}.`
          : 'Both arrays are required. Every faction is already named, so return an empty factions array.',
        missingRegionName
          ? 'regionName is missing — invent one for the whole mapped region/realm.'
          : 'regionName is already set — omit the regionName field.',
      )
    } else {
      parts.push(
        'One settlement entry per settlement in the input — including ruins (status=ruin). Use the exact settlementId values from settlements[].id.',
        'One faction entry per faction in the input. Use the exact factionId values from factions[].id.',
      )
    }
    parts.push(...settlementNameStyleRules())
  }

  if (generationMode !== 'complete' && includeAntiRepetition) {
    parts.push(
      'Avoid repetitive morphology across the set: do not reuse the same suffix, prefix, or compound pattern for many names. Vary structure while staying on-theme.',
      'Within a shared flavor, suggest kinship through tone and vocabulary, not by cloning one template with swapped first halves.',
    )
  }

  if (generationMode === 'partial' || generationMode === 'complete') {
    parts.push(...providedNamesPromptParts(providedNames, generationMode))
  }

  if (generationMode === 'partial') {
    parts.push(
      'Missing names to invent (compact JSON):',
      JSON.stringify({
        settlements: missingSettlementIds,
        factions: missingFactionIds,
        regionName: missingRegionName || undefined,
      }),
    )
  }

  if (includeRegionWriteup) {
    parts.push(
      ...(generationMode === 'complete'
        ? [
            'overview, notableSettlements, factionProfiles, and writeupSettlementIds are required — do not omit any, and do not leave notableSettlements / factionProfiles / writeupSettlementIds empty.',
          ]
        : [
            'Also write a campaign-facing region synopsis in the same response. regionName, overview, notableSettlements, factionProfiles, and writeupSettlementIds are required when those names are still missing — do not omit writeup fields, and do not leave notableSettlements / factionProfiles / writeupSettlementIds empty.',
          ]),
      'Canon baseline: map geometry, settlement coordinates/map numbers, faction membership, routes, tradeFlows, rivalries, and chronicle events are true. Treat them as the historical skeleton.',
      'Narrative permission: you may invent rulers, treaties, skirmishes, institutions, customs, motives, and local legends that connect those facts, as long as you do not contradict recorded chronicle events, current membership/rivalries, routes, trade flows, or visible geography/political control.',
      ...(generationMode === 'complete'
        ? []
        : [
            'regionName: one name for the whole mapped region/realm, in the same flavor as the settlement and faction names. Short enough for a map title (1–4 words); an article like "The" is fine. Prefer an evocative invented proper name (dynastic, mythic, or opaque) over a geological or biome descriptor.',
            'Only lean on physical description for regionName when the map has a genuinely striking singular feature — one dominant glacial peak, a vast inland sea, a landmass shattered into an archipelago — and even then weave it into a proper name rather than labeling the biome. Never name the region after a settlement or faction you just named.',
          ]),
      'overview: 2–4 sentences on the region — who holds power, how trade flows, what tensions matter. Use the provided and newly assigned names, and refer to the region by its regionName.',
      'factionProfiles: one short summary per living faction (1–3 sentences): territorial character, economic base, political posture, and a concrete vulnerability or rivalry. Use assigned faction names.',
      'notableSettlements: typically 4–8 places (fewer only if the map is small). Prefer capitals, major ports, road hubs, border marches, historically distinctive sites, and occasionally a ruin that still shapes the region’s story.',
      'Each notable entry: exact settlementId; mapNumber when known; the same name already assigned or just invented for that id; 2–4 sentences. For living sites, include one strategic advantage, one dependency/vulnerability, and one concrete relationship to another named place. For ruins, explain what they once were and how their abandonment still matters (trade diversion, superstition, border scar). Use superlatives only when rank fields support them (popRank / wealthRank / tollRank; rank 1 = highest among living settlements).',
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
      ? `Author flavor / theme (apply strongly${generationMode === 'complete' ? ' to writeup prose voice' : ` to naming style for settlements and factions${includeRegionWriteup ? ', and to writeup prose voice' : ''}`}): ${flavor}`
      : `No special author flavor; use grounded fantasy ${generationMode === 'complete' ? 'campaign voice for the writeup' : `place-name and polity-name style${includeRegionWriteup ? ', and clear campaign voice for the writeup' : ''}`}.`,
  )

  if (flavorLooksLikePublishedSetting(flavor)) {
    parts.push(
      'HARD CONSTRAINT — published-setting flavors: Match that setting’s naming phonetics and cultural feel ONLY. Do not use any canonical place, city, nation, region, landmark, deity-as-placename, or polity name from that IP (settlements or factions).',
      generationMode === 'complete'
        ? 'Keep the provided names even if they resemble canon; do not replace them. Invented prose must still avoid copying unpublished-setting events as if they were this map’s history.'
        : 'Invent original labels that sound like they belong on an unpublished map of that world. Phonetic homage is allowed; copying canon is not.',
    )
  }

  parts.push(
    'Annotated world data (compact JSON). settlements[].id is settlementId; settlements[].n is mapNumber; ranks are 1 = highest among living settlements:',
    JSON.stringify(options.annotations),
  )

  if (generationMode === 'complete') {
    parts.push(
      'CRITICAL FINAL CHECK:',
      'Use every provided name exactly as given. Do not output renamed settlements, factions, or a new regionName.',
    )
  } else {
    parts.push(
      'CRITICAL FINAL CHECK:',
      'Replace any newly invented settlement name that uses a banned stem or biome-compound pattern with an invented proper name.',
      'Replace any newly invented name that is Valen, Karn, Georgetown, Virginia, Christmas Island, or a transparent variant of those instruction examples.',
      'Every newly named status=ruin settlement must have a name that clearly reads as abandoned, ruined, ghost-town, haunted, or war-scarred — not a living town label.',
      'If several newly invented faction names look stamped from one cardinal+Alliance/League mold, rewrite toward distinctive proper names grounded in place and chronicle.',
    )
    if (generationMode === 'partial') {
      parts.push(
        'Never change a provided name. If a generated name collides with a provided name, invent a different one.',
        'Before returning, confirm settlements[] and factions[] cover every id in the missing list — no omissions and no extras.',
      )
    }
  }

  if (flavorLooksLikePublishedSetting(flavor) && generationMode !== 'complete') {
    parts.push(
      'Scan settlement and faction names for canonical published gazetteer hits matching the flavor; replace any hit with an original phonetically fitting name.',
    )
  }

  return parts.join('\n\n')
}

/**
 * @returns {string[]}
 */
function settlementNameStyleRules() {
  return [
    'Living settlement names should feel like fantasy map labels: short, pronounceable, place-like (towns, ports, strongholds).',
    'Ruin names must still be place-like map labels, but should read as abandoned, ruined, ghost-town, haunted, cursed, war-ravaged, or otherwise post-settlement — shaped by flavor when present (e.g. mystical desolation, plague-scarred, battlefield wreck). Prefer names that sound abandoned without relying on banned biome/goods stems.',
    'Faction names should feel like realms, houses, leagues, or peoples — short and map-legend worthy.',
    'HARD CONSTRAINT: No settlement name may contain any of these substrings (case-insensitive): taiga, tundra, scrub, coast, bog, mire, marsh, swamp, wood, woods, forest, pine, oak, timber, frost, ice, snow, hill, hills, mountain, dune, dust, salt, brine, copper, iron, sea, tide, wave, shore, grain, fish.',
    'Forbidden pattern: <BiomeOrGood><Town|Port|Watch|Hold|End|Gate|Hollow|Reach|Ville> — e.g. Taigaport, Scrubwatch, Coppersville, Frosthold, Oakhaven, Pinehollow, Brinewatch, Tundrasend.',
    'At least 85% of living settlement names must be invented personal, dynastic, event, or opaque proper placenames (Georgetown, Virginia, Christmas Island, or short coined words like Valen / Karn). Prefer proper names over biome calques. Ruin names may lean more openly abandoned/haunted while staying map-label short.',
    'HARD CONSTRAINT: Do not use the illustrative example names above as outputs — never name anything Valen, Karn, Georgetown, Virginia, or Christmas Island (or transparent variants like Valensport / House Karn). Invent different original labels.',
    'Logistics fields (maritime, ranks, tradeFlows) are evidence for story and role — not naming templates. Generated names are outputs, never evidence about geography.',
  ]
}

/**
 * @param {import('./settlementNameCatalog.js').SettlementNameCatalogInput} providedNames
 * @param {import('./settlementNameCatalog.js').SettlementNameGenerationMode} generationMode
 * @returns {string[]}
 */
function providedNamesPromptParts(providedNames, generationMode) {
  const settlements =
    providedNames.settlements && typeof providedNames.settlements === 'object'
      ? providedNames.settlements
      : {}
  const factions =
    providedNames.factions && typeof providedNames.factions === 'object'
      ? providedNames.factions
      : {}
  const regionName =
    typeof providedNames.regionName === 'string' ? providedNames.regionName.trim() : ''
  return [
    generationMode === 'complete'
      ? 'These names are immutable canon. Use them verbatim in the writeup. Do not rename, respell, or replace any of them.'
      : 'These names are already set and are immutable canon. Use them as naming exemplars and in any writeup. Do not rename, respell, or replace them, and do not return them as new outputs.',
    JSON.stringify({
      ...(regionName ? { regionName } : {}),
      settlements,
      factions,
    }),
  ]
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
 * @param {string} regionName
 * @param {string} overview
 * @param {Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>} notableSettlements
 * @param {Array<{ factionId: string, summary: string }>} factionProfiles
 * @returns {string}
 */
function formatRegionWriteupDisplay(regionName, overview, notableSettlements, factionProfiles) {
  /** @type {string[]} */
  const displayParts = []
  if (regionName) displayParts.push(regionName)
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
 * @param {{
 *   providedNames?: import('./settlementNameCatalog.js').SettlementNameCatalogInput | null,
 *   expectedSettlementIds?: string[] | null,
 *   expectedFactionIds?: string[] | null,
 * }} [options]
 * @returns {{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   regionName: string,
 *   overview: string,
 *   notableSettlements: Array<{ settlementId: string, mapNumber: number | null, name: string, description: string }>,
 *   factionProfiles: Array<{ factionId: string, summary: string }>,
 *   writeupSettlementIds: string[],
 *   regionWriteup: string,
 * }}
 */
export function parseSettlementNameResponse(text, options = {}) {
  /** @type {{
   *   settlements?: Array<{ settlementId?: string, name?: string }>,
   *   factions?: Array<{ factionId?: string, name?: string }>,
   *   regionName?: string,
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
  const generatedSettlements = {}
  for (const row of parsed.settlements ?? []) {
    if (typeof row?.settlementId !== 'string' || typeof row?.name !== 'string') continue
    const name = row.name.trim()
    if (!name) continue
    generatedSettlements[row.settlementId] = name
  }

  /** @type {Record<string, string>} */
  const generatedFactions = {}
  for (const row of parsed.factions ?? []) {
    if (typeof row?.factionId !== 'string' || typeof row?.name !== 'string') continue
    const name = row.name.trim()
    if (!name) continue
    generatedFactions[row.factionId] = name
  }

  const generatedRegionName =
    typeof parsed.regionName === 'string' ? parsed.regionName.trim() : ''
  const merged = mergeProtectedSettlementNames({
    provided: options.providedNames,
    generated: {
      settlements: generatedSettlements,
      factions: generatedFactions,
      regionName: generatedRegionName,
    },
    expectedSettlementIds: options.expectedSettlementIds,
    expectedFactionIds: options.expectedFactionIds,
  })
  const settlements = merged.settlements
  const factions = merged.factions
  const regionName = merged.regionName
  const overview = typeof parsed.overview === 'string' ? parsed.overview.trim() : ''
  const expectedSettlementIdSet = Array.isArray(options.expectedSettlementIds)
    ? new Set(options.expectedSettlementIds)
    : null

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
      name: assignedName || (typeof row.name === 'string' ? row.name.trim() : ''),
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
    if (typeof id !== 'string' || !id) continue
    const known =
      expectedSettlementIdSet != null ? expectedSettlementIdSet.has(id) : Boolean(settlements[id])
    if (known) writeupIdSet.add(id)
  }
  if (writeupIdSet.size === 0) {
    for (const row of notableSettlements) writeupIdSet.add(row.settlementId)
  }

  return {
    settlements,
    factions,
    regionName,
    overview,
    notableSettlements,
    factionProfiles,
    writeupSettlementIds: [...writeupIdSet],
    regionWriteup: formatRegionWriteupDisplay(
      regionName,
      overview,
      notableSettlements,
      factionProfiles,
    ),
  }
}
