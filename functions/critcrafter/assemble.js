'use strict'
// Sheet assembly (SPEC "Sheet format"): derived stats + resolved names -> the CritCrafter sheet.
// `assembleSheet` is synchronous: every name must already be in the resolver (see `buildSheetFor`).
const { deriveStats } = require('./derived')
const { CORE_SKILLS } = require('./derived/skills')
const { nameKey } = require('./nameKey')
const {
  cleanText, isCustomName, aonSearchUrl, rulesOf, costOf, costRank, formatPrice, bulkOf, defenseText, areaText, createKeyer, makeEntry,
} = require('./entries')
const { GROUPS, BASIC_ACTIONS, EXPLORATION_ACTIONS, SKILL_ACTIONS, HINTS } = require('./tables')

const SCHEMA_VERSION = 1

// ---- export reading ----------------------------------------------------------

const arr = (v) => (Array.isArray(v) ? v : [])
const str = (v) => (typeof v === 'string' ? v.trim() : '')

/** feats tuples are [name, option, type, level, source, ...]; tolerate 4 or 7 elements. */
function featItems(build) {
  return arr(build.feats)
    .filter((t) => Array.isArray(t) && cleanText(t[0]))
    .map((t) => ({ name: str(t[0]), option: cleanText(t[1]), featType: str(t[2]), level: Number.isInteger(t[3]) ? t[3] : null }))
}

function specialNames(build) {
  return arr(build.specials).map(cleanText).filter(Boolean)
}

function familiarAbilities(build) {
  return arr(build.familiars).flatMap((f) => (f && Array.isArray(f.abilities) ? f.abilities : [])).map(cleanText).filter(Boolean)
}

function equipmentItems(build) {
  return arr(build.equipment)
    .filter((e) => Array.isArray(e) && cleanText(e[0]))
    .map((e) => ({ name: str(e[0]), qty: Number.isInteger(e[1]) && e[1] > 0 ? e[1] : 1 }))
}

/** Every name the assembly will look up, with the corpus types the export field implies. */
function collectRequests(build) {
  const reqs = []
  const add = (name, types) => name && reqs.push({ name, types })
  for (const f of featItems(build)) add(f.name, HINTS.feat)
  for (const n of specialNames(build)) add(n, HINTS.special)
  for (const n of familiarAbilities(build)) add(n, HINTS.familiar)
  add(cleanText(build.heritage), HINTS.heritage)
  for (const e of equipmentItems(build)) add(e.name, HINTS.item)
  for (const w of arr(build.weapons)) add(str(w && w.name), HINTS.item)
  for (const a of arr(build.armor)) add(str(a && a.name), HINTS.item)
  for (const c of arr(build.spellCasters)) {
    for (const g of [...arr(c && c.spells), ...arr(c && c.prepared)]) for (const n of arr(g && g.list)) add(cleanText(n), HINTS.spell)
  }
  for (const byAbility of Object.values(build.focus || {})) {
    for (const e of Object.values(byAbility || {})) for (const n of [...arr(e && e.focusCantrips), ...arr(e && e.focusSpells)]) add(cleanText(n), HINTS.spell)
  }
  for (const n of arr(build.rituals)) add(cleanText(typeof n === 'string' ? n : n && n.name), HINTS.spell)
  const tableNames = [...BASIC_ACTIONS, ...EXPLORATION_ACTIONS, ...Object.values(SKILL_ACTIONS).flat()]
  for (const n of tableNames) add(n, ['action'])
  return reqs
}

const EMBEDDED_ACTION_REF = /data-ref="Compendium\.pf2e\.actionspf2e\.Item\.([^"#]+)"/g

/** Action names a costless feat or class feature embeds as links (Spellstrike's Spellstrike action). */
function embeddedActionNames(html) {
  const out = []
  for (const m of String(html || '').matchAll(EMBEDDED_ACTION_REF)) out.push(m[1].trim())
  return out
}

