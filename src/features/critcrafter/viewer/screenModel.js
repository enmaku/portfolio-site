/**
 * Pure view-model helpers for the Skills, Gear, Spells and Actions screens (#503).
 * No sheet maths here: only grouping, ordering, hiding and formatting of values the sheet already carries.
 */

const RANKS = ['U', 'T', 'E', 'M', 'L']
const GLYPH_BY_COUNT = { 1: 'single', 2: 'two', 3: 'three' }

/** @param {number} n */
export function signed(n) {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`
}

/** The full U T E M L ladder with the current rank flagged. @param {string} rank */
export function rankLadder(rank) {
  return RANKS.map((r) => ({ rank: r, current: r === rank }))
}

/**
 * Glyph keys for a cost, or null when no glyph applies (no cost, or a time cost, which shows its label).
 * A range such as 1 to 3 is ['single', 'to', 'three'].
 * @param {{ kind: string|null, min?: number, max?: number }|null|undefined} cost
 * @returns {string[]|null}
 */
export function costGlyphs(cost) {
  if (!cost) return null
  if (cost.kind === 'reaction') return ['reaction']
  if (cost.kind === 'free') return ['free']
  if (cost.kind !== 'actions') return null
  const min = GLYPH_BY_COUNT[cost.min]
  const max = GLYPH_BY_COUNT[cost.max ?? cost.min]
  if (!min) return null
  return !max || max === min ? [min] : [min, 'to', max]
}

/** Sort rank for a cost: free, 1, 2, 3, reaction, then time, then cost-less. */
export function costSortKey(cost) {
  if (!cost) return 6
  if (cost.kind === 'free') return 0
  if (cost.kind === 'actions') return cost.min ?? 3
  if (cost.kind === 'reaction') return 4
  if (cost.kind === 'time') return 5
  return 6
}

/** Text shown in place of a glyph (time costs). */
export function costLabel(cost) {
  return cost?.kind === 'time' && cost.label ? cost.label : ''
}

/**
 * Action source groups in sheet order, entries sorted by cost (stable), empty groups omitted.
 * @param {{ groups: any[] }} actions
 */
export function actionGroupsView(actions) {
  return (actions?.groups ?? [])
    .filter((g) => g.entries?.length > 0)
    .map((g, i) => ({
      id: g.id,
      label: g.label,
      defaultOpen: g.defaultOpen ?? i < 5,
      entries: [...g.entries].sort((a, b) => costSortKey(a.cost) - costSortKey(b.cost)),
    }))
}

const GEAR_GROUPS = [
  ['weapons', 'Weapons'],
  ['shields', 'Shields'],
  ['armor', 'Armor'],
  ['consumables', 'Consumables'],
  ['gear', 'Gear'],
]

/** Non-empty gear groups in display order, each with a row count. @param {any} gear */
export function gearGroupsView(gear) {
  return GEAR_GROUPS.map(([id, label]) => ({ id, label, entries: gear?.[id] ?? [] }))
    .filter((g) => g.entries.length > 0)
    .map((g) => ({ ...g, count: g.entries.length }))
}

/** "Bulk n / limit": the limit is where the character becomes encumbered. @param {{ value: number, encumberedAt: number }} bulk */
export function bulkLine(bulk) {
  return `Bulk ${bulk.value} / ${bulk.encumberedAt}`
}

/** Weapon damage chip text, e.g. "1d8+4". @param {any} w */
export function damageText(w) {
  const b = w.damage.bonus.value
  return `${w.damage.dice}${b === 0 ? '' : b < 0 ? `−${Math.abs(b)}` : `+${b}`}`
}

const rankLabel = (rank) => (rank === 0 ? 'Cantrips' : `Rank ${rank}`)

/**
 * Spells screen sections: per caster then rank (cantrips first), one Focus section across casters,
 * Rituals last. Empty ranks, casters, focus and rituals are dropped.
 * @param {any} spells
 */
export function spellsView(spells) {
  const casters = (spells?.casters ?? [])
    .map((c) => ({
      key: c.key,
      name: c.name,
      tradition: c.tradition,
      kind: c.kind,
      attack: c.attack,
      dc: c.dc,
      ranks: [...(c.ranks ?? [])]
        .filter((r) => r.entries?.length > 0)
        .sort((a, b) => a.rank - b.rank)
        .map((r) => ({
          rank: r.rank,
          label: rankLabel(r.rank),
          slots: r.rank === 0 ? null : (c.slots?.[r.rank] ?? null),
          entries: r.entries,
        })),
    }))
    .filter((c) => c.ranks.length > 0)
  const f = spells?.focus
  const focusEntries = f ? [...f.cantrips, ...f.spells] : []
  const focus = f && (focusEntries.length > 0 || f.pool > 0) ? { pool: f.pool, attack: f.attack, dc: f.dc, entries: focusEntries } : null
  return { casters, focus, rituals: spells?.rituals ?? [] }
}
