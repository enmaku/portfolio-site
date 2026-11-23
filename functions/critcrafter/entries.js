'use strict'
// Shaping corpus documents into the sheet's common entry shape (schema $defs: entry, rules, cost).
const { normaliseName } = require('./derived/skills')

const PLACEHOLDER = /^(not set|none selected|not selected|none)$/i

/** null for Pathbuilder placeholders and blanks, else the trimmed string. */
function cleanText(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return !s || PLACEHOLDER.test(s) ? null : s
}

const aonSearchUrl = (name) => `https://2e.aonprd.com/Search.aspx?q=${encodeURIComponent(name)}`
const isCustomName = (name) => /^custom\b/i.test(String(name).trim())

function rulesOf(data) {
  const license = data.license === 'OGL' || data.license === 'ORC' ? data.license : data.remaster ? 'ORC' : 'OGL'
  return { html: String(data.description || ''), license, remaster: Boolean(data.remaster), source: String(data.title || '') }
}

const clampActions = (n) => Math.min(3, Math.max(1, Number(n) || 1))

/** Foundry spell cast time ("2", "1 to 3", "reaction", "10 minutes") -> structured cost. */
function parseCastTime(time) {
  const t = String(time == null ? '' : time).trim().toLowerCase()
  if (!t) return null
  if (t === 'reaction') return { kind: 'reaction' }
  if (t === 'free') return { kind: 'free' }
  if (/^\d$/.test(t)) return { kind: 'actions', min: clampActions(t) }
  const range = /^(\d)\s*(?:to|-|or)\s*(\d)(?:\s*actions?)?$/.exec(t)
  if (range) return { kind: 'actions', min: clampActions(range[1]), max: clampActions(range[2]) }
  return { kind: 'time', label: String(time).trim() }
}

/** Corpus actionType/actions -> structured cost; null for passives and anything without a cost. */
function costOf(data) {
  if (data.type === 'spell') return parseCastTime(data.spell && data.spell.time)
  if (data.actionType === 'reaction') return { kind: 'reaction' }
  if (data.actionType === 'free') return { kind: 'free' }
  if (data.actionType === 'action' && data.actions) return { kind: 'actions', min: clampActions(data.actions) }
  return null
}

const COST_ORDER = { free: 0, actions: 1, time: 5, reaction: 4 }
/** Sort rank: free, 1, 2, 3, reaction, then time, then costless. A range sorts by its minimum. */
function costRank(cost) {
  if (!cost || !cost.kind) return 99
  if (cost.kind === 'actions') return 1 + (cost.min - 1) / 10
  return COST_ORDER[cost.kind]
}

function formatPrice(price) {
  if (!price || typeof price !== 'object') return null
  const parts = ['pp', 'gp', 'sp', 'cp'].filter((c) => Number(price[c]) > 0).map((c) => `${price[c]} ${c}`)
  return parts.length ? parts.join(' ') : null
}

/** Foundry bulk (0.1 is light) -> number, 'L', or null when unknown. */
function bulkOf(data) {
  if (!data || data.bulk === null || data.bulk === undefined || data.bulk === '') return null
  const n = Number(data.bulk)
  if (!Number.isFinite(n)) return null
  return n > 0 && n < 1 ? 'L' : n
}

function defenseText(defense) {
  if (!defense || !defense.statistic) return null
  const name = String(defense.statistic)
  const cap = name.charAt(0).toUpperCase() + name.slice(1)
  return defense.basic ? `basic ${cap}` : cap
}

function areaText(area) {
  if (!area || !area.type) return null
  return area.value ? `${area.value}-foot ${area.type}` : String(area.type)
}

/** A key factory: `<section>:<normalised-name>#<nth>`, counting per section and normalised name. */
function createKeyer() {
  const seen = new Map()
  return (section, name) => {
    const base = `${section}:${normaliseName(name) || 'unnamed'}`
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    return `${base}#${n}`
  }
}

/**
 * The common entry shape. `hit` is a resolved `{entry: {data}}` or null (a miss). `name` is the author's
 * name from the export; `extra` carries kind-specific fields.
 */
function makeEntry({ key, name, kind, hit, option, count, extra = {}, forceNoCost = false }) {
  const data = hit ? hit.entry.data : null
  const out = {
    key,
    name,
    kind,
    traits: data ? [...(data.traits || [])] : [],
    cost: data && !forceNoCost ? costOf(data) : null,
  }
  if (data && Number.isInteger(data.level)) out.level = data.level
  if (count && count > 1) out.count = count
  if (option) out.option = option
  out.rules = data ? rulesOf(data) : null
  out.aonUrl = data ? aonSearchUrl(data.name) : isCustomName(name) ? null : aonSearchUrl(name)
  return Object.assign(out, extra)
}

module.exports = {
  PLACEHOLDER,
  cleanText,
  aonSearchUrl,
  isCustomName,
  rulesOf,
  parseCastTime,
  costOf,
  costRank,
  formatPrice,
  bulkOf,
  defenseText,
  areaText,
  createKeyer,
  makeEntry,
}
