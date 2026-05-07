import { ACTION_TYPES } from '../engine/kernel.js'
import { equipmentShortName } from './equipmentDisplayCatalog.js'

const EQUIPMENT_UI = {
  B_AXE: {
    label: 'Fire Axe',
    details: 'Destroy the revealed monster, then continue combat.',
    useActionType: 'USE_FIRE_AXE',
    declineActionType: 'DECLINE_FIRE_AXE',
    confirmUseMessage: 'Spend Fire Axe now?',
  },
  M_POLY: {
    label: 'Polymorph',
    details: 'Transform and bypass the current monster.',
    useActionType: 'USE_POLYMORPH',
    declineActionType: 'DECLINE_POLYMORPH',
    confirmUseMessage: 'Spend Polymorph now?',
  },
}

function hasAction(legalActions, type) {
  return legalActions.some((action) => action.type === type)
}

export function buildDungeonEquipmentTokenView({ inPlayEquipmentIds = [], legalActions = [] }) {
  return inPlayEquipmentIds.map((equipmentId) => {
    const spec = EQUIPMENT_UI[equipmentId]
    const canUseNow = !!spec && hasAction(legalActions, spec.useActionType)
    const canOpenMemoryAid = !!spec && (canUseNow || hasAction(legalActions, spec.declineActionType))
    return {
      equipmentId,
      label: spec?.label ?? equipmentShortName(equipmentId),
      details: spec?.details ?? '',
      canUseNow,
      glow: canUseNow,
      hasModal: canOpenMemoryAid,
    }
  })
}

export function createDungeonEquipmentModalView({ equipmentId, legalActions = [] }) {
  const spec = EQUIPMENT_UI[equipmentId]
  if (!spec) {
    return {
      equipmentId,
      title: equipmentShortName(equipmentId),
      details: '',
      showUseButton: false,
      useAction: null,
      continueAction: null,
      confirmUseMessage: '',
    }
  }
  const showUseButton = hasAction(legalActions, spec.useActionType)
  const hasDecline = hasAction(legalActions, spec.declineActionType)
  return {
    equipmentId,
    title: spec.label,
    details: spec.details,
    showUseButton,
    useAction: showUseButton ? { type: spec.useActionType } : null,
    continueAction: hasDecline ? { type: spec.declineActionType } : null,
    confirmUseMessage: spec.confirmUseMessage,
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
  ACTION_TYPES.DECLINE_FIRE_AXE,
  ACTION_TYPES.USE_POLYMORPH,
  ACTION_TYPES.DECLINE_POLYMORPH,
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
