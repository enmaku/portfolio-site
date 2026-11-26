'use strict'
// The critcrafterSheet HTTP boundary (SPEC "Function boundary"): method, App Check, size limits, JSON
// parsing, error envelope and structured logging. The sheet itself comes from `buildSheet(build)`.
const { randomUUID } = require('node:crypto')

const MAX_REQUEST_BYTES = 1024 * 1024

const MESSAGES = {
  method_not_allowed: 'Use POST with the Pathbuilder json.php response as the body.',
  app_check_failed: 'A valid App Check token is required.',
  bad_json: 'The request body is not valid JSON.',
  too_large: 'The request body is larger than 1 MB.',
  invalid_build: 'The body must be an object with an object "build".',
  rate_limited: 'Too many requests.',
  internal: 'CritCrafter could not build this sheet.',
}
const STATUS = { method_not_allowed: 405, app_check_failed: 401, bad_json: 400, too_large: 413, invalid_build: 422, rate_limited: 429, internal: 500 }

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function warningCounts(sheet) {
  const counts = {}
  for (const w of (sheet && sheet.warnings) || []) {
    if (w && typeof w.code === 'string') counts[w.code] = (counts[w.code] || 0) + 1
  }
  return counts
}

/**
 * @param {object} deps
 * @param {(build: object) => Promise<object>} deps.buildSheet
 * @param {(req) => Promise<boolean>} [deps.verifyAppCheck]
 * @param {{info, warn, error}} [deps.log] structured logger (firebase-functions/logger shape)
 */
function createHandler({ buildSheet, verifyAppCheck, log = { info() {}, warn() {}, error() {} } }) {
  return async function critcrafterSheetHandler(req, res) {
    const started = Date.now()
    const requestId = randomUUID()
    let requestBytes = 0

    const fail = (code) => {
      const status = STATUS[code]
      log[status >= 500 ? 'error' : 'warn']('critcrafter.error', {
        requestId,
        requestBytes,
        durationMs: Date.now() - started,
        errorCode: code,
      })
      res.status(status)
      if (code === 'method_not_allowed') res.set('Allow', 'POST')
      res.set('Content-Type', 'application/json; charset=utf-8')
      res.send(JSON.stringify({ error: { code, message: MESSAGES[code] } }))
    }

    try {
      if (req.method !== 'POST') return fail('method_not_allowed')
      if (verifyAppCheck && !(await verifyAppCheck(req))) return fail('app_check_failed')

      const declared = Number(req.headers && req.headers['content-length'])
      if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) return fail('too_large')

      let parsed
      if (req.rawBody !== undefined && req.rawBody !== null) {
        requestBytes = Buffer.byteLength(req.rawBody)
        if (requestBytes > MAX_REQUEST_BYTES) return fail('too_large')
        try {
          parsed = JSON.parse(Buffer.from(req.rawBody).toString('utf8'))
        } catch {
          return fail('bad_json')
        }
      } else if (typeof req.body === 'string') {
        requestBytes = Buffer.byteLength(req.body)
        if (requestBytes > MAX_REQUEST_BYTES) return fail('too_large')
        try {
          parsed = JSON.parse(req.body)
        } catch {
          return fail('bad_json')
        }
      } else if (req.body !== undefined && req.body !== null) {
        requestBytes = Buffer.byteLength(JSON.stringify(req.body))
        if (requestBytes > MAX_REQUEST_BYTES) return fail('too_large')
        parsed = req.body
      } else {
        return fail('bad_json')
      }

      if (!isPlainObject(parsed) || !isPlainObject(parsed.build)) return fail('invalid_build')

      const sheet = await buildSheet(parsed.build)
      const text = JSON.stringify(sheet)
      const responseBytes = Buffer.byteLength(text)
      log.info('critcrafter.sheet', {
        requestId,
        requestBytes,
        responseBytes,
        durationMs: Date.now() - started,
        corpusSha: (sheet && sheet.corpus && sheet.corpus.sha) || null,
        warningCounts: warningCounts(sheet),
        errorCode: null,
      })
      res.status(200).set('Content-Type', 'application/json; charset=utf-8').send(text)
    } catch {
      // The cause is deliberately not logged: it could carry names from the export.
      fail('internal')
    }
  }
}

module.exports = { createHandler, MAX_REQUEST_BYTES, warningCounts }
