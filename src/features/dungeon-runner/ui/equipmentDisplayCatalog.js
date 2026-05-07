/** @type {Record<string, string>} */
const OVERRIDES = {
  W_PLATE: 'Plate Armor',
  W_SHIELD: 'Shield',
  W_VORPAL: 'Vorpal Sword',
  W_TORCH: 'Torch',
  W_HOLY: 'Holy Water',
  W_SPEAR: 'Spear',
  B_HEAL: 'Heal',
  B_SHIELD: 'Shield',
  B_CHAIN: 'Chain Mail',
  B_AXE: 'Fire Axe',
  B_TORCH: 'Torch',
  B_HAMMER: 'Hammer',
  M_WALL: 'Wall',
  M_HOLY: 'Holy',
  M_OMNI: 'Omni',
  M_BRACE: 'Brace',
  M_POLY: 'Polymorph',
  M_PACT: 'Pact',
  R_ARMOR: 'Armor',
  R_HEAL: 'Heal',
  R_RING: 'Ring',
  R_BUCK: 'Buckler',
  R_VORP: 'Vorpal',
  R_CLOAK: 'Cloak',
}

/**
 * @param {string} equipmentId
 * @returns {string}
 */
export function equipmentShortName(equipmentId) {
  return OVERRIDES[equipmentId] ?? equipmentId
}

/**
 * @param {string} equipmentId
 * @returns {string}
 */
export function sacrificeActionLabel(equipmentId) {
  return `Sacrifice ${equipmentShortName(equipmentId)}`
}