/** Names a second prefetch round needs: embedded actions of every costless matched feat or special. */
function collectEmbeddedRequests(build, resolver) {
  const names = [
    ...featItems(build).map((f) => ({ name: f.name, types: HINTS.feat })),
    ...specialNames(build).map((n) => ({ name: n, types: HINTS.special })),
  ]
  const out = []
  for (const { name, types } of names) {
    const hit = resolver.resolve(name, types)
    if (hit && !costOf(hit.entry.data)) for (const n of embeddedActionNames(hit.entry.data.description)) out.push({ name: n, types: ['action'] })
  }
  return out
}

// ---- source groups -----------------------------------------------------------

function groupOfFeatType(featType, data) {
  const t = featType.toLowerCase()
  if (t.includes('archetype')) return 'archetype'
  if (t.includes('ancestry') || t.includes('heritage')) return 'ancestry'
  if (t.includes('general') || t.includes('skill') || t.includes('awarded') || t.includes('bonus')) {
    return data && (data.traits || []).includes('archetype') ? 'archetype' : 'general'
  }
  return 'class'
}

function groupOfSpecial(data) {
  if (data.type === 'heritage') return 'ancestry'
  if (data.type === 'feat') {
    const traits = data.traits || []
    if (traits.includes('archetype')) return 'archetype'
    if (traits.includes('general') || traits.includes('skill')) return 'general'
    if (traits.includes('ancestry') || traits.includes('heritage')) return 'ancestry'
  }
  return 'class'
}

// ---- assembly ----------------------------------------------------------------

