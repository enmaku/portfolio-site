/**
 * Prompt variants aimed at reducing biome/geography calque settlement names.
 */

/**
 * @typedef {object} BiomeLiteralPromptVariant
 * @property {string} id
 * @property {string} label
 * @property {string[]} [instructionBlocks] Extra instruction paragraphs.
 * @property {boolean} [instructionsAfterJson] If true, blocks go after annotated JSON.
 * @property {boolean} [omitSoftAntiLiteral] Drop soft anti-literal lines from the UI prompt.
 * @property {(annotations: object) => object} [transformAnnotations]
 */

/**
 * Soft lines currently in the live UI prompt.
 * @type {string[]}
 */
export const SOFT_ANTI_LITERAL_BLOCKS = [
  'Use biome, faction membership, wealth, trade, tolls, and history as light inspiration only — do not narrate in the name fields; just name.',
  'Do not mint transparent biome/trade labels like Coppersville, Bogend, Woodtown, Taigaport, or Scrubwatch. At most a minority of names may faintly echo terrain or goods; most must not.',
  'Many real places are named after people (Georgetown, Columbia, Virginia), events, or concepts (Christmas Island, Death Valley). Prefer that kind of coined proper name. The simulation does not supply founders, saints, battles, or myths — invent those from whole cloth when needed, as long as names stay short, map-worthy, and on-flavor.',
]

/**
 * @param {object} annotations
 * @returns {object}
 */
function stripGeoTradeCues(annotations) {
  const next = structuredClone(annotations)
  next.settlements = (next.settlements ?? []).map((row) => {
    const copy = { ...row }
    delete copy.biome
    delete copy.maritimeRole
    delete copy.imports
    delete copy.exports
    delete copy.supplies
    delete copy.wants
    delete copy.wealth
    delete copy.factionTax
    delete copy.portTolls
    return copy
  })
  return next
}

/**
 * @param {object} annotations
 * @returns {object}
 */
function redactBiomeLabels(annotations) {
  const next = structuredClone(annotations)
  next.settlements = (next.settlements ?? []).map((row) => ({
    ...row,
    biome: '[redacted]',
  }))
  return next
}

/**
 * @param {object} annotations
 * @returns {object}
 */
function idsFlavorShell(annotations) {
  return {
    epoch: annotations.epoch,
    factions: (annotations.factions ?? []).map((f) => ({
      id: f.id,
      capitalSettlementId: f.capitalSettlementId,
      settlementIds: f.settlementIds,
      status: f.status,
    })),
    rivalryEdges: annotations.rivalryEdges ?? [],
    settlements: (annotations.settlements ?? []).map((row) => ({
      settlementId: row.settlementId,
      mapNumber: row.mapNumber,
      status: row.status,
      tier: row.tier,
      factionId: row.factionId,
      membershipBand: row.membershipBand,
    })),
  }
}

