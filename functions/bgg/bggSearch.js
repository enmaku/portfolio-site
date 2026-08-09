const { fetchBgg } = require('./fetchBgg')
const { normalizeBggSearchXml } = require('./normalize')

/**
 * @param {import('firebase-functions/v2/https').Request} req
 * @param {import('firebase-functions/v2/https').Response} res
 */
async function bggSearchHandler(req, res) {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET')
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const query = String(req.query.query || '').trim()
  if (!query) {
    res.status(400).json({ error: 'missing_query', results: [] })
    return
  }

  const type = String(req.query.type || 'boardgame').trim() || 'boardgame'

  try {
    const upstream = await fetchBgg('/search', { query, type })
    const xml = await upstream.text()
    if (!upstream.ok) {
      res.status(upstream.status >= 400 ? upstream.status : 502).json({
        error: 'upstream_error',
        results: [],
      })
      return
    }

    res.status(200).json({ results: normalizeBggSearchXml(xml) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    const status = message.includes('GAME_MANAGER_API_KEY') ? 500 : 502
    res.status(status).json({ error: message, results: [] })
  }
}

module.exports = {
  bggSearchHandler,
}
