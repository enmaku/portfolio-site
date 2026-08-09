/**
 * BoardGameGeek XML API2 normalizers (functions copy — keep in sync with src/features/game-manager/catalog/normalizeBgg.js).
 * @see https://boardgamegeek.com/wiki/page/BGG_XML_API2
 */

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function decodeXmlEntities(raw) {
  if (raw == null || raw === '') return null
  return String(raw)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
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
 * @param {string} xml
 */
function normalizeBggThingXml(xml) {
  if (!xml || !String(xml).trim()) return null
  const block = extractItemBlocks(String(xml))[0]
  if (!block) return null

  const catalogEntryId = itemIdFromBlock(block)
  const title = primaryNameFromItem(block)
  if (!catalogEntryId || !title) return null

  const yearTags = extractSelfClosingTags(block, 'yearpublished')
  const minPlayers = extractSelfClosingTags(block, 'minplayers')[0]?.value
  const maxPlayers = extractSelfClosingTags(block, 'maxplayers')[0]?.value
  const playingTime = extractSelfClosingTags(block, 'playingtime')[0]?.value
  const minPlayTime = extractSelfClosingTags(block, 'minplaytime')[0]?.value
  const maxPlayTime = extractSelfClosingTags(block, 'maxplaytime')[0]?.value

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
    description: extractElementText(block, 'description'),
  }
}

module.exports = {
  normalizeBggSearchXml,
  normalizeBggThingXml,
}