/** @type {readonly BiomeLiteralPromptVariant[]} */
export const BIOME_LITERAL_PROMPT_VARIANTS = Object.freeze([
  {
    id: 'current_ui',
    label: 'Current live UI soft anti-literal wording',
  },
  {
    id: 'no_anti_literal',
    label: 'No anti-literal lines (antirepeat only)',
    omitSoftAntiLiteral: true,
  },
  {
    id: 'hard_forbid_stems',
    label: 'Hard forbid listed biome/trade stems in any name',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'HARD CONSTRAINT: No settlement name may contain any of these substrings (case-insensitive): taiga, tundra, scrub, coast, bog, mire, marsh, swamp, wood, forest, pine, oak, timber, frost, ice, hill, mountain, dune, dust, salt, brine, copper, iron, grain, fish, sea, tide, wave, shore, port (as a word stem), haven, watch, town, ville.',
      'If a draft name would include one of those, discard it and invent a different proper name.',
      'Invent personal, dynastic, mythic, or event placenames (Georgetown, Virginia, Christmas Island style). The sim does not supply those cues — invent them.',
    ],
  },
  {
    id: 'quota_max_15pct',
    label: 'At most 15% of names may echo terrain/goods',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'Quota rule: at most 15% of settlement names may contain any terrain, biome, climate, or trade-good English word. The other ≥85% must be coined proper names after invented people, houses, saints, battles, or abstract concepts.',
      'Before you finish, scan your settlement name list. If more than 15% fail the quota, rename the offenders.',
      'Bad: Taigaport, Scrubtown, Copperhollow, Frosthold, Coastwatch. Good: Marrowby, Vessant, Orlanth Mere, Red Wedding Shore (event), Saint Brienne.',
    ],
  },
  {
    id: 'few_shot_good_bad',
    label: 'Few-shot good vs bad examples',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'Examples of BAD names (do not produce this pattern): Taigatown, Tundraport, Scrubwatch, Bogfold, Coppersville, Woodend, Coastporttwo, Pinehollow, Saltreach.',
      'Examples of GOOD names (prefer this pattern): Kellhaven is OK only rarely; better: Gerrard’s Rest, Orlanth, Vespera, Nine Bells, Ashen Bride, Port Calum (person), Mournstead, The Drowned County, Brielle, Cassadine.',
      'Most names on the map must look like GOOD examples. Invent founders/events from whole cloth.',
    ],
  },
  {
    id: 'mythos_then_assign',
    label: 'Invent a mythos list first, then assign',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'Process (internal): first invent 40 short proper placenames that sound like people, dynasties, saints, battles, or omens — none may include biome/terrain/trade English words. Then assign those names to settlements and factions. Do not invent new biome-calque names during assignment.',
      'Output only the final JSON schema; do not output the brainstorm list.',
    ],
  },
  {
    id: 'ignore_biome_fields',
    label: 'Explicitly ignore biome/import/export fields for naming',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'The annotated biome, maritimeRole, imports, exports, supplies, and wants fields are NOT naming cues. Ignore them when choosing names. Use them only if you were writing logistics prose (you are not).',
      'Names must come from invented people, houses, and events. Flavor theme may color phonetics, not terrain calques.',
    ],
  },
  {
    id: 'instructions_after_json',
    label: 'Anti-literal instructions AFTER the JSON (recency)',
    omitSoftAntiLiteral: true,
    instructionsAfterJson: true,
    instructionBlocks: [
      'CRITICAL FINAL RULES (override any urge to calque the JSON above):',
      'Do not use biome labels or trade goods as name stems. No Taiga-/Tundra-/Scrub-/Coast-/Bog-/Wood-/Frost-/Salt-/Copper- compounds.',
      '≥80% of settlement names must be invented personal/dynastic/event placenames. Invent the people and events; they are not in the data.',
    ],
  },
  {
    id: 'person_event_mandate',
    label: 'Mandate person/event etymology for every name',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'Every settlement name must be explainable as (1) a person or house name, or (2) a historical event/concept — even though you invent that etymology. Do not use transparent terrain or commodity descriptions as the name itself.',
      'Forbidden pattern: <BiomeOrGood><Town|Port|Watch|Hold|End|Gate|Hollow>.',
    ],
  },
  {
    id: 'phonetic_toponymy',
    label: 'Phonetic toponyms without English meaning',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'Prefer opaque toponyms: short invented words that sound like place names but do not parse as English biome descriptions (e.g. Kelm, Orradine, Vesk, Thalenor, Brid). Occasional transparent poetic names are fine if they are not biome calques.',
      'Ban concatenating the JSON biome string into the name.',
    ],
  },
  {
    id: 'strip_geo_trade_cues',
    label: 'Remove biome/trade fields from annotations',
    omitSoftAntiLiteral: true,
    transformAnnotations: stripGeoTradeCues,
    instructionBlocks: [
      'Invent settlement names after people, events, or opaque toponyms. Stay on flavor.',
    ],
  },
  {
    id: 'redact_biome',
    label: 'Biome field redacted to [redacted]',
    omitSoftAntiLiteral: true,
    transformAnnotations: redactBiomeLabels,
    instructionBlocks: [
      'Biome values are redacted on purpose. Do not guess biomes into names. Prefer personal/event placenames.',
    ],
  },
  {
    id: 'ids_flavor_shell',
    label: 'Ids/politics shell only (no biome/economy/history)',
    omitSoftAntiLiteral: true,
    transformAnnotations: idsFlavorShell,
    instructionBlocks: [
      'With almost no geographic cues, invent diverse proper placenames on-flavor. Avoid repetitive suffixes.',
    ],
  },
  {
    id: 'combined_hard_after_json',
    label: 'Hard forbid + quota + after JSON',
    omitSoftAntiLiteral: true,
    instructionsAfterJson: true,
    instructionBlocks: [
      'FINAL OVERRIDES:',
      '1) Banned stems anywhere in a settlement name: taiga,tundra,scrub,coast,bog,mire,marsh,swamp,wood,forest,pine,oak,timber,frost,ice,hill,dune,dust,salt,copper,iron,sea,tide,wave,shore.',
      '2) Banned suffixes unless the rest of the name is a clear personal/event proper noun (e.g. Port Calum OK, Coastport forbidden): town,ville,watch,hold as lazy biome tags.',
      '3) At least 85% invented person/event/opaque names.',
      '4) If you catch yourself writing Scrub- or Taiga- restart that name.',
    ],
  },
  {
    id: 'soft_plus_hard',
    label: 'Current soft lines + hard forbid stems',
    instructionBlocks: [
      'HARD CONSTRAINT in addition to the above: never include taiga, tundra, scrub, coast, bog, mire, wood, frost, salt, copper, pine, oak, timber as substrings in settlement names.',
    ],
  },
  {
    id: 'pirate_anthroponyms',
    label: 'Flavor-locked pirate personal placenames',
    omitSoftAntiLiteral: true,
    instructionBlocks: [
      'Theme is maritime/rogue, but names should sound like pirate captains, ships, and shanties turned into places: e.g. Rackham Reach is borderline; better: Calico’s Rest, Bonnygrave, Teachmere, Vane’s Mercy, Anne’s Fluke, Nine Fathoms (concept), The Black Benediction.',
      'Do not name places after biomes. Tundra/Taiga/Scrub must not appear.',
    ],
  },
])

