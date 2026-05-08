import { ACTION_TYPES } from '../engine/kernel.js'
import { equipmentShortName } from './equipmentDisplayCatalog.js'

const EQUIPMENT_UI = {
  W_PLATE: {
    label: 'Plate Armor',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  W_SHIELD: {
    label: 'Shield',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  W_VORPAL: {
    label: 'Vorpal Sword',
    details: 'Dungeon start: declare a species. Defeat one matching monster automatically.',
  },
  W_TORCH: {
    label: 'Torch',
    details: 'Passive: helps defeat weaker monsters.',
  },
  W_HOLY: {
    label: 'Holy Water',
    details: 'Passive: helps defeat even-strength monsters.',
  },
  W_SPEAR: {
    label: 'Spear',
    details: 'Passive: defeats dragon.',
  },
  B_HEAL: {
    label: 'Heal',
    details: 'Passive: healing effect resolves during dungeon checks.',
  },
  B_SHIELD: {
    label: 'Shield',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  B_CHAIN: {
    label: 'Chain Mail',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  B_AXE: {
    label: 'Fire Axe',
    details: 'Destroy the revealed monster, then continue combat.',
    useActionType: 'USE_FIRE_AXE',
    declineActionType: 'DECLINE_FIRE_AXE',
    confirmUseMessage: 'Spend Fire Axe now?',
  },
  B_TORCH: {
    label: 'Torch',
    details: 'Passive: helps defeat weaker monsters.',
  },
  B_HAMMER: {
    label: 'Hammer',
    details: 'Passive: defeats golem.',
  },
  M_WALL: {
    label: 'Wall',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  M_HOLY: {
    label: 'Holy',
    details: 'Passive: helps defeat even-strength monsters.',
  },
  M_OMNI: {
    label: 'Omni',
    details: 'Passive: can save a failed dungeon run in the right state.',
  },
  M_BRACE: {
    label: 'Brace',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  M_POLY: {
    label: 'Polymorph',
    details: 'Transform and bypass the current monster.',
    useActionType: 'USE_POLYMORPH',
    declineActionType: 'DECLINE_POLYMORPH',
    confirmUseMessage: 'Spend Polymorph now?',
  },
  M_PACT: {
    label: 'Pact',
    details: 'Passive: defeats demon.',
  },
  R_ARMOR: {
    label: 'Armor',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  R_HEAL: {
    label: 'Heal',
    details: 'Passive: healing effect resolves during dungeon checks.',
  },
  R_RING: {
    label: 'Ring',
    details: 'Passive: helps defeat weak monsters.',
  },
  R_BUCK: {
    label: 'Buckler',
    details: 'Passive: increases your starting dungeon HP while in play.',
  },
  R_VORP: {
    label: 'Vorpal',
    details: 'Dungeon start: declare a species. Defeat one matching monster automatically.',
  },
  R_CLOAK: {
    label: 'Cloak',
    details: 'Passive: helps defeat stronger monsters.',
  },
}

function hasAction(legalActions, type) {
  return legalActions.some((action) => action.type === type)
}

export function buildDungeonEquipmentTokenView({ inPlayEquipmentIds = [], legalActions = [] }) {
  return inPlayEquipmentIds.map((equipmentId) => {
    const spec = EQUIPMENT_UI[equipmentId]
    const canUseNow = !!spec && hasAction(legalActions, spec.useActionType)
    return {
      equipmentId,
      label: spec?.label ?? equipmentShortName(equipmentId),
      details: spec?.details ?? '',
      canUseNow,
      glow: canUseNow,
      hasModal: true,
    }
  })
}

export function createDungeonEquipmentModalView({ equipmentId, legalActions = [] }) {
  const spec = EQUIPMENT_UI[equipmentId]
  if (!spec) {
    return {
      equipmentId,
      title: equipmentShortName(equipmentId),
      details: 'No additional effect text available.',
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
