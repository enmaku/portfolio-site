const OMNI_EQUIPMENT_ID = 'M_OMNI'

/**
 * @param {readonly string[] | string[] | null | undefined} omnipotenceSet
 */
export function isOmnipotenceSetSpeciesUnique(omnipotenceSet) {
  const species = Array.isArray(omnipotenceSet) ? omnipotenceSet : []
  if (!species.length) return false
  return species.length === new Set(species).size
}

/**
 * @param {{ inPlayEquipmentIds?: readonly string[] | string[]; omnipotenceSet?: readonly string[] | string[] }} params
 */
export function shouldOmnipotenceSave({ inPlayEquipmentIds, omnipotenceSet }) {
  const inPlay = new Set(inPlayEquipmentIds ?? [])
  if (!inPlay.has(OMNI_EQUIPMENT_ID)) return false
  return isOmnipotenceSetSpeciesUnique(omnipotenceSet)
}
