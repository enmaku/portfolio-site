/**
 * Pure parts of the CritCrafter rules corpus ingest (see docs/critcrafter/SPEC.md "Corpus"
 * and docs/critcrafter/runbook.md). No I/O here; scripts/critcrafter-ingest.mjs does that.
 */

export const RULES_ENTRIES_COLLECTION = 'rulesEntries'
export const RULES_META_COLLECTION = 'rulesMeta'
export const RULES_META_DOC = 'current'

/** Top-level directory under packs/pf2e/ -> corpus type. */
export const PACK_TYPES = {
  feats: 'feat',
  spells: 'spell',
  actions: 'action',
  'class-features': 'classFeature',
  heritages: 'heritage',
  backgrounds: 'background',
  equipment: 'equipment',
}

export const CORPUS_TYPES = Object.values(PACK_TYPES)

/** AoN category -> corpus types an alias pair in that category may apply to. */
const AON_CATEGORY_TYPES = {
  spell: ['spell'],
  feat: ['feat', 'classFeature'],
  'class-feature': ['classFeature', 'feat'],
  action: ['action'],
  heritage: ['heritage'],
  background: ['background'],
  equipment: ['equipment'],
  weapon: ['equipment'],
  armor: ['equipment'],
  shield: ['equipment'],
}
export const AON_CATEGORIES = Object.keys(AON_CATEGORY_TYPES)

/**
 * Lookup key for names: lowercase, accents and apostrophes removed, every other run of
 * non-alphanumerics collapsed to one space. The function must use the same rule.
 */
