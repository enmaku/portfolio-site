/**
 * BoardGameGeek XML API2 normalizers (functions copy — keep in sync with src/features/game-manager/catalog/normalizeBgg.js).
 * @see https://boardgamegeek.com/wiki/page/BGG_XML_API2
 */

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  bull: '\u2022',
  ldquo: '\u201C',
  rdquo: '\u201D',
  lsquo: '\u2018',
  rsquo: '\u2019',
  times: '\u00D7',
  trade: '\u2122',
  copy: '\u00A9',
  reg: '\u00AE',
}

/**
 * Decode XML/HTML entities. Runs multiple passes for BGG double-encoding
 * (`&amp;nbsp;` → `&nbsp;` → space).
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function decodeXmlEntities(raw) {
  if (raw == null || raw === '') return null
  let text = String(raw)
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
      .replace(/&([a-zA-Z]+);/g, (match, name) => {
        const mapped = NAMED_ENTITIES[name.toLowerCase()]
        return mapped !== undefined ? mapped : match
      })
    if (next === text) break
    text = next
  }
  return text.trim()
}

/**
 * BGG descriptions are HTML fragments. Produce plain wrapped text for UI.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function normalizeDescriptionText(raw) {
  const decoded = decodeXmlEntities(raw)
  if (!decoded) return null
  return decoded
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @param {string} tagOpen
 * @returns {Record<string, string>}
 */
function parseTagAttributes(tagOpen) {
  /** @type {Record<string, string>} */
  const attrs = {}
  const re = /([\w:-]+)="([^"]*)"/g
  let match = re.exec(tagOpen)
  while (match) {
    attrs[match[1]] = match[2]
    match = re.exec(tagOpen)
  }
  return attrs
}

/**
 * @param {string} xml
 * @returns {string[]}
 */
function extractItemBlocks(xml) {
  const blocks = []
  const re = /<item\b[^>]*>[\s\S]*?<\/item>/g
  let match = re.exec(xml)
  while (match) {
    blocks.push(match[0])
    match = re.exec(xml)
  }
  return blocks
}

/**
 * @param {string} itemXml
 * @param {string} tag
 * @returns {Record<string, string>[]}
 */
function extractSelfClosingTags(itemXml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*/>`, 'g')
  /** @type {Record<string, string>[]} */
  const tags = []
  let match = re.exec(itemXml)
  while (match) {
    tags.push(parseTagAttributes(match[0]))
    match = re.exec(itemXml)
  }
  return tags
}

/**
 * @param {string} itemXml
 * @param {string} tag
 * @returns {string | null}
 */
function extractElementText(itemXml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = re.exec(itemXml)
  return match ? decodeXmlEntities(match[1]) : null
}

/**
 * @param {string | number | null | undefined} value
 * @returns {number | null}
 */
function toInt(value) {
  if (value == null || value === '') return null
  const n = Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string} itemXml
 * @returns {string | null}
 */
function primaryNameFromItem(itemXml) {
  const names = extractSelfClosingTags(itemXml, 'name')
  const primary = names.find((n) => n.type === 'primary')
  if (primary?.value) return decodeXmlEntities(primary.value)
  const first = names.find((n) => n.value)
  return first?.value ? decodeXmlEntities(first.value) : null
}

/**
 * @param {string} itemXml
 * @returns {string | null}
 */
function itemIdFromBlock(itemXml) {
  const open = /^<item\b([^>]*)>/.exec(itemXml)
  if (!open) return null
  const attrs = parseTagAttributes(open[0])
  return attrs.id ? String(attrs.id) : null
}

/**
 * @param {string} xml
 */
function normalizeBggSearchXml(xml) {
  if (!xml || !String(xml).trim()) return []
  return extractItemBlocks(String(xml))
    .map((block) => {
      const catalogEntryId = itemIdFromBlock(block)
      const title = primaryNameFromItem(block)
      if (!catalogEntryId || !title) return null
      const yearTags = extractSelfClosingTags(block, 'yearpublished')
      const open = /^<item\b([^>]*)>/.exec(block)
      const itemAttrs = open ? parseTagAttributes(open[0]) : {}
      return {
        catalogEntryId,
        title,
        yearPublished: toInt(yearTags[0]?.value),
        type: itemAttrs.type || null,
      }
    })
    .filter(Boolean)
}

/**
 * @param {string | number | null | undefined} value
 * @returns {number | null}
 */
function toFloat(value) {
  if (value == null || value === '') return null
  const n = Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string} xml
 * @param {string} tag
 * @returns {Record<string, string> | null}
 */
function firstSelfClosingTag(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*/>`)
  const match = re.exec(xml)
  return match ? parseTagAttributes(match[0]) : null
}

