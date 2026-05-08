const PREVENTABLE_DAMAGE_ACTIONS = new Set(['USE_FIRE_AXE', 'USE_POLYMORPH'])

export function dungeonStageClassForKind(kind) {
  if (kind === 'DUNGEON_REVEAL') return 'dr-dungeon-stage--reveal'
  if (kind === 'DUNGEON_NEUTRALIZE') return 'dr-dungeon-stage--strike dr-dungeon-stage--consume'
  if (kind === 'DUNGEON_DAMAGE') return 'dr-dungeon-stage--hit'
  if (kind === 'DUNGEON_CONTINUE') return 'dr-dungeon-stage--consume'
  return ''
}

export function shouldAutoResolveDungeonAdvance({
  phase = null,
  gameplayInputLocked = false,
  isHumanTurn = false,
  legalActions = [],
  autoAdvanceAction = null,
  resolutionStatus = null,
  activeAnimationKind = null,
} = {}) {
  if (phase !== 'dungeon') return false
  if (!isHumanTurn || gameplayInputLocked) return false
  if (legalActions.length !== 1 || !autoAdvanceAction) return false
  if (resolutionStatus !== 'auto-resolved') return false
  if (activeAnimationKind === 'DUNGEON_OUTCOME') return false
  if (autoAdvanceAction?.type === 'REVEAL_OR_CONTINUE') return false
  return true
}

export function shouldExecuteScheduledAutoResolve({
  phase = null,
  gameplayInputLocked = false,
  isHumanTurn = false,
  equipmentModalOpen = false,
  autoAdvanceAction = null,
  legalActions = [],
  resolutionStatus = null,
  activeAnimationKind = null,
} = {}) {
  if (equipmentModalOpen) return false
  if (
    !shouldAutoResolveDungeonAdvance({
      phase,
      gameplayInputLocked,
      isHumanTurn,
      legalActions,
      autoAdvanceAction,
      resolutionStatus,
      activeAnimationKind,
    })
  ) {
    return false
  }
  return legalActions.some((action) => action?.type === autoAdvanceAction?.type)
}

export function buildDungeonOutcomeTransitionControls({
  phase = null,
  gameplayInputLocked = false,
  resolutionStatus = null,
  autoAdvanceAction = null,
} = {}) {
  if (phase !== 'dungeon') return []
  if (gameplayInputLocked || resolutionStatus !== 'auto-resolved' || !autoAdvanceAction) return []
  return [
    {
      key: `transition-${autoAdvanceAction.type}`,
      label: 'Continue',
      action: autoAdvanceAction,
    },
  ]
}

export function pickPreventableDamageTokenToAutoOpen({
  phase = null,
  isHumanTurn = false,
  gameplayInputLocked = false,
  legalActions = [],
  equipmentTokens = [],
} = {}) {
  if (phase !== 'dungeon') return null
  if (!isHumanTurn || gameplayInputLocked) return null
  if (!hasPreventableDamageWindow(legalActions)) return null
  const token = equipmentTokens.find((item) => item.canUseNow)
  return token?.equipmentId ?? null
}

function hasPreventableDamageWindow(legalActions) {
  if (legalActions.length !== 2) return false
  return legalActions.some((action) => PREVENTABLE_DAMAGE_ACTIONS.has(action.type))
}
