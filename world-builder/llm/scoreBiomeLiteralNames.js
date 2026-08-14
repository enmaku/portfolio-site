/**
 * Heuristic scores for biome / geography calque settlement names.
 */

/** English stems that echo sim biome / commodity / terrain cues. */
export const BIOME_GEO_STEMS = Object.freeze([
  'taiga',
  'tundra',
  'scrub',
  'coast',
  'bog',
  'mire',
  'marsh',
  'swamp',
  'fen',
  'wood',
  'woods',
  'forest',
  'pine',
  'oak',
  'timber',
  'frost',
  'ice',
  'snow',
  'winter',
  'hill',
  'hills',
  'crag',
  'mountain',
  'peak',
  'dune',
  'dust',
  'desert',
  'savanna',
  'grass',
  'plain',
  'plains',
  'meadow',
  'field',
  'salt',
  'brine',
  'tide',
  'wave',
  'sea',
  'gull',
  'copper',
  'iron',
  'metal',
  'grain',
  'fish',
  'river',
  'lake',
  'isle',
  'island',
])

/** Common map-label suffixes that pair with the stems above into calques. */
export const GEO_PLACE_SUFFIXES = Object.freeze([
  'town',
  'ville',
  'village',
  'port',
  'gate',
  'watch',
  'hold',
  'haven',
  'reach',
  'end',
  'hollow',
  'fold',
  'edge',
  'outpost',
  'mark',
  'cap',
  'point',
  'crest',
  'ridge',
  'deep',
  'run',
  'well',
  'fall',
  'falls',
  'briar',
  'heart',
  'spray',
  'shore',
  'field',
])

/**
 * @param {string} name
 * @returns {string}
 */
export function normalizePlaceName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * @param {string} name
 * @param {readonly string[]} stems
 * @returns {string[]}
 */
export function matchingStems(name, stems = BIOME_GEO_STEMS) {
  const norm = normalizePlaceName(name)
  if (!norm) return []
  return stems.filter((stem) => stem.length >= 3 && norm.includes(stem))
}

/**
 * @param {string} name
 * @param {readonly string[]} suffixes
 * @returns {string[]}
 */
export function matchingSuffixes(name, suffixes = GEO_PLACE_SUFFIXES) {
  const norm = normalizePlaceName(name)
  if (!norm) return []
  return suffixes.filter((suffix) => suffix.length >= 3 && norm.endsWith(suffix))
}

/**
 * @param {string} name
 * @param {string | null | undefined} biomeLabel
 * @returns {boolean}
 */
export function echoesBiomeLabel(name, biomeLabel) {
  const biome = String(biomeLabel ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  if (biome.length < 3) return false
  return normalizePlaceName(name).includes(biome)
}

/**
 * @param {{
 *   settlements: Record<string, string>,
 *   biomeBySettlementId?: Record<string, string>,
 * }} options
 */
export function scoreBiomeLiteralNames(options) {
  const entries = Object.entries(options.settlements ?? {})
  const total = entries.length
  if (total === 0) {
    return {
      total: 0,
      stemHitCount: 0,
      suffixHitCount: 0,
      calqueCount: 0,
      ownBiomeEchoCount: 0,
      stemHitRate: 0,
      suffixHitRate: 0,
      calqueRate: 0,
      ownBiomeEchoRate: 0,
      stemFrequency: {},
      suffixFrequency: {},
      flagged: [],
    }
  }

  /** @type {Record<string, number>} */
  const stemFrequency = {}
  /** @type {Record<string, number>} */
  const suffixFrequency = {}
  /** @type {object[]} */
  const flagged = []

  let stemHitCount = 0
  let suffixHitCount = 0
  let calqueCount = 0
  let ownBiomeEchoCount = 0

  for (const [settlementId, name] of entries) {
    const stems = matchingStems(name)
    const suffixes = matchingSuffixes(name)
    const biome = options.biomeBySettlementId?.[settlementId]
    const ownBiome = echoesBiomeLabel(name, biome)
    const isCalque = stems.length > 0 && suffixes.length > 0

    if (stems.length) {
      stemHitCount += 1
      for (const stem of stems) stemFrequency[stem] = (stemFrequency[stem] ?? 0) + 1
    }
    if (suffixes.length) {
      suffixHitCount += 1
      for (const suffix of suffixes) {
        suffixFrequency[suffix] = (suffixFrequency[suffix] ?? 0) + 1
      }
    }
    if (isCalque) calqueCount += 1
    if (ownBiome) ownBiomeEchoCount += 1

    if (stems.length || ownBiome || isCalque) {
      flagged.push({
        settlementId,
        name,
        stems,
        suffixes,
        ownBiome,
        isCalque,
        biome: biome ?? null,
      })
    }
  }

  return {
    total,
    stemHitCount,
    suffixHitCount,
    calqueCount,
    ownBiomeEchoCount,
    stemHitRate: stemHitCount / total,
    suffixHitRate: suffixHitCount / total,
    calqueRate: calqueCount / total,
    ownBiomeEchoRate: ownBiomeEchoCount / total,
    stemFrequency,
    suffixFrequency,
    flagged,
  }
}