/**
 * @param {string} block
 */
function extractRatingsStats(block) {
  const ratingsMatch = /<ratings\b[^>]*>([\s\S]*?)<\/ratings>/.exec(block)
  if (!ratingsMatch) {
    return {
      usersRated: null,
      averageRating: null,
      bayesAverage: null,
      boardGameRank: null,
    }
  }
  const ratingsXml = ratingsMatch[1]
  const ranks = extractSelfClosingTags(ratingsXml, 'rank')
  const boardRank = ranks.find((r) => r.name === 'boardgame' && (r.type === 'subtype' || !r.type))
  let boardGameRank = null
  if (boardRank?.value && !/^not\s*ranked$/i.test(String(boardRank.value))) {
    boardGameRank = toInt(boardRank.value)
  }
  return {
    usersRated: toInt(firstSelfClosingTag(ratingsXml, 'usersrated')?.value),
    averageRating: toFloat(firstSelfClosingTag(ratingsXml, 'average')?.value),
    bayesAverage: toFloat(firstSelfClosingTag(ratingsXml, 'bayesaverage')?.value),
    boardGameRank,
  }
}

/**
 * @param {string} xml
 */
function normalizeBggThingXml(xml) {
  const entries = normalizeBggThingListXml(xml)
  return entries[0] || null
}

/**
 * @param {string} block
 */
function normalizeThingBlock(block) {
  const catalogEntryId = itemIdFromBlock(block)
  const title = primaryNameFromItem(block)
  if (!catalogEntryId || !title) return null

  const open = /^<item\b([^>]*)>/.exec(block)
  const itemAttrs = open ? parseTagAttributes(open[0]) : {}
  const yearTags = extractSelfClosingTags(block, 'yearpublished')
  const minPlayers = extractSelfClosingTags(block, 'minplayers')[0]?.value
  const maxPlayers = extractSelfClosingTags(block, 'maxplayers')[0]?.value
  const playingTime = extractSelfClosingTags(block, 'playingtime')[0]?.value
  const minPlayTime = extractSelfClosingTags(block, 'minplaytime')[0]?.value
  const maxPlayTime = extractSelfClosingTags(block, 'maxplaytime')[0]?.value
  const ratings = extractRatingsStats(block)

  return {
    catalogEntryId,
    title,
    yearPublished: toInt(yearTags[0]?.value),
    minPlayers: toInt(minPlayers),
    maxPlayers: toInt(maxPlayers),
    playingTime: toInt(playingTime),
    minPlayTime: toInt(minPlayTime),
    maxPlayTime: toInt(maxPlayTime),
    thumbnailUrl: extractElementText(block, 'thumbnail'),
    imageUrl: extractElementText(block, 'image'),
    description: normalizeDescriptionText(extractElementText(block, 'description')),
    thingType: itemAttrs.type || null,
    usersRated: ratings.usersRated,
    averageRating: ratings.averageRating,
    bayesAverage: ratings.bayesAverage,
    boardGameRank: ratings.boardGameRank,
  }
}

/**
 * @param {string} xml
 */
function normalizeBggThingListXml(xml) {
  if (!xml || !String(xml).trim()) return []
  return extractItemBlocks(String(xml))
    .map((block) => normalizeThingBlock(block))
    .filter(Boolean)
}

module.exports = {
  normalizeBggSearchXml,
  normalizeBggThingXml,
  normalizeBggThingListXml,
}
