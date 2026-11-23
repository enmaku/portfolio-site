'use strict'
// Minimal req/res doubles for exercising an onRequest handler without a server.

function fakeReq({ method = 'POST', headers = {}, body, rawBody } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  const raw = rawBody !== undefined ? rawBody : body === undefined ? undefined : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  return {
    method,
    headers: lower,
    get: (n) => lower[String(n).toLowerCase()],
    header: (n) => lower[String(n).toLowerCase()],
    rawBody: raw,
    body: body !== undefined && typeof body !== 'string' ? body : undefined,
  }
}

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(c) {
      res.statusCode = c
      return res
    },
    set(k, v) {
      res.headers[String(k).toLowerCase()] = v
      return res
    },
    send(b) {
      res.body = b
      return res
    },
    get json() {
      return JSON.parse(res.body)
    },
  }
  return res
}

function fakeLog() {
  const entries = []
  const push = (severity) => (message, fields) => entries.push({ severity, message, fields })
  return { entries, info: push('INFO'), warn: push('WARNING'), error: push('ERROR') }
}

module.exports = { fakeReq, fakeRes, fakeLog }
