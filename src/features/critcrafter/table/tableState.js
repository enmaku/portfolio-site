/**
 * CritCrafter table state: the pure rules behind the viewer's tracking (live AC, hands limit, HP,
 * temp HP, shield HP, usage boxes, rests). No Vue, no storage; the Pinia store wraps these.
 *
 * Every function takes the sheet and a table state and returns a new state (mutators that can
 * explain themselves return `{ state, notes }`, notes being short toast strings). The sheet stays
 * the source of truth: `toStored` keeps only deltas from `initialState(sheet)`, and `resolveState`
 * clamps whatever was stored to the sheet's current maxima, silently, ignoring unknown keys.
 *
 * @typedef {{
 *   hp: number, tempHp: number, focusUsed: number,
 *   slots: Record<string, number>, consumed: Record<string, number>,
 *   held: string[], grips: Record<string, number>,
 *   armor: string | null, shield: string | null, shieldRaised: boolean,
 *   shieldHp: Record<string, number>,
 * }} TableState
 */

const HANDS = 2

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const int = (v, fallback) => (Number.isFinite(v) ? Math.trunc(v) : fallback)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

const weapons = (sheet) => sheet.gear?.weapons ?? []
const shields = (sheet) => sheet.gear?.shields ?? []
const armors = (sheet) => sheet.gear?.armor ?? []
const consumables = (sheet) => sheet.gear?.consumables ?? []
const byKey = (list, key) => list.find((e) => e.key === key)

export const maxHp = (sheet) => sheet.header.hp.value
export const focusMax = (sheet) => sheet.spells?.focus?.pool ?? 0