function assembleSheet(build, { resolver, corpusSha, now = () => new Date() }) {
  const derived = deriveStats(build, {
    corpus: {
      bulk: (name) => {
        const hit = resolver.resolveItem(name, HINTS.item)
        return hit ? bulkOf(hit.entry.data) : null
      },
      armor: (name) => {
        const hit = resolver.resolveItem(name, HINTS.item)
        const item = hit && hit.entry.data.item
        return item && Number.isFinite(item.acBonus) ? { acBonus: item.acBonus, dexCap: Number.isFinite(item.dexCap) ? item.dexCap : null } : null
      },
      shield: (name) => {
        const hit = resolver.resolveItem(name, HINTS.item)
        const item = hit && hit.entry.data.item
        return item && Number.isFinite(item.acBonus) ? { acBonus: item.acBonus } : null
      },
    },
  })
  const warnings = [...derived.warnings]
  const warn = (code, path, detail) => warnings.push({ code, path, detail })
  const keyFor = createKeyer()
  const unmatched = (name, path) => warn('name_unmatched', path, `No rules entry found for "${name}"`)

  const entryFor = (section, name, kind, hit, extra) => makeEntry({ key: keyFor(section, name), name, kind, hit, extra })

  // -- header, stats, skills
  const header = {
    name: str(build.name) || 'Unnamed character',
    level: Number(build.level) || 1,
    ancestry: str(build.ancestry),
    heritage: cleanText(build.heritage),
    classLine: [cleanText(build.class), cleanText(build.dualClass)].filter(Boolean).join(' / '),
    background: cleanText(build.background),
    deity: cleanText(build.deity),
    size: cleanText(build.sizeName),
    languages: arr(build.languages).map(cleanText).filter(Boolean),
    hp: derived.hp,
    perception: derived.perception,
    speed: derived.speed,
    unarmoredAc: derived.unarmoredAc,
  }
  const stats = {
    abilities: derived.abilities,
    saves: derived.saves,
    classDc: derived.classDc,
  }

  // -- actions and features from feats, specials, heritage, familiars and the fixed tables
  const actionGroups = new Map(GROUPS.map((g) => [g.id, []]))
  const featureGroups = new Map(GROUPS.map((g) => [g.id, []]))
  const seenKeys = new Set()

  function place(groupId, entry, hit, { passiveOnly = false } = {}) {
    if (!passiveOnly && entry.cost) actionGroups.get(groupId).push(entry)
    else featureGroups.get(groupId).push({ ...entry, cost: null })
    if (hit && !entry.cost) {
      for (const refName of embeddedActionNames(hit.entry.data.description)) {
        const target = resolver.resolve(refName, ['action'])
        const targetKey = target && nameKey(target.entry.data.name)
        if (!target || !costOf(target.entry.data) || BASIC_ACTIONS.some((b) => nameKey(b) === targetKey)) continue
        if (seenKeys.has(`embedded:${groupId}:${targetKey}`)) continue
        seenKeys.add(`embedded:${groupId}:${targetKey}`)
        actionGroups.get(groupId).push(entryFor('actions', target.entry.data.name, 'action', target))
      }
    }
  }

  const featNames = new Set()
  const merged = new Map()
  for (const f of featItems(build)) {
    const k = `${nameKey(f.name)}|${f.option || ''}|${groupOfFeatType(f.featType, null)}`
    if (merged.has(k)) merged.get(k).count += 1
    else merged.set(k, { ...f, count: 1 })
    featNames.add(nameKey(f.name))
  }
  let featIndex = 0
  for (const f of merged.values()) {
    const hit = resolver.resolve(f.name, HINTS.feat)
    if (!hit) unmatched(f.name, `features[feat ${featIndex}]`)
    featIndex += 1
    const group = groupOfFeatType(f.featType, hit && hit.entry.data)
    const entry = makeEntry({ key: keyFor('feats', f.name), name: f.name, kind: 'feat', hit, option: f.option, count: f.count })
    if (!entry.level && f.level !== null) entry.level = f.level
    place(group, entry, hit)
  }

  const seenSpecial = new Set(featNames)
  const heritageName = cleanText(build.heritage)
  if (heritageName && !featNames.has(nameKey(heritageName))) {
    seenSpecial.add(nameKey(heritageName))
    const hit = resolver.resolve(heritageName, HINTS.heritage)
    if (hit) place('ancestry', makeEntry({ key: keyFor('features', heritageName), name: heritageName, kind: 'feature', hit }), hit)
  }
  for (const name of specialNames(build)) {
    const k = nameKey(name)
    if (seenSpecial.has(k)) continue
    seenSpecial.add(k)
    const hit = resolver.resolve(name, HINTS.special)
    if (!hit) continue // framework specials, stray tokens and custom content are dropped
    place(groupOfSpecial(hit.entry.data), makeEntry({ key: keyFor('features', name), name, kind: 'feature', hit }), hit)
  }

  const familiarSeen = new Set()
  for (const name of familiarAbilities(build)) {
    if (familiarSeen.has(nameKey(name))) continue
    familiarSeen.add(nameKey(name))
    const hit = resolver.resolve(name, HINTS.familiar)
    if (!hit) unmatched(name, 'actions.familiar')
    actionGroups.get('familiar').push(makeEntry({ key: keyFor('actions', name), name, kind: 'action', hit }))
  }
  for (const [i, f] of arr(build.familiars).entries()) {
    if (!f || !Array.isArray(f.abilities)) warn('familiar_unparsed', `actions.familiar[${i}]`, 'A familiar without an ability list was skipped')
  }

  const actionByName = new Map()
  const tableEntry = (name) => {
    const hit = resolver.resolve(name, ['action'])
    return hit ? { hit, name: hit.entry.data.name } : null
  }
  const addTable = (groupId, names) => {
    for (const n of names) {
      const t = tableEntry(n)
      if (!t) continue
      const k = nameKey(t.name)
      if (actionByName.has(k)) continue
      const entry = entryFor('actions', t.name, 'action', t.hit)
      actionByName.set(k, entry)
      actionGroups.get(groupId).push(entry)
    }
  }
  // Names already placed by feats must not repeat in the fixed groups.
  for (const g of actionGroups.values()) for (const e of g) actionByName.set(nameKey(e.name), e)
  addTable('basic', BASIC_ACTIONS)
  addTable('exploration', EXPLORATION_ACTIONS)
  addTable('skill', [...new Set(CORE_SKILLS.flatMap(([id]) => SKILL_ACTIONS[id] || []))])

  const sortActions = (entries) => entries.map((e, i) => [e, i]).sort((a, b) => costRank(a[0].cost) - costRank(b[0].cost) || a[1] - b[1]).map(([e]) => e)
  const sortFeatures = (entries) => entries.map((e, i) => [e, i]).sort((a, b) => (a[0].level || 0) - (b[0].level || 0) || a[1] - b[1]).map(([e]) => e)
  const grouped = (map, sorter) => ({
    groups: GROUPS.filter((g) => map.get(g.id).length).map((g) => ({ id: g.id, label: g.label, defaultOpen: g.defaultOpen, entries: sorter(map.get(g.id)) })),
  })

  const skills = derived.skills.map((s) => {
    if (s.lore) return s
    const id = CORE_SKILLS.find(([, name]) => name === s.name)[0]
    const linked = (SKILL_ACTIONS[id] || []).map((n) => tableEntry(n)).filter(Boolean)
    if (!linked.length) return s
    const sectionKeyer = createKeyer()
    const actions = linked.map((t) => makeEntry({ key: sectionKeyer(`skillactions:${id}`, t.name), name: t.name, kind: 'action', hit: t.hit }))
    return { ...s, bonus: { ...s.bonus, actions: sortActions(actions) } }
  })

  // -- gear
  const itemHit = (name) => resolver.resolveItem(name, HINTS.item)
  const gearExtra = (hit, qty) => ({ qty, bulk: hit ? bulkOf(hit.entry.data) : null, price: hit ? formatPrice(hit.entry.data.price) : null })
  const linkedOf = (hit) =>
    hit && hit.linked
      ? {
          linked: [
            {
              role: 'spell',
              name: hit.linked.name,
              rank: hit.linked.rank,
              traits: [...(hit.linked.entry.data.traits || [])],
              cost: costOf(hit.linked.entry.data),
              rules: rulesOf(hit.linked.entry.data),
            },
          ],
        }
      : {}
  const gearEntry = (section, name, kind, hit, qty, extra = {}) =>
    entryFor(section, name, kind, hit, { ...gearExtra(hit, qty), ...linkedOf(hit), ...extra })

  const weapons = derived.weapons.map((w) => {
    const hit = itemHit(w.name)
    if (!hit) unmatched(w.name, `gear.weapons[${w.index}]`)
    const data = hit ? hit.entry.data : null
    const item = (data && data.item) || {}
    const traits = (data && data.traits) || []
    const thrown = traits.map((t) => /^thrown-(\d+)$/.exec(t)).find(Boolean)
    const ranged = Number.isFinite(item.range) && item.range > 0
    if (!hit) warn('weapon_hands_assumed', `gear.weapons[${w.index}].hands`, `Hands for "${w.name}" are unknown; one hand assumed`)
    const twoHandTrait = traits.some((t) => /^two-hand-/.test(t))
    return gearEntry('weapons', w.name, 'weapon', hit, w.qty, {
      hands: item.usage === 'held-in-two-hands' ? 2 : 1,
      versatile: twoHandTrait ? 2 : null,
      attack: w.attack,
      damage: w.damage,
      range: ranged ? item.range : thrown ? Number(thrown[1]) : null,
      reach: hit && (!ranged || thrown) ? (traits.includes('reach') ? 10 : 5) : null,
    })
  })

  const armor = derived.armor.map((a) => {
    const hit = itemHit(a.name)
    if (!hit) unmatched(a.name, `gear.armor[${a.index}]`)
    return gearEntry('armor', a.name, 'armor', hit, a.qty, {
      acTotal: a.acTotal || null, // null = unknown (no AC data); never a stand-in number
      wornInExport: a.wornInExport,
    })
  })

  const shields = derived.shields.map((s) => {
    const hit = itemHit(s.name)
    if (!hit) unmatched(s.name, `gear.shields[${s.index}]`)
    const item = (hit && hit.entry.data.item) || {}
    const hp = Number.isFinite(item.hp) ? item.hp : null
    return gearEntry('shields', s.name, 'shield', hit, s.qty, {
      acBonus: s.acBonus || null,
      hands: 1,
      buckler: /\bbuckler\b/i.test(s.name),
      hardness: Number.isFinite(item.hardness) ? item.hardness : null,
      hp,
      bt: hp === null ? null : Math.floor(hp / 2),
      wornInExport: s.wornInExport,
    })
  })

  const consumables = []
  const gearItems = []
  for (const [i, e] of equipmentItems(build).entries()) {
    const hit = itemHit(e.name)
    if (!hit) unmatched(e.name, `gear.gear[${i}]`)
    const isConsumable = hit && hit.entry.data.item && hit.entry.data.item.itemType === 'consumable'
    if (isConsumable) consumables.push(gearEntry('consumables', e.name, 'consumable', hit, e.qty))
    else gearItems.push(gearEntry('gear', e.name, 'equipment', hit, e.qty))
  }

  const gear = { bulk: derived.bulk, weapons, shields, armor, consumables, gear: gearItems }

  // -- spells
  const spellEntry = (section, name, hit, rank, kind = 'spell', count) => {
    const data = hit ? hit.entry.data : null
    const sp = (data && data.spell) || {}
    const finalRank = Number.isInteger(rank) ? rank : Number.isInteger(sp.rank) ? sp.rank : 0
    return makeEntry({
      key: keyFor(section, name),
      name,
      kind,
      hit,
      count,
      extra: {
        rank: finalRank,
        defense: defenseText(sp.defense),
        range: sp.range || null,
        area: areaText(sp.area),
        duration: sp.duration || null,
      },
    })
  }
  const resolveSpell = (name, path) => {
    const hit = resolver.resolve(name, HINTS.spell)
    if (!hit) unmatched(name, path)
    return hit
  }

  const casters = []
  derived.casters.forEach((c, ci) => {
    const ranks = c.ranks
      .map((r) => ({
        rank: r.rank,
        entries: r.names.map((n) => spellEntry('spells', n.name, resolveSpell(n.name, `spells.casters[${ci}]`), r.rank, 'spell', n.count)),
      }))
      .filter((r) => r.entries.length)
    if (!ranks.length && !Object.keys(c.slots).length) {
      warn('caster_dropped', `spells.casters[${ci}]`, `"${c.name}" has no spells or slots and was dropped`)
      return
    }
    casters.push({ key: c.key, name: c.name, tradition: c.tradition, kind: c.kind, attack: c.attack, dc: c.dc, slots: c.slots, ranks })
  })

  let focus = null
  if (derived.focus) {
    const f = derived.focus
    focus = {
      pool: f.pool,
      attack: f.attack,
      dc: f.dc,
      cantrips: f.cantrips.map((n) => spellEntry('focus', n, resolveSpell(n, 'spells.focus'), 0)),
      spells: f.spells.map((n) => spellEntry('focus', n, resolveSpell(n, 'spells.focus'))),
    }
  }
  const rituals = arr(build.rituals)
    .map((r) => cleanText(typeof r === 'string' ? r : r && r.name))
    .filter(Boolean)
    .map((n) => spellEntry('rituals', n, resolveSpell(n, 'spells.rituals'), undefined, 'ritual'))

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now().toISOString(),
    corpus: { sha: corpusSha },
    warnings,
    header,
    stats,
    skills,
    gear,
    spells: { casters, focus, rituals },
    actions: grouped(actionGroups, sortActions),
    features: grouped(featureGroups, sortFeatures),
  }
}

/** Prefetch everything the assembly needs, then assemble. */
async function buildSheetFor(build, { resolver, now }) {
  await resolver.prefetch(collectRequests(build))
  await resolver.prefetch(collectEmbeddedRequests(build, resolver))
  return assembleSheet(build, { resolver, corpusSha: await resolver.corpusSha(), now })
}

module.exports = { assembleSheet, buildSheetFor, collectRequests, SCHEMA_VERSION, aonSearchUrl, isCustomName }
