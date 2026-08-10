const { fetchBgg } = require('./fetchBgg')
const { normalizeBggThingListXml, normalizeBggThingXml } = require('./normalize')

const MAX_BATCH = 20

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseThingIds(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part))
    .slice(0, MAX_BATCH)
}

/**
 * @param {import('firebase-functions/v2/https').Request} req
 * @param {import('firebase-functions/v2/https').Response} res
 */
async function bggThingHandler(req, res) {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET')
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const ids = parseThingIds(req.query.id)
  if (ids.length === 0) {
    res.status(400).json({ error: 'missing_id', entry: null, entries: [] })
    return
  }

  const stats = req.query.stats === undefined || String(req.query.stats) === '1' ? '1' : undefined

  try {
    const upstream = await fetchBgg('/thing', { id: ids.join(','), stats })
    const xml = await upstream.text()
    if (!upstream.ok) {
      res.status(upstream.status >= 400 ? upstream.status : 502).json({
        error: 'upstream_error',
        entry: null,
        entries: [],
      })
      return
    }

    const entries = normalizeBggThingListXml(xml)
    if (entries.length === 0) {
      res.status(404).json({ error: 'not_found', entry: null, entries: [] })
      return
    }

    // Single-id clients keep reading `entry`; batch clients use `entries`.
    res.status(200).json({
      entry: ids.length === 1 ? normalizeBggThingXml(xml) || entries[0] : entries[0],
      entries,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    const status = message.includes('GAME_MANAGER_API_KEY') ? 500 : 502
    res.status(status).json({ error: message, entry: null, entries: [] })
  }
}

module.exports = {
  bggThingHandler,
  parseThingIds,
}
