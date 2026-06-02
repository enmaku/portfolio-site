export function isHumanGameplayBlocked({
  gameplayInputLocked = false,
  dungeonOutcomeDialogOpen = false,
  headlessCompletionInFlight = false,
  neuralRefreshTerminalOpen = false,
} = {}) {
  return (
    gameplayInputLocked ||
    dungeonOutcomeDialogOpen ||
    headlessCompletionInFlight ||
    neuralRefreshTerminalOpen
  )
}

export function isEquipmentModalActionsDisabled({
  humanGameplayBlocked = false,
  isHumanTurn = false,
} = {}) {
  return humanGameplayBlocked || !isHumanTurn
}

export function shouldRejectEquipmentTokenTap({ humanGameplayBlocked = false, hasModal = false } = {}) {
  return !hasModal || humanGameplayBlocked
}