/**
 * Build a names-only prompt for a biome-literal experiment variant.
 *
 * @param {{
 *   annotations: object,
 *   flavorPrompt?: string,
 *   variant: BiomeLiteralPromptVariant,
 * }} options
 * @returns {string}
 */
export function buildBiomeLiteralExperimentPrompt(options) {
  const flavor =
    typeof options.flavorPrompt === 'string' ? options.flavorPrompt.trim() : ''
  const variant = options.variant
  const annotations = variant.transformAnnotations
    ? variant.transformAnnotations(options.annotations)
    : options.annotations

  /** @type {string[]} */
  const head = [
    'You invent fantasy names for settlements and factions on a procedural map.',
    'Return JSON matching the schema: { settlements: [{ settlementId, mapNumber, name }], factions: [{ factionId, name }] }.',
    'One settlement entry per settlement in the input. Use the exact settlementId values.',
    'One faction entry per faction in the input. Use the exact factionId values.',
    'Settlement names should feel like fantasy map labels: short, pronounceable, place-like.',
    'Faction names should feel like realms, houses, leagues, or peoples — short and map-legend worthy.',
    'Avoid repetitive morphology across the set: do not reuse the same suffix, prefix, or compound pattern for many names. Vary structure while staying on-theme.',
  ]

  if (!variant.omitSoftAntiLiteral) {
    head.push(...SOFT_ANTI_LITERAL_BLOCKS)
  } else if (!variant.instructionBlocks?.length) {
    head.push(
      'Use biome, faction membership, wealth, trade, tolls, and history as inspiration — do not narrate; just name.',
    )
  }

  const preBlocks =
    !variant.instructionsAfterJson && variant.instructionBlocks
      ? variant.instructionBlocks
      : []
  const postBlocks =
    variant.instructionsAfterJson && variant.instructionBlocks
      ? variant.instructionBlocks
      : []

  /** @type {string[]} */
  const parts = [
    ...head,
    ...preBlocks,
    flavor
      ? `Author flavor / theme (apply strongly to naming style for both settlements and factions): ${flavor}`
      : 'No special author flavor; use grounded fantasy place-name and polity-name style.',
    'Annotated world data:',
    JSON.stringify(annotations),
    ...postBlocks,
  ]

  return parts.join('\n\n')
}
