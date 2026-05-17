import { ACTION_TYPES } from '../engine/kernel.js'
import { equipment, getEquipmentShortName } from '../data/gameDataCatalog.js'

/**
 * @param {string} equipmentId
 */
function equipmentInteractionSpec(equipmentId) {
  const entry = equipment[equipmentId]
  if (!entry) return null
  return {
    label: entry.ui.label,
    details: entry.ui.details,
    useActionType: entry.rules.useActionType,
    declineActionType: entry.rules.declineActionType,
  }
}

function hasAction(legalActions, type) {
  return legalActions.some((action) => action.type === type)
}

export function buildDungeonEquipmentTokenView({ inPlayEquipmentIds = [], legalActions = [] }) {
  return inPlayEquipmentIds.map((equipmentId) => {
    const spec = equipmentInteractionSpec(equipmentId)
    const canUseNow = !!spec?.useActionType && hasAction(legalActions, spec.useActionType)
    return {
      equipmentId,
      label: spec?.label ?? getEquipmentShortName(equipmentId),
      details: spec?.details ?? '',
      canUseNow,
      glow: canUseNow,
      hasModal: true,
    }
  })
}

export function createDungeonEquipmentModalView({ equipmentId, legalActions = [] }) {
  const spec = equipmentInteractionSpec(equipmentId)
  if (!spec) {
    return {
      equipmentId,
      title: getEquipmentShortName(equipmentId),
      details: 'No additional effect text available.',
      showUseButton: false,
      useAction: null,
      continueAction: null,
    }
  }
  const showUseButton = spec.useActionType != null && hasAction(legalActions, spec.useActionType)
  const hasDecline =
    spec.declineActionType != null && hasAction(legalActions, spec.declineActionType)
  return {
    equipmentId,
    title: spec.label,
    details: spec.details,
    showUseButton,
    useAction: showUseButton ? { type: spec.useActionType } : null,
    continueAction: hasDecline ? { type: spec.declineActionType } : null,
  }
}

export function pickAutoResolveDungeonAction({ legalActions = [] }) {
  if (legalActions.length !== 1) return null
  const [action] = legalActions
  if (action.type === 'REVEAL_OR_CONTINUE') return { ...action }
  return null
}

const DUNGEON_EQUIPMENT_MODAL_ACTION_TYPES = new Set([
  ACTION_TYPES.USE_FIRE_AXE,
  ACTION_TYPES.USE_POLYMORPH,
])

/**
 * @param {{ phase: string | null | undefined, legalActions: Array<{ type: string }> }} input
 * @returns {Array<{ type: string }>}
 */
export function filterVisibleLegalActions({ phase, legalActions = [] }) {
  const withoutVorpal = legalActions.filter((action) => action.type !== ACTION_TYPES.DECLARE_VORPAL)
  if (phase !== 'dungeon') return withoutVorpal
  return withoutVorpal.filter((action) => !DUNGEON_EQUIPMENT_MODAL_ACTION_TYPES.has(action.type))
}

/**
 * Species choices must mirror engine `getLegalActions` only. Do not merge dungeon pile or
 * `remainingMonsters` into options (would leak hidden composition).
 */
function countOccurrences(values, target) {
  let n = 0
  for (const v of values) {
    if (v === target) n += 1
  }
  return n
}

export function createVorpalDeclarationPromptView({
  isHumanTurn = false,
  gameplayInputLocked = false,
  phase = null,
  subphase = null,
  legalActions = [],
  memoryAidEnabled = false,
  viewerOwnPileAdds = [],
} = {}) {
  const speciesOptions = legalActions
    .filter((action) => action.type === 'DECLARE_VORPAL' && typeof action.species === 'string')
    .map((action) => action.species)

  const open =
    isHumanTurn &&
    !gameplayInputLocked &&
    phase === 'dungeon' &&
    subphase === 'vorpal' &&
    speciesOptions.length > 0

  const vorpalSpeciesOwnPileCounts =
    open && memoryAidEnabled
      ? Object.fromEntries(speciesOptions.map((sp) => [sp, countOccurrences(viewerOwnPileAdds, sp)]))
      : null

  return {
    open,
    speciesOptions,
    vorpalSpeciesOwnPileCounts,
    confirmActionType: 'DECLARE_VORPAL',
  }
}
