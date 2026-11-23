import { pathbuilderJsonUrl } from './pathbuilderId.js'

/** The only runtime check the viewer makes on a sheet. */
export const SUPPORTED_SCHEMA_VERSION = 1

export const FAILURE_MESSAGES = {
  network: "CritCrafter couldn't reach Pathbuilder. Check your connection and try again.",
  unavailable: 'Pathbuilder is unavailable right now. Try again in a moment.',
  'not-found': 'Build not found or no longer shared. Check the id, or try another.',
  'sheet-failed': "CritCrafter couldn't build this sheet.",
  'schema-unsupported': 'CritCrafter has been updated. Reload the page to update.',
}

/**
 * @typedef {'network' | 'unavailable' | 'not-found' | 'sheet-failed' | 'schema-unsupported'} FailureState
 * @typedef {{ ok: true, sheet: any }} LoadOk
 * @typedef {{ ok: false, state: FailureState, retry: boolean, tryAnother: boolean, message: string }} LoadFailure
 */

/**
 * @param {FailureState} state
 * @param {boolean} retry
 * @returns {LoadFailure}
 */
function fail(state, retry) {
  return { ok: false, state, retry, tryAnother: state === 'not-found', message: FAILURE_MESSAGES[state] }
}

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Relay: browser GET to Pathbuilder (no custom headers, so no preflight), POST the body verbatim to
 * the sheet function, return the sheet. Nothing is cached.
 * @param {object} p
 * @param {string} p.id Normalised Pathbuilder id.
 * @param {typeof fetch} p.fetchImpl
 * @param {string} p.functionUrl Full URL of the `critcrafterSheet` function.
 * @param {() => Promise<string | null>} [p.getAppCheckToken]
 * @param {(step: 'fetching' | 'building') => void} [p.onStep]
 * @returns {Promise<LoadOk | LoadFailure>}
 */
export async function loadSheet({ id, fetchImpl, functionUrl, getAppCheckToken, onStep }) {
  onStep?.('fetching')
  let body
  try {
    const res = await fetchImpl(pathbuilderJsonUrl(id))
    if (res.status === 404) return fail('not-found', false)
    if (!res.ok) return fail('unavailable', true)
    body = await res.text()
  } catch {
    return fail('network', true)
  }

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return fail('unavailable', true)
  }
  if (!parsed || parsed.success !== true || !parsed.build) return fail('not-found', false)

  onStep?.('building')
  try {
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' }
    const token = getAppCheckToken ? await getAppCheckToken().catch(() => null) : null
    if (token) headers['X-Firebase-AppCheck'] = token
    const res = await fetchImpl(functionUrl, { method: 'POST', headers, body })
    if (!res.ok) {
      const err = await safeJson(res)
      return fail('sheet-failed', err?.error?.code !== 'invalid_build')
    }
    const sheet = await safeJson(res)
    if (!sheet || typeof sheet !== 'object') return fail('sheet-failed', true)
    if (sheet.schemaVersion !== SUPPORTED_SCHEMA_VERSION) return fail('schema-unsupported', false)
    return { ok: true, sheet }
  } catch {
    return fail('sheet-failed', true)
  }
}
