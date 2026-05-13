import { ACTION_TYPES } from '../engine/kernel.js'
import { equipmentShortName } from './equipmentDisplayCatalog.js'

const EQUIPMENT_UI = {
  W_PLATE: {
    label: 'Plate Armor',
    details: 'Passive: +5 starting HP for this dungeon run.',
  },
  W_SHIELD: {
    label: 'Knight Shield',
    details: 'Passive: +3 starting HP for this dungeon run.',
  },
  W_VORPAL: {
    label: 'Vorpal Sword',
    details:
      'At dungeon start, name a species; the first revealed copy is auto-defeated, then this is spent.',
  },
  W_TORCH: {
    label: 'Torch',
    details: 'Passive: auto-defeats monsters with strength 3 or less.',
  },
  W_HOLY: {
    label: 'Holy Grail',
    details: 'Passive: auto-defeats monsters with even strength.',
  },
  W_SPEAR: {
    label: 'Dragon Spear',
    details: 'Passive: auto-defeats Dragon.',
  },
  B_HEAL: {
    label: 'Healing Potion',
    details:
      'Single-use revive: when HP would drop to 0 or below, reset to base hero HP and continue; then spent.',
  },
  B_SHIELD: {
    label: 'Leather Shield',
    details: 'Passive: +3 starting HP for this dungeon run.',
  },
  B_CHAIN: {
    label: 'Chain Mail',
    details: 'Passive: +4 starting HP for this dungeon run.',
  },
  B_AXE: {
    label: 'Fire Axe',
    details: 'Single-use: destroy one revealed monster, then continue the run.',
    useActionType: 'USE_FIRE_AXE',
    declineActionType: 'DECLINE_FIRE_AXE',
  },
  B_TORCH: {
    label: 'Torch',
    details: 'Passive: auto-defeats monsters with strength 3 or less.',
  },
  B_HAMMER: {
    label: 'War Hammer',
    details: 'Passive: auto-defeats Golems.',
  },
  M_WALL: {
    label: 'Wall of Fire',
    details: 'Passive: +6 starting HP for this dungeon run.',
  },
  M_HOLY: {
    label: 'Holy Grail',
    details: 'Passive: auto-defeats monsters with even strength.',
  },
  M_OMNI: {
    label: 'Omnipotence',
    details:
      'If you would die, you win instead only when every monster species in the full dungeon set is unique.',
  },
  M_BRACE: {
    label: 'Bracelet of Protection',
    details: 'Passive: +3 starting HP for this dungeon run.',
  },
  M_POLY: {
    label: 'Polymorph',
    details:
      'Single-use: replace the revealed monster with the next unrevealed dungeon card and resolve that one.',
    useActionType: 'USE_POLYMORPH',
    declineActionType: 'DECLINE_POLYMORPH',
  },
  M_PACT: {
    label: 'Demonic Pact',
    details: 'Auto-defeats Demon and the next revealed monster, then is spent.',
  },
  R_ARMOR: {
    label: 'Mithril Armor',
    details: 'Passive: +5 starting HP for this dungeon run.',
  },
  R_HEAL: {
    label: 'Healing Potion',
    details:
      'Single-use revive: when HP would drop to 0 or below, reset to base hero HP and continue; then spent.',
  },
  R_RING: {
    label: 'Ring of Power',
    details: 'Passive: auto-defeat monsters with strength 2 or less and heal HP by their total strength.',
  },
  R_BUCK: {
    label: 'Buckler',
    details: 'Passive: +3 starting HP for this dungeon run.',
  },
  R_VORP: {
    label: 'Vorpal Dagger',
    details:
      'At dungeon start, name a species; the first revealed copy is auto-defeated, then this is spent.',
  },
  R_CLOAK: {
    label: 'Invisibility Cloak',
    details: 'Passive: auto-defeats monsters with strength 6 or more.',
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