/** Max slots for a usage key `slots:<casterKey>:<rank>`; 0 when the sheet has no such pool. */
export function slotMax(sheet, key) {
  if (typeof key !== 'string' || !key.startsWith('slots:')) return 0
  const cut = key.lastIndexOf(':')
  const casterKey = key.slice('slots:'.length, cut)
  const rank = key.slice(cut + 1)
  const caster = (sheet.spells?.casters ?? []).find((c) => c.key === casterKey)
  const n = caster?.slots?.[rank]
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function conMod(sheet) {
  return sheet.stats?.abilities?.find((a) => a.id === 'con')?.mod ?? 0
}

/** Initial state: full HP, nothing used, equipment as the export carried it. */
export function initialState(sheet) {
  const worn = armors(sheet).find((a) => a.wornInExport)
  const shield = shields(sheet).find((s) => s.wornInExport)
  return {
    hp: maxHp(sheet),
    tempHp: 0,
    focusUsed: 0,
    slots: {},
    consumed: {},
    // Pathbuilder exports carry no held state for weapons, so none starts in hand (SPEC: equipment as exported).
    held: [],
    grips: {},
    armor: worn ? worn.key : null,
    shield: shield ? shield.key : null,
    shieldRaised: false,
    shieldHp: {},
  }
}

// --- hands ---------------------------------------------------------------------------------

function weaponHands(sheet, s, key) {
  const w = byKey(weapons(sheet), key)
  if (!w) return 0
  return s.grips[key] ?? w.hands
}

function shieldHands(sheet, s) {
  const sh = s.shield ? byKey(shields(sheet), s.shield) : null
  if (!sh) return 0
  return sh.buckler && !s.shieldRaised ? 0 : sh.hands
}

/** Hands in use: held weapons at their current grip plus the shield (a buckler only while raised). */
export function handsUsed(sheet, s) {
  return s.held.reduce((n, k) => n + weaponHands(sheet, s, k), 0) + shieldHands(sheet, s)
}

const nameOf = (list, key) => byKey(list, key)?.name ?? key

/** Put weapons away, earliest first, until the hands fit. `keep` is never dropped. */
function dropWeapons(sheet, s, keep, notes) {
  const held = [...s.held]
  for (const k of s.held) {
    if (handsUsed(sheet, { ...s, held }) <= HANDS) break
    if (k === keep) continue
    held.splice(held.indexOf(k), 1)
    notes.push(`Put away ${nameOf(weapons(sheet), k)}`)
  }
  return { ...s, held }
}

/** Last resort: the shield goes (a buckler is only lowered). */
function dropShield(sheet, s, notes) {
  if (handsUsed(sheet, s) <= HANDS || !s.shield) return s
  const sh = byKey(shields(sheet), s.shield)
  if (sh?.buckler) {
    notes.push(`Lowered ${sh.name}`)
    return { ...s, shieldRaised: false }
  }
  notes.push(`Unequipped ${nameOf(shields(sheet), s.shield)}`)
  return { ...s, shield: null, shieldRaised: false }
}

/** Fit hands after a weapon change: other weapons first, then the shield. */
function fitForWeapon(sheet, s, keep, notes) {
  return dropShield(sheet, dropWeapons(sheet, s, keep, notes), notes)
}

const weaponOrder = (sheet, held) => {
  const order = weapons(sheet).map((w) => w.key)
  return [...held].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// --- normalisation and storage ---------------------------------------------------------------

/** Strip zeroed entries, redundant grips and full shield HP so equal states compare equal. */
function normalize(sheet, s) {
  const out = { ...s, slots: {}, consumed: {}, grips: {}, shieldHp: {} }
  for (const [k, n] of Object.entries(s.slots)) if (n > 0) out.slots[k] = n
  for (const [k, n] of Object.entries(s.consumed)) if (n > 0) out.consumed[k] = n
  for (const [k, g] of Object.entries(s.grips)) {
    const w = byKey(weapons(sheet), k)
    if (w && g !== w.hands && g === w.versatile) out.grips[k] = g
  }
  for (const [k, n] of Object.entries(s.shieldHp)) {
    const sh = byKey(shields(sheet), k)
    if (sh && sh.hp != null && n < sh.hp) out.shieldHp[k] = n
  }
  out.held = weaponOrder(sheet, s.held)
  return out
}

/**
 * Turn whatever was stored into a valid state for this sheet: unknown keys ignored, values clamped
 * to the sheet's maxima, hands limit re-enforced. Never throws, never reports.
 */
export function resolveState(sheet, stored) {
  const base = initialState(sheet)
  if (!isObj(stored)) return base
  const s = { ...base }
  const max = maxHp(sheet)

  s.hp = 'hp' in stored ? clamp(int(stored.hp, max), 0, max) : max
  s.tempHp = Math.max(0, int(stored.tempHp, 0))
  s.focusUsed = clamp(int(stored.focusUsed, 0), 0, focusMax(sheet))

  if (isObj(stored.slots)) {
    for (const [k, n] of Object.entries(stored.slots)) {
      const m = slotMax(sheet, k)
      if (m > 0) s.slots[k] = clamp(int(n, 0), 0, m)
    }
  }
  if (isObj(stored.consumed)) {
    for (const c of consumables(sheet)) {
      if (c.key in stored.consumed) s.consumed[c.key] = clamp(int(stored.consumed[c.key], 0), 0, c.qty)
    }
  }
  if (Array.isArray(stored.held)) {
    s.held = stored.held.filter((k, i, a) => byKey(weapons(sheet), k) && a.indexOf(k) === i)
  }
  if (isObj(stored.grips)) {
    for (const [k, g] of Object.entries(stored.grips)) {
      const w = byKey(weapons(sheet), k)
      if (w && g === w.versatile) s.grips[k] = g
    }
  }
  if ('armor' in stored) s.armor = byKey(armors(sheet), stored.armor) ? stored.armor : null
  if ('shield' in stored) s.shield = byKey(shields(sheet), stored.shield) ? stored.shield : null
  s.shieldRaised = stored.shieldRaised === true && s.shield !== null
  if (isObj(stored.shieldHp)) {
    for (const sh of shields(sheet)) {
      if (sh.hp != null && sh.key in stored.shieldHp) s.shieldHp[sh.key] = clamp(int(stored.shieldHp[sh.key], sh.hp), 0, sh.hp)
    }
  }

  const notes = []
  return normalize(sheet, fitForWeapon(sheet, normalize(sheet, s), null, notes))
}

/** Deltas from the sheet's defaults, ready for JSON. `{}` for a pristine character. */
export function toStored(sheet, s) {
  const def = initialState(sheet)
  const out = {}
  for (const k of Object.keys(def)) {
    if (JSON.stringify(s[k]) !== JSON.stringify(def[k])) out[k] = s[k]
  }
  return out
}

// --- live AC -------------------------------------------------------------------------------

/**
 * Live AC as a stat: (worn armor acTotal, else unarmored AC) + (shield raised ? shield acBonus : 0).
 * The breakdown is current state only, so it always sums to the value.
 */
export function liveAc(sheet, s) {
  const armor = s.armor ? byKey(armors(sheet), s.armor) : null
  // Unknown armor AC (null) changes nothing: fall back to the unarmored value.
  const base = armor?.acTotal ?? sheet.header.unarmoredAc
  const breakdown = base.breakdown.map((b) => ({ ...b }))
  let value = base.value
  const sh = s.shieldRaised && s.shield ? byKey(shields(sheet), s.shield) : null
  if (sh?.acBonus) {
    value += sh.acBonus.value
    breakdown.push({ label: 'Shield raised', amount: sh.acBonus.value, type: 'circumstance' })
  }
  return { value, breakdown }
}

// --- equipment ---------------------------------------------------------------------------------

const result = (sheet, state, notes = []) => ({ state: normalize(sheet, state), notes })

/** Wear or take off body armor; one at a time. */
export function toggleArmor(sheet, s, key) {
  if (!byKey(armors(sheet), key)) return result(sheet, s)
  return result(sheet, { ...s, armor: s.armor === key ? null : key })
}

/** Hold or put away a weapon; holding drops other weapons (earliest first), then the shield. */
export function toggleWeapon(sheet, s, key) {
  if (!byKey(weapons(sheet), key)) return result(sheet, s)
  if (s.held.includes(key)) return result(sheet, { ...s, held: s.held.filter((k) => k !== key) })
  const notes = []
  const next = fitForWeapon(sheet, { ...s, held: [...s.held, key] }, key, notes)
  return result(sheet, next, notes)
}

/** Switch a versatile weapon between its grips. Widening drops other weapons, then the shield. */
export function toggleGrip(sheet, s, key) {
  const w = byKey(weapons(sheet), key)
  if (!w || !Number.isInteger(w.versatile)) return result(sheet, s)
  const grips = { ...s.grips }
  if (grips[key] === w.versatile) delete grips[key]
  else grips[key] = w.versatile
  const next = { ...s, grips }
  if (!s.held.includes(key) || weaponHands(sheet, next, key) <= weaponHands(sheet, s, key)) return result(sheet, next)
  const notes = []
  return result(sheet, fitForWeapon(sheet, next, key, notes), notes)
}

/** Equip or unequip a shield (one at a time). Equipping puts weapons away until it fits. */
export function toggleShield(sheet, s, key) {
  if (!byKey(shields(sheet), key)) return result(sheet, s)
  if (s.shield === key) return result(sheet, { ...s, shield: null, shieldRaised: false })
  const notes = []
  return result(sheet, dropWeapons(sheet, { ...s, shield: key, shieldRaised: false }, null, notes), notes)
}

/** Raise or lower the equipped shield. Raising puts weapons away until it fits. */
export function setShieldRaised(sheet, s, raised) {
  if (!s.shield) return result(sheet, { ...s, shieldRaised: false })
  if (!raised) return result(sheet, { ...s, shieldRaised: false })
  const notes = []
  return result(sheet, dropWeapons(sheet, { ...s, shieldRaised: true }, null, notes), notes)
}

// --- shield view -----------------------------------------------------------------------------

/** Everything the shield row shows, or null when no shield is equipped. */
export function shieldView(sheet, s) {
  const sh = s.shield ? byKey(shields(sheet), s.shield) : null
  if (!sh) return null
  const hp = s.shieldHp[sh.key] ?? sh.hp ?? null
  return {
    key: sh.key,
    name: sh.name,
    raised: s.shieldRaised,
    buckler: sh.buckler,
    acBonus: sh.acBonus?.value ?? null,
    hardness: sh.hardness ?? null,
    hp,
    max: sh.hp ?? null,
    bt: sh.bt ?? null,
    broken: hp !== null && sh.bt != null && hp <= sh.bt,
  }
}

// --- HP ----------------------------------------------------------------------------------------

/**
 * @param {'damage' | 'heal' | 'temp' | 'shieldDamage' | 'shieldRepair'} mode
 * Shield modes only apply while the shield is raised. Non-positive or non-numeric amounts do nothing.
 */
export function applyHp(sheet, s, mode, amount) {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? Math.trunc(amount) : 0
  if (n <= 0) return result(sheet, s)
  const max = maxHp(sheet)
  if (mode === 'damage') {
    const absorbed = Math.min(s.tempHp, n)
    return result(sheet, { ...s, tempHp: s.tempHp - absorbed, hp: Math.max(0, s.hp - (n - absorbed)) })
  }
  if (mode === 'heal') return result(sheet, { ...s, hp: Math.min(max, s.hp + n) })
  if (mode === 'temp') return result(sheet, { ...s, tempHp: Math.max(s.tempHp, n) })
  if (mode === 'shieldDamage' || mode === 'shieldRepair') {
    const v = s.shieldRaised ? shieldView(sheet, s) : null
    if (!v || v.max === null) return result(sheet, s)
    const hp = mode === 'shieldDamage' ? Math.max(0, v.hp - n) : Math.min(v.max, v.hp + n)
    return result(sheet, { ...s, shieldHp: { ...s.shieldHp, [v.key]: hp } })
  }
  return result(sheet, s)
}

// --- usage boxes -------------------------------------------------------------------------------

const next = (used, max) => (used >= max ? 0 : used + 1)

/** Tap-to-cycle a slot pool: 0..n used, then back to 0. */
export function cycleSlot(sheet, s, key) {
  const m = slotMax(sheet, key)
  if (m <= 0) return s
  return normalize(sheet, { ...s, slots: { ...s.slots, [key]: next(s.slots[key] ?? 0, m) } })
}

export function cycleFocus(sheet, s) {
  const m = focusMax(sheet)
  if (m <= 0) return s
  return normalize(sheet, { ...s, focusUsed: next(s.focusUsed, m) })
}

export function cycleConsumable(sheet, s, key) {
  const c = byKey(consumables(sheet), key)
  if (!c) return s
  return normalize(sheet, { ...s, consumed: { ...s.consumed, [key]: next(s.consumed[key] ?? 0, c.qty) } })
}

// --- rests -------------------------------------------------------------------------------------

/**
 * @param {'refocus' | '8h' | '24h' | 'extended'} kind
 * Refocus: +1 focus. 8 h: Con mod + 1 HP (at least 1). 24 h: twice that. Extended: full HP.
 * 8 h or longer refills slots and focus and clears temp HP. Never touches shields or consumables.
 */
export function rest(sheet, s, kind) {
  if (kind === 'refocus') return { ...s, focusUsed: Math.max(0, s.focusUsed - 1) }
  const perNight = Math.max(1, conMod(sheet) + 1)
  const max = maxHp(sheet)
  let hp
  if (kind === '8h') hp = s.hp + perNight
  else if (kind === '24h') hp = s.hp + 2 * perNight
  else if (kind === 'extended') hp = max
  else return s
  return normalize(sheet, { ...s, hp: Math.min(max, hp), tempHp: 0, focusUsed: 0, slots: {} })
}
