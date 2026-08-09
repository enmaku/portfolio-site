const { fetchBgg } = require('./fetchBgg')
const { normalizeBggThingXml } = require('./normalize')

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

  const id = String(req.query.id || '').trim()
  if (!id) {
    res.status(400).json({ error: 'missing_id', entry: null })
    return
  }

  const stats = req.query.stats === undefined || String(req.query.stats) === '1' ? '1' : undefined

  try {
    const upstream = await fetchBgg('/thing', { id, stats })
    const xml = await upstream.text()
    if (!upstream.ok) {
      res.status(upstream.status >= 400 ? upstream.status : 502).json({
        error: 'upstream_error',
        entry: null,
      })
      return
    }

    const entry = normalizeBggThingXml(xml)
    if (!entry) {
      res.status(404).json({ error: 'not_found', entry: null })
      return
    }

    res.status(200).json({ entry })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    const status = message.includes('GAME_MANAGER_API_KEY') ? 500 : 502
    res.status(status).json({ error: message, entry: null })
  }
}

module.exports = {
  bggThingHandler,
}
