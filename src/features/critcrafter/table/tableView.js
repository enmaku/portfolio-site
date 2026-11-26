/**
 * Read-side view helpers for the Gear and Spells controls: what each row's equip, raise and usage
 * controls should show for a sheet plus table state. Pure; the screens call these and send taps to
 * the table store.
 */
import { focusMax, handsUsed, slotMax } from './tableState.js'

const find = (list, key) => (list ?? []).find((e) => e.key === key)

/** "Hands n/2" for the Weapons group header. */
export const handsLabel = (sheet, s) => `Hands ${handsUsed(sheet, s)}/2`

/** Held flag, current grip and whether a grip swap applies. */
export function weaponControl(sheet, s, key) {
  const w = find(sheet.gear?.weapons, key)
  const versatile = Number.isInteger(w?.versatile)
  return { held: s.held.includes(key), hands: s.grips[key] ?? w?.hands ?? 1, versatile }
}

export const armorControl = (s, key) => ({ worn: s.armor === key })

export function shieldControl(s, key) {
  const equipped = s.shield === key
  return { equipped, raised: equipped && s.shieldRaised, canRaise: equipped }
}

export function consumableUsage(sheet, s, key) {
  const c = find(sheet.gear?.consumables, key)
  return { used: s.consumed[key] ?? 0, max: c?.qty ?? 0 }
}

/** Slot usage for a caster rank, or null for cantrips and ranks without slots. */
export function slotUsage(sheet, s, casterKey, rank) {
  const key = `slots:${casterKey}:${rank}`
  const max = slotMax(sheet, key)
  return max > 0 ? { key, used: s.slots[key] ?? 0, max } : null
}

export const focusUsage = (sheet, s) => ({ used: s.focusUsed, max: focusMax(sheet) })
