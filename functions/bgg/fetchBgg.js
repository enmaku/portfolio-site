const { withBggRateLimit } = require('./rateLimit')

const BGG_BASE = 'https://boardgamegeek.com/xmlapi2'

/**
 * @returns {string}
 */
function readApiKey() {
  return String(process.env.GAME_MANAGER_API_KEY || '').trim()
}

/**
 * @param {string} path e.g. `/search`
 * @param {Record<string, string | undefined>} searchParams
 * @returns {Promise<Response>}
 */
async function fetchBgg(path, searchParams) {
  const apiKey = readApiKey()
  if (!apiKey) {
    throw new Error('GAME_MANAGER_API_KEY is not configured')
  }

  const url = new URL(`${BGG_BASE}${path.startsWith('/') ? path : `/${path}`}`)
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  return withBggRateLimit(() =>
    fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/xml,text/xml,*/*',
      },
    }),
  )
}

module.exports = {
  fetchBgg,
}