export function nameKey(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ---- HTML cleanup -------------------------------------------------------------

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function titleWords(slug) {
  return String(slug)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/** Index of the bracket closing the one at `open`, or -1. */
function matchingBracket(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === '[') depth += 1
    else if (s[i] === ']') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function flattenDamage(inner) {
  return inner
    .split('|')[0]
    .replace(/\[([^\]]*)\]/g, (_, types) => ` ${types.replace(/,/g, ' ').trim()}`)
    .replace(/,(?=\S)/g, ', ')
    .trim()
}

function flattenCheck(inner) {
  let type = ''
  let dc = ''
  let basic = false
  for (const part of inner.split('|')) {
    const [k, ...rest] = part.split(':')
    const v = rest.join(':')
    if (part === 'basic') basic = true
    else if (k === 'dc') {
      const n = /^\d+$/.test(v) ? v : (/resolve\((\d+)\)/.exec(v)?.[1] ?? '')
      if (n) dc = `DC ${n}`
    } else if (k === 'type') type = v
    else if (!v && !type && part !== 'basic') type = part
  }
  return [dc, basic ? 'basic' : '', titleWords(type)].filter(Boolean).join(' ')
}

function flattenTemplate(inner) {
  const params = Object.fromEntries(
    inner.split('|').map((p) => {
      const [k, ...rest] = p.split(':')
      return [k, rest.join(':')]
    }),
  )
  const shape = params.type ?? 'area'
  return params.distance ? `${params.distance}-foot ${shape}` : shape
}

function flattenAtEnricher(name, inner, label) {
  if (name === 'UUID') {
    const target = inner.trim()
    const base = target.split('#')[0]
    const idx = base.lastIndexOf('.Item.')
    const fallback = idx >= 0 ? base.slice(idx + 6) : base.split('.').pop()
    return `<a data-ref="${escapeAttr(target)}">${label ?? fallback}</a>`
  }
  if (label !== undefined) return label
  if (name === 'Damage') return flattenDamage(inner)
  if (name === 'Check') return flattenCheck(inner)
  if (name === 'Template') return flattenTemplate(inner)
  if (name === 'Localize' || name === 'Embed') return ''
  return inner
}

function flattenRoll(inner, label) {
  if (label !== undefined) return label
  const text = inner.trim()
  if (!text.startsWith('/')) return text
  const [cmd, ...rest] = text.slice(1).split(/\s+/)
  if (cmd === 'act') return titleWords(rest[0] ?? '')
  return flattenDamage(rest.join(' ').split(/\s#/)[0].trim())
}

function withLabel(s, from) {
  if (s[from] !== '{') return { label: undefined, next: from }
  const end = s.indexOf('}', from)
  if (end < 0) return { label: undefined, next: from }
  return { label: s.slice(from + 1, end), next: end + 1 }
}

function flattenEnrichers(html) {
  let out = ''
  let i = 0
  while (i < html.length) {
    const ch = html[i]
    if (ch === '@') {
      const m = /^@([A-Za-z]+)\[/.exec(html.slice(i, i + 40))
      if (m) {
        const open = i + m[0].length - 1
        const close = matchingBracket(html, open)
        if (close > 0) {
          const { label, next } = withLabel(html, close + 1)
          out += flattenAtEnricher(m[1], html.slice(open + 1, close), label)
          i = next
          continue
        }
      }
    } else if (ch === '[' && html[i + 1] === '[') {
      const close = matchingBracket(html, i)
      if (close > 0 && html[close - 1] === ']') {
        const { label, next } = withLabel(html, close + 1)
        out += flattenRoll(html.slice(i + 2, close - 1), label)
        i = next
        continue
      }
    }
    out += ch
    i += 1
  }
  return out
}

/** Sanitise Foundry description HTML and neutralise its enrichers. */
export function cleanDescriptionHtml(html) {
  const sanitised = String(html ?? '')
    .replace(/<(script|style|iframe)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe)\b[^>]*>/gi, '')
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s+href\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
  return flattenEnrichers(sanitised)
}

// ---- Entries --------------------------------------------------------------------

function spellData(system) {
  const save = system.defense?.save
  const duration = String(system.duration?.value ?? '').trim()
  return {
    rank: system.level?.value ?? null,
    defense: save?.statistic ? { statistic: save.statistic, basic: Boolean(save.basic) } : null,
    duration: duration ? (system.duration?.sustained ? `sustained ${duration}` : duration) : null,
    area: system.area ? { type: system.area.type ?? null, value: system.area.value ?? null } : null,
    range: String(system.range?.value ?? '') || null,
    time: String(system.time?.value ?? '') || null,
    traditions: system.traits?.traditions ?? [],
    ritual: Boolean(system.ritual),
  }
}

/** Item facts the function needs for gear: type, grip, range, armor and shield numbers. */
function itemData(json) {
  const system = json.system ?? {}
  const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== undefined && v !== '' ? Number(v) : null)
  return {
    itemType: json.type ?? null,
    category: system.category ?? null,
    group: system.group ?? null,
    usage: system.usage?.value ?? null,
    range: num(system.range),
    acBonus: num(system.acBonus),
    dexCap: num(system.dexCap),
    hardness: num(system.hardness),
    hp: json.type === 'shield' ? num(system.hp?.max) : null,
  }
}

function buildData(type, json) {
  const system = json.system ?? {}
  const pub = system.publication
  return {
    ...(type === 'equipment' ? { item: itemData(json) } : {}),
    name: json.name,
    nameKey: nameKey(json.name),
    type,
    level: system.level?.value ?? null,
    traits: system.traits?.value ?? [],
    rarity: system.traits?.rarity ?? null,
    actionType: system.actionType?.value ?? null,
    actions: system.actions?.value ?? null,
    bulk: system.bulk?.value ?? null,
    price: system.price?.value ?? null,
    spell: type === 'spell' ? spellData(system) : null,
    description: cleanDescriptionHtml(system.description?.value ?? ''),
    aliases: [],
    license: pub.license ?? null,
    remaster: Boolean(pub.remaster),
    title: pub.title,
  }
}

/**
 * @param {{pack: string, slug: string, relPath?: string, json: object}[]} docs
 * @returns {{entries: {id: string, data: object}[], skipped: number}}
 */
export function buildEntries(docs) {
  let skipped = 0
  const groups = new Map()
  for (const doc of docs) {
    const type = PACK_TYPES[doc.pack]
    if (!type || !doc.json?.name || !doc.json.system?.publication?.title) {
      skipped += 1
      continue
    }
    const key = `${type}:${doc.slug}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...doc, type })
  }
  const entries = []
  for (const [key, group] of groups) {
    const ordered = [...group].sort((a, b) =>
      String(a.relPath ?? a.pack).localeCompare(String(b.relPath ?? b.pack)),
    )
    const seenPacks = new Map()
    for (const doc of ordered) {
      let id = key
      if (group.length > 1) {
        const n = (seenPacks.get(doc.pack) ?? 0) + 1
        seenPacks.set(doc.pack, n)
        id = `${key}-${doc.pack}${n > 1 ? `-${n}` : ''}`
      }
      entries.push({ id, data: buildData(doc.type, doc.json) })
    }
  }
  entries.sort((a, b) => a.id.localeCompare(b.id))
  return { entries, skipped }
}

// ---- Aliases --------------------------------------------------------------------

/**
 * @param {{id: string, name: string, category: string, remaster_id?: string[]}[]} legacyRows
 *   AoN docs that carry remaster_id (the legacy side).
 * @param {{id: string, name: string, category: string}[]} remasterRows the docs they point to.
 */
export function buildAliasPairs(legacyRows, remasterRows) {
  const byId = new Map(remasterRows.map((r) => [r.id, r]))
  const seen = new Set()
  const pairs = []
  for (const legacy of legacyRows) {
    for (const rid of legacy.remaster_id ?? []) {
      const target = byId.get(rid)
      if (!target || target.category !== legacy.category) continue
      if (nameKey(target.name) === nameKey(legacy.name)) continue
      const k = `${legacy.category}|${nameKey(legacy.name)}|${nameKey(target.name)}`
      if (seen.has(k)) continue
      seen.add(k)
      pairs.push({ category: legacy.category, legacyName: legacy.name, remasterName: target.name })
    }
  }
  return pairs
}

/**
 * Adds alias nameKeys to entries in place.
 * @param {{id: string, data: object}[]} entries
 * @param {{category: string, legacyName: string, remasterName: string}[]} pairs
 * @param {Record<string, {type: string, name: string}>} labels Pathbuilder label table
 */
export function applyAliases(entries, pairs, labels) {
  const add = (entry, name) => {
    const key = nameKey(name)
    if (key && key !== entry.data.nameKey && !entry.data.aliases.includes(key)) {
      entry.data.aliases.push(key)
      return true
    }
    return false
  }
  let pairAliases = 0
  for (const pair of pairs) {
    const types = AON_CATEGORY_TYPES[pair.category] ?? []
    const key = nameKey(pair.remasterName)
    let candidates = entries.filter((e) => types.includes(e.data.type) && e.data.nameKey === key)
    const remaster = candidates.filter((e) => e.data.remaster)
    if (remaster.length) candidates = remaster
    for (const entry of candidates) if (add(entry, pair.legacyName)) pairAliases += 1
  }
  const unresolvedLabels = []
  const alreadyAliasedLabels = []
  let labelAliases = 0
  for (const [label, target] of Object.entries(labels ?? {})) {
    const key = nameKey(target.name)
    const hits = entries.filter((e) => e.data.type === target.type && e.data.nameKey === key)
    if (!hits.length) unresolvedLabels.push(label)
    let added = false
    for (const entry of hits) if (add(entry, label)) {
      labelAliases += 1
      added = true
    }
    if (hits.length && !added) alreadyAliasedLabels.push(label)
  }
  for (const entry of entries) entry.data.aliases.sort()
  return { pairAliases, labelAliases, unresolvedLabels, alreadyAliasedLabels }
}

/** Console lines for the alias step; unresolved Pathbuilder labels get a WARNING line. */
export function aliasReportLines(res, pairCount) {
  const lines = [
    `  ${pairCount} AoN pairs -> ${res.pairAliases} aliases; ${res.labelAliases} Pathbuilder label aliases`,
  ]
  if (res.alreadyAliasedLabels?.length) {
    lines.push(`  Pathbuilder labels already covered by AoN pairs: ${res.alreadyAliasedLabels.join(', ')}`)
  }
  if (res.unresolvedLabels.length) {
    lines.push(`  WARNING: Pathbuilder labels with no matching entry: ${res.unresolvedLabels.join(', ')}`)
  }
  return lines
}

// ---- Diff, guard, counts, args ------------------------------------------------------

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * @param {Map<string, object>} existing id -> stored data
 * @param {{id: string, data: object}[]} next
 */
export function diffCorpus(existing, next) {
  const added = []
  const changed = []
  let unchanged = 0
  const seen = new Set()
  for (const { id, data } of next) {
    seen.add(id)
    if (!existing.has(id)) added.push(id)
    else if (stableStringify(existing.get(id)) !== stableStringify(data)) changed.push(id)
    else unchanged += 1
  }
  const deleted = [...existing.keys()].filter((id) => !seen.has(id))
  return { added: added.sort(), changed: changed.sort(), deleted: deleted.sort(), unchanged }
}

export function checkGuard({ existingCount, deleted, nextCount, threshold = 0.1 }) {
  const reasons = []
  if (existingCount > 0) {
    if (deleted > existingCount * threshold) {
      reasons.push(`would delete ${deleted} of ${existingCount} existing docs (more than 10%)`)
    }
    if (nextCount < existingCount * (1 - threshold)) {
      reasons.push(`total would drop from ${existingCount} to ${nextCount} (more than 10%)`)
    }
  }
  return { ok: reasons.length === 0, reasons }
}

export function countByType(entries) {
  const counts = {}
  for (const e of entries) counts[e.data.type] = (counts[e.data.type] ?? 0) + 1
  return counts
}

export function parseArgs(argv) {
  const args = { apply: false, force: false, packs: null, sha: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--force') args.force = true
    else if (a === '--packs' || a === '--sha') {
      const v = argv[i + 1]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
      args[a.slice(2)] = v
      i += 1
    } else throw new Error(`Unknown argument: ${a}`)
  }
  return args
}
