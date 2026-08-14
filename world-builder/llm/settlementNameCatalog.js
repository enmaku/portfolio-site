/**
 * @typedef {{
 *   settlements?: Record<string, string> | null,
 *   factions?: Record<string, string> | null,
 *   regionName?: string | null,
 * }} SettlementNameCatalogInput
 *
 * @typedef {{
 *   settlements: Record<string, string>,
 *   factions: Record<string, string>,
 *   regionName: string,
 * }} SettlementNameCatalog
 *
 * @typedef {'empty' | 'partial' | 'complete'} SettlementNameGenerationMode
 *
 * @typedef {{
 *   mode: SettlementNameGenerationMode,
 *   provided: SettlementNameCatalog,
 *   missingSettlementIds: string[],
 *   missingFactionIds: string[],
 *   missingRegionName: boolean,
 * }} SettlementNameGenerationPlan
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCatalogName(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * @param {Record<string, string> | null | undefined} namesById
 * @returns {Record<string, string>}
 */
export function compactNameMap(namesById) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!namesById || typeof namesById !== 'object') return out
  for (const [id, raw] of Object.entries(namesById)) {
    if (typeof id !== 'string' || !id) continue
    const name = normalizeCatalogName(raw)
    if (!name) continue
    out[id] = name
  }
  return out
}

/**
 * @param {SettlementNameCatalogInput | null | undefined} catalog
 * @returns {SettlementNameCatalog}
 */
export function compactNameCatalog(catalog) {
  return {
    settlements: compactNameMap(catalog?.settlements),
    factions: compactNameMap(catalog?.factions),
    regionName: normalizeCatalogName(catalog?.regionName),
  }
}

/**
 * @param {Record<string, string>} namesById
 * @param {string[]} expectedIds
 * @returns {Record<string, string>}
 */
function pickKnownNames(namesById, expectedIds) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const id of expectedIds) {
    const name = namesById[id]
    if (name) out[id] = name
  }
  return out
}

/**
 * @param {string[] | null | undefined} ids
 * @returns {string[]}
 */
function uniqueIds(ids) {
  /** @type {string[]} */
  const out = []
  /** @type {Set<string>} */
  const seen = new Set()
  for (const id of ids ?? []) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * @param {{
 *   expectedSettlementIds?: string[] | null,
 *   expectedFactionIds?: string[] | null,
 *   catalog?: SettlementNameCatalogInput | null,
 * }} options
 * @returns {SettlementNameGenerationPlan}
 */
export function resolveSettlementNameGenerationMode(options) {
  const expectedSettlementIds = uniqueIds(options.expectedSettlementIds)
  const expectedFactionIds = uniqueIds(options.expectedFactionIds)
  const catalog = compactNameCatalog(options.catalog)
  const provided = {
    settlements: pickKnownNames(catalog.settlements, expectedSettlementIds),
    factions: pickKnownNames(catalog.factions, expectedFactionIds),
    regionName: catalog.regionName,
  }
  const missingSettlementIds = expectedSettlementIds.filter((id) => !provided.settlements[id])
  const missingFactionIds = expectedFactionIds.filter((id) => !provided.factions[id])
  const missingRegionName = !provided.regionName
  const providedCount =
    Object.keys(provided.settlements).length +
    Object.keys(provided.factions).length +
    (provided.regionName ? 1 : 0)

  /** @type {SettlementNameGenerationMode} */
  let mode = 'partial'
  if (providedCount === 0) mode = 'empty'
  else if (
    missingSettlementIds.length === 0 &&
    missingFactionIds.length === 0 &&
    !missingRegionName
  ) {
    mode = 'complete'
  }

  return {
    mode,
    provided,
    missingSettlementIds,
    missingFactionIds,
    missingRegionName,
  }
}

/**
 * @param {Record<string, string>} left
 * @param {Record<string, string>} right
 * @returns {string[]}
 */
function unionKeys(left, right) {
  return uniqueIds([...Object.keys(left), ...Object.keys(right)])
}

/**
 * Provided names always win. Generated names fill only empty expected slots.
 *
 * @param {{
 *   provided?: SettlementNameCatalogInput | null,
 *   generated?: SettlementNameCatalogInput | null,
 *   expectedSettlementIds?: string[] | null,
 *   expectedFactionIds?: string[] | null,
 * }} options
 * @returns {SettlementNameCatalog}
 */
export function mergeProtectedSettlementNames(options) {
  const provided = compactNameCatalog(options.provided)
  const generated = compactNameCatalog(options.generated)
  const settlementIds = options.expectedSettlementIds
    ? uniqueIds(options.expectedSettlementIds)
    : unionKeys(provided.settlements, generated.settlements)
  const factionIds = options.expectedFactionIds
    ? uniqueIds(options.expectedFactionIds)
    : unionKeys(provided.factions, generated.factions)

  /** @type {Record<string, string>} */
  const settlements = {}
  for (const id of settlementIds) {
    const name = provided.settlements[id] || generated.settlements[id]
    if (name) settlements[id] = name
  }

  /** @type {Record<string, string>} */
  const factions = {}
  for (const id of factionIds) {
    const name = provided.factions[id] || generated.factions[id]
    if (name) factions[id] = name
  }

  return {
    settlements,
    factions,
    regionName: provided.regionName || generated.regionName,
  }
}

/**
 * @param {SettlementNameCatalogInput | null | undefined} catalog
 * @param {string} [writeup]
 * @returns {boolean}
 */
export function catalogHasResettableNames(catalog, writeup) {
  const compact = compactNameCatalog(catalog)
  return (
    Object.keys(compact.settlements).length > 0 ||
    Object.keys(compact.factions).length > 0 ||
    Boolean(compact.regionName) ||
    Boolean(normalizeCatalogName(writeup))
  )
}
