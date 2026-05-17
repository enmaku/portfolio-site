import { equipment } from './data/gameDataCatalog.js'
import { hpForEquip } from './engine/kernel.js'

/**
 * @param {string} equipmentId
 * @returns {{ symbolKey: string; overlay: number | null }}
 */
export function equipmentTokenAppearance(equipmentId) {
  const symbolKey = equipment[equipmentId]?.ui.symbolKey
  if (symbolKey === undefined) {
    throw new Error(`Unknown equipment: ${equipmentId}`)
  }
  if (symbolKey === 'shield') {
    return { symbolKey, overlay: hpForEquip(equipmentId) }
  }
  if (symbolKey === 'armor') {
    return { symbolKey, overlay: hpForEquip(equipmentId) }
  }
  return { symbolKey, overlay: null }
}
