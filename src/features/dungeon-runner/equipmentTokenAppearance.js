import { hpForEquip } from './engine/kernel.js'

/** @type {Record<string, string>} */
const SYMBOL_KEY_BY_EQUIPMENT_ID = {
  B_AXE: 'axe',
  B_CHAIN: 'armor',
  B_HAMMER: 'hammer',
  B_HEAL: 'potion',
  B_SHIELD: 'shield',
  B_TORCH: 'torch',
  M_BRACE: 'shield',
  M_HOLY: 'chalice',
  M_OMNI: 'omni',
  M_PACT: 'pact',
  M_POLY: 'poly',
  M_WALL: 'armor',
  R_ARMOR: 'armor',
  R_BUCK: 'shield',
  R_CLOAK: 'cloak',
  R_HEAL: 'potion',
  R_RING: 'ring',
  R_VORP: 'vorpal',
  W_HOLY: 'chalice',
  W_PLATE: 'armor',
  W_SHIELD: 'shield',
  W_SPEAR: 'staff',
  W_TORCH: 'torch',
  W_VORPAL: 'vorpal',
}

/**
 * @param {string} equipmentId
 * @returns {{ symbolKey: string; overlay: number | null }}
 */
export function equipmentTokenAppearance(equipmentId) {
  const symbolKey = SYMBOL_KEY_BY_EQUIPMENT_ID[equipmentId]
  if (symbolKey === undefined) {
    throw new Error(`Unknown equipment: ${equipmentId}`)
  }
  if (symbolKey === 'shield') {
    return { symbolKey, overlay: 3 }
  }
  if (symbolKey === 'armor') {
    return { symbolKey, overlay: hpForEquip(equipmentId) }
  }
  return { symbolKey, overlay: null }
}
