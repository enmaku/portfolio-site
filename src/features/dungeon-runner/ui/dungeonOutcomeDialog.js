export function isDungeonOutcomeDialogOpen({
  lastDungeonRun = null,
  dismissedDungeonRun = null,
} = {}) {
  return !!lastDungeonRun && lastDungeonRun !== dismissedDungeonRun
}

export function shouldShowDungeonOutcomeDialog({
  gameplayInputLocked = false,
  headlessCompletionInFlight = false,
  lastDungeonRun = null,
  dismissedDungeonRun = null,
} = {}) {
  if (headlessCompletionInFlight || gameplayInputLocked) return false
  return isDungeonOutcomeDialogOpen({ lastDungeonRun, dismissedDungeonRun })
}

export function countCenterEquipmentRemaining(centerEquipment) {
  return Array.isArray(centerEquipment) ? centerEquipment.length : 0
}

/**
 * @returns {{ dismissedDungeonRun: null, equipmentRemainingAtResolution: null } | { equipmentRemainingAtResolution: number }}
 */
export function resolveLastDungeonRunWatcherUpdate(lastDungeonRun, centerEquipment) {
  if (!lastDungeonRun) {
    return {
      dismissedDungeonRun: null,
      equipmentRemainingAtResolution: null,
    }
  }
  return {
    equipmentRemainingAtResolution: countCenterEquipmentRemaining(centerEquipment),
  }
}

export function dismissDungeonRunForOutcomeDialog(lastDungeonRun) {
  return lastDungeonRun ?? null
}

export function buildDungeonOutcomeSummary({
  lastDungeonRun = null,
  seats = [],
  equipmentRemainingAtResolution = null,
} = {}) {
  if (!lastDungeonRun) return null
  const runnerSeat = seats.find((seat) => seat.id === lastDungeonRun.runnerSeatId)
  const runnerLabel = runnerSeat?.label ?? lastDungeonRun.runnerSeatId ?? 'Unknown'
  const monsters = Array.isArray(lastDungeonRun.monsters) ? lastDungeonRun.monsters : []
  const monstersLabel = monsters.length > 0 ? monsters.join(', ') : 'none'
  const initialLoadout = Number.isFinite(lastDungeonRun.heroLoadoutSize)
    ? lastDungeonRun.heroLoadoutSize
    : 0
  const remaining = Number.isFinite(equipmentRemainingAtResolution)
    ? equipmentRemainingAtResolution
    : initialLoadout
  const spentCount = Math.max(0, initialLoadout - remaining)
  return {
    runnerLabel,
    resultLabel: lastDungeonRun.result === 'success' ? 'Success' : 'Failure',
    monstersLabel,
    equipmentSpentLabel: spentCount > 0 ? `${spentCount} spent` : 'none spent',
  }
}
