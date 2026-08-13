const { searchCatalogGames } = require('./catalogQuery')

function getFirestore() {
  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp()
  }
  return admin.firestore()
}

/**
 * Catalog search against Firestore bggCatalogGames (Model A prefixes).
 * Response shape matches prior BGG XML search normalizer output.
 *
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

  try {
    const db = getFirestore()
    const results = await searchCatalogGames(db, query)
    res.status(200).json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('bggSearch failed', err)
    res.status(502).json({ error: message, results: [] })
  }
}

module.exports = {
  bggSearchHandler,
}
