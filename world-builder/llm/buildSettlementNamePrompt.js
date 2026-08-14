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
 * }} options
 * @returns {string}
 */
export function buildSettlementNamePrompt(options) {
  const flavor =
    typeof options.flavorPrompt === 'string' ? options.flavorPrompt.trim() : ''
  const includeAntiRepetition = options.includeAntiRepetition !== false
  const includeRegionWriteup = options.includeRegionWriteup === true
  const includeMapImage = options.includeMapImage === true

  /** @type {string[]} */
  const parts = [
    'You invent fantasy names for settlements and factions on a procedural map.',
    includeRegionWriteup
      ? 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }], overview: string, notableSettlements: [{ settlementId, mapNumber, name, description }], writeupSettlementIds: string[] }.'
      : 'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }] }.',
    'One settlement entry per settlement in the input. Use the exact settlementId values.',
    'One faction entry per faction in the input. Use the exact factionId values.',
    'Settlement names should feel like fantasy map labels: short, pronounceable, place-like (towns, ports, strongholds).',
    'Faction names should feel like realms, houses, leagues, or peoples — short and map-legend worthy.',
    'HARD CONSTRAINT: No settlement name may contain any of these substrings (case-insensitive): taiga, tundra, scrub, coast, bog, mire, marsh, swamp, wood, woods, forest, pine, oak, timber, frost, ice, snow, hill, hills, mountain, dune, dust, salt, brine, copper, iron, sea, tide, wave, shore, grain, fish.',
    'Forbidden pattern: <BiomeOrGood><Town|Port|Watch|Hold|End|Gate|Hollow|Reach|Ville> — e.g. Taigaport, Scrubwatch, Coppersville, Frosthold, Oakhaven, Pinehollow, Brinewatch, Tundrasend.',
    'At least 85% of settlement names must be invented personal, dynastic, event, or opaque proper placenames (Georgetown, Virginia, Christmas Island, or short coined words like Valen / Karn). The simulation does not supply founders, saints, battles, or myths — invent those from whole cloth.',
    'Biome, maritimeRole, imports, exports, supplies, and wants are logistics metadata, not naming templates.',
  ]

  if (includeAntiRepetition) {
    parts.push(
      'Avoid repetitive morphology across the set: do not reuse the same suffix, prefix, or compound pattern for many names (e.g. not a run of *-skerry / *-haven / *-hold). Vary structure — single words, different compounds, occasional descriptive phrases — while staying on-theme.',
      'Within a shared flavor, suggest kinship through tone and vocabulary, not by cloning one template with swapped first halves.',
    )
  }

  if (includeRegionWriteup) {
    parts.push(
      'Also write a campaign-facing region synopsis in the same response. overview, notableSettlements, and writeupSettlementIds are all required — do not omit any, and do not leave notableSettlements or writeupSettlementIds empty.',
      'overview: 2–4 sentences on the region as a whole — who holds power, how trade flows, and what tensions matter. Use the names you just assigned.',
      'notableSettlements: pick the most notable / important places (typically 4–8, fewer only if the map is small). Capitals, major ports, wealth hubs, road chokepoints, and historically distinctive places first.',
      'Each notable entry: exact settlementId; mapNumber when known; the same name you assigned in settlements; description of 2–4 plain-English sentences — character, why it matters, relationships/histories grounded in the annotated data and visible geography. Do not invent political events absent from history/rivalry data; you may infer geographic character (passes, coasts, bottlenecks, hinterlands) from the map and coordinates.',
      'Do not list every settlement under notableSettlements, but overview alone is not enough — you must include the notable settlement descriptions.',
      'writeupSettlementIds: exact settlementId strings for every settlement you actually discuss in overview or notableSettlements. Include only those settlement ids — never invent ids, and never add a settlement merely because its name appears inside a faction name.',
      'Geography: north is the top of the map (y = 0); x increases east; y increases south. Use settlement x/y, faction centroids, routeLinks/routes, and the attached map together. Understand each faction’s territory from its member settlements’ positions — not from biome stereotypes (ice/snow ≠ north).',
      'Tell a convincing story of place: road hubs, coastal approaches, mountain gaps, and rival borders should shape names and writeup when the map or routes support them. Cardinal words are fine when they match that reading; skip them when a proper name serves better. Avoid stamped templates (“Eastern Sovereign Alliance”, “Northern Maritime League”) repeated across factions.',
    )
    if (includeMapImage) {
      parts.push(
        'A full-resolution context map is attached (biome terrain, land routes as gray lines, dark settlement pins). North is the top of the image. Read terrain and route geometry; combine with the JSON coordinates and routeLinks — do not invent landmarks that contradict what you see.',
      )
    }
  }

  parts.push(
    flavor
      ? `Author flavor / theme (apply strongly to naming style for both settlements and factions${includeRegionWriteup ? ', and to writeup prose voice' : ''}): ${flavor}`
      : `No special author flavor; use grounded fantasy place-name and polity-name style${includeRegionWriteup ? ', and clear campaign voice for the writeup' : ''}.`,
  )

  if (flavor) {
    parts.push(
      'HARD CONSTRAINT — published-setting flavors: If the flavor names or evokes a known published world (Golarion/Pathfinder, Faerûn/Forgotten Realms, Tolkien/Middle-earth, Westeros, Elder Scrolls, Warhammer, etc.), match that setting’s naming phonetics and cultural feel ONLY. Do not use any canonical place, city, nation, region, landmark, deity-as-placename, or polity name from that IP.',
      'That ban applies to both settlement names and faction names. Invent original labels that sound like they belong on an unpublished map of that world.',
      'Golarion examples that are FORBIDDEN (non-exhaustive): Absalom, Absalom Station, Oppara, Sothis, Katapesh, Quantium, Magnimar, Korvosa, Westcrown, Egorian, Skywatch, Vigil, Nerosyan, Almas, Highhelm, Taldor, Cheliax, Andoran, Qadira, Osirion, Nex, Geb, Numeria, Varisia, Inner Sea, Mwangi, Eye of Abendego.',
      'Tolkien examples that are FORBIDDEN (non-exhaustive): The Shire, Hobbiton, Rivendell, Lothlórien, Orthanc, Isengard, Minas Tirith, Mordor, Gondor, Rohan, Moria, Erebor, Lothlorien.',
      'Faerûn examples that are FORBIDDEN (non-exhaustive): Waterdeep, Baldur’s Gate, Neverwinter, Candlekeep, Calimport, Zhentil Keep, Myth Drannor, Icewind Dale, Sword Coast.',
      'If a draft name is a real published gazetteer entry for that flavor, discard it and invent a different original name before returning.',
    )
  }

  parts.push(
    'Annotated world data (mapAxes, coordinates, routes/routeLinks, history, economy):',
    JSON.stringify(options.annotations),
    'CRITICAL FINAL CHECK (read after the JSON; overrides calquing the fields above):',
    'Scan every settlement name. If it contains a banned stem or matches the forbidden biome-compound pattern, replace it with an invented proper name before returning.',
    'Do not return Oakhaven, Frostwatch, Pinehollow, Brinewatch, Taigaport, Scrubtown, or similar.',
    'Scan faction names for repetitive cardinal+Alliance/League templates; if several look stamped from one mold, rewrite toward distinctive proper names grounded in their places and histories.',
  )

  if (flavor) {
    parts.push(
      'Also scan every settlement and faction name for canonical published-setting gazetteer entries matching the flavor. Replace any hit (Absalom, Taldor, Sothis, Nex, The Shire, Orthanc, Waterdeep, etc.) with an original phonetically fitting name. Phonetic homage is allowed; copying canon is not.',
    )
  }

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
      name:
        (typeof row.name === 'string' ? row.name.trim() : '') || assignedName,
      description,
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
    writeupSettlementIds: [...writeupIdSet],
    regionWriteup: formatRegionWriteupDisplay(overview, notableSettlements),
  }
}
