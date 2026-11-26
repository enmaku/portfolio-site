'use strict'
// Name resolution against the rules corpus (SPEC "Corpus"): exact nameKey, then alias, then miss.
// Lookups are batched and cached up front (`prefetch`), so the sheet assembly itself is synchronous.
//
// Store contract (store.js for Firestore, test/memoryStore.js in tests):
//   byNameKeys(keys[<=30]) -> [{id, data}]   entries whose nameKey is in keys
//   byAliases(keys[<=30])  -> [{id, data}]   entries whose aliases array contains any of keys
//   meta()                 -> { sha } | null  rulesMeta/current
const { nameKey } = require('./nameKey')

const CHUNK = 30
const DEFAULT_CACHE_MAX = 3000

function ordinal(n) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`
}

/** `Scroll of <Spell>` / `Wand of <Spell>`, with an optional trailing rank such as "(3rd-rank)" or "(Rank 4)". */
function parseScrollOrWand(name) {
  const m = /^(scroll|wand) of (.+)$/i.exec(String(name || '').trim())
  if (!m) return null
  let spell = m[2].trim()
  let rank = null
  const r = /\s*\(\s*(?:rank\s+|level\s+)?(\d+)(?:st|nd|rd|th)?(?:[\s-]*(?:rank|level))?\s*\)$/i.exec(spell)
  if (r) {
    rank = Number(r[1])
    spell = spell.slice(0, r.index).trim()
  }
  if (!spell) return null
  return { family: m[1].toLowerCase(), spell, rank }
}

/** Generic item names the corpus may use for a scroll or wand of the given rank (cantrips use rank 1). */
function genericItemNames(family, rank) {
  const o = ordinal(Math.max(1, rank))
  return family === 'scroll' ? [`Scroll of ${o}-rank Spell`] : [`Magic Wand (${o}-Rank Spell)`, `Wand of ${o}-rank Spell`]
}

function createResolver({ store, cacheMax = DEFAULT_CACHE_MAX }) {
  // nameKey -> { exact: doc[], alias: doc[] | null }   (alias null: never needed, an exact match was found)
  const cache = new Map()

  function remember(key, value) {
    cache.delete(key)
    cache.set(key, value)
    while (cache.size > cacheMax) cache.delete(cache.keys().next().value)
  }

  async function fetchKeys(keys) {
    const wanted = [...new Set(keys)].filter((k) => k && !cache.has(k))
    if (!wanted.length) return
    const chunks = []
    for (let i = 0; i < wanted.length; i += CHUNK) chunks.push(wanted.slice(i, i + CHUNK))
    const exactDocs = (await Promise.all(chunks.map((c) => store.byNameKeys(c)))).flat()
    const exact = new Map(wanted.map((k) => [k, []]))
    for (const d of exactDocs) if (exact.has(d.data.nameKey)) exact.get(d.data.nameKey).push(d)
    const unmatched = wanted.filter((k) => exact.get(k).length === 0)
    const alias = new Map(unmatched.map((k) => [k, []]))
    if (unmatched.length) {
      const aChunks = []
      for (let i = 0; i < unmatched.length; i += CHUNK) aChunks.push(unmatched.slice(i, i + CHUNK))
      const aliasDocs = (await Promise.all(aChunks.map((c) => store.byAliases(c)))).flat()
      for (const d of aliasDocs) for (const a of d.data.aliases || []) if (alias.has(a)) alias.get(a).push(d)
    }
    for (const k of wanted) remember(k, { exact: exact.get(k), alias: alias.has(k) ? alias.get(k) : null })
  }

  function pick(candidates, types) {
    // SPEC: the remaster entry first, then the type hint of the export field.
    let c = candidates
    const remaster = c.filter((d) => d.data.remaster)
    if (remaster.length) c = remaster
    if (types && types.length) {
      const hinted = c.filter((d) => types.includes(d.data.type))
      if (hinted.length) c = hinted
    }
    return [...c].sort((a, b) => {
      const ta = types && types.length ? types.indexOf(a.data.type) : 0
      const tb = types && types.length ? types.indexOf(b.data.type) : 0
      return (ta < 0 ? 99 : ta) - (tb < 0 ? 99 : tb) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })[0]
  }

  /** @returns {{entry: {id, data}, via: 'exact'|'alias'} | null} */
  function resolve(name, types) {
    const hit = cache.get(nameKey(name))
    if (!hit) return null
    if (hit.exact.length) return { entry: pick(hit.exact, types), via: 'exact' }
    if (hit.alias && hit.alias.length) return { entry: pick(hit.alias, types), via: 'alias' }
    return null
  }

  function genericFor(family, rank, itemTypes) {
    for (const n of genericItemNames(family, rank)) {
      const hit = resolve(n, itemTypes)
      if (hit) return hit
    }
    return null
  }

  /** Items: exact or alias first, then `Scroll|Wand of <Spell>` through the spell and the generic item. */
  function resolveItem(name, types) {
    const direct = resolve(name, types)
    if (direct) return direct
    const sw = parseScrollOrWand(name)
    if (!sw) return null
    const spell = resolve(sw.spell, ['spell'])
    if (!spell || spell.entry.data.type !== 'spell') return null
    const rank = sw.rank !== null ? sw.rank : spell.entry.data.spell && spell.entry.data.spell.rank != null ? spell.entry.data.spell.rank : spell.entry.data.level || 1
    const generic = genericFor(sw.family, rank, types)
    if (!generic) return null
    return { entry: generic.entry, via: generic.via, linked: { name: spell.entry.data.name, rank, entry: spell.entry } }
  }

  /** @param {{name: string}[]} requests */
  async function prefetch(requests) {
    const names = requests.map((r) => r.name).filter(Boolean)
    const sw = names.map(parseScrollOrWand).filter(Boolean)
    await fetchKeys([...names, ...sw.map((s) => s.spell)].map(nameKey))
    const generics = []
    for (const s of sw) {
      const spell = resolve(s.spell, ['spell'])
      if (!spell || spell.entry.data.type !== 'spell') continue
      const rank = s.rank !== null ? s.rank : spell.entry.data.spell && spell.entry.data.spell.rank != null ? spell.entry.data.spell.rank : spell.entry.data.level || 1
      generics.push(...genericItemNames(s.family, rank))
    }
    await fetchKeys(generics.map(nameKey))
  }

  async function corpusSha() {
    const meta = await store.meta()
    return (meta && meta.sha) || 'unknown'
  }

  return { prefetch, resolve, resolveItem, corpusSha, cacheSize: () => cache.size }
}

module.exports = { createResolver, parseScrollOrWand, genericItemNames, ordinal }
