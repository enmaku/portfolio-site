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
      label: spec?.label ?? equipmentId,
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
      title: equipmentId,
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

export function createVorpalDeclarationPromptView({
  isHumanTurn = false,
  gameplayInputLocked = false,
  phase = null,
  subphase = null,
  legalActions = [],
} = {}) {
  const speciesOptions = legalActions
    .filter((action) => action.type === 'DECLARE_VORPAL' && typeof action.species === 'string')
    .map((action) => action.species)

  return {
    open:
      isHumanTurn &&
      !gameplayInputLocked &&
      phase === 'dungeon' &&
      subphase === 'vorpal' &&
      speciesOptions.length > 0,
    speciesOptions,
    confirmActionType: 'DECLARE_VORPAL',
  }
}
