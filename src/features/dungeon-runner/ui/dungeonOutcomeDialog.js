import { DUNGEON_RUN_WIN_VIA } from '../engine/omnipotencePolicy.js'

export const DUNGEON_OUTCOME_MESSAGE_KIND = Object.freeze({
  CLEARED: 'cleared',
  OMNIPOTENCE: 'omnipotence',
  FAILED: 'failed',
})

/**
 * @param {{ result?: string; winVia?: string } | null | undefined} lastDungeonRun
 */
export function resolveDungeonOutcomeMessageKind(lastDungeonRun) {
  if (!lastDungeonRun) return null
  if (lastDungeonRun.result === 'failure') return DUNGEON_OUTCOME_MESSAGE_KIND.FAILED
  if (lastDungeonRun.winVia === DUNGEON_RUN_WIN_VIA.OMNIPOTENCE) {
    return DUNGEON_OUTCOME_MESSAGE_KIND.OMNIPOTENCE
  }
  if (lastDungeonRun.result === 'success') return DUNGEON_OUTCOME_MESSAGE_KIND.CLEARED
  return null
}

const DUNGEON_OUTCOME_MESSAGES = Object.freeze({
  [DUNGEON_OUTCOME_MESSAGE_KIND.CLEARED]: 'Clean run. The dungeon is cleared.',
  [DUNGEON_OUTCOME_MESSAGE_KIND.OMNIPOTENCE]:
    'Omnipotence prevailed. Every species in the initial dungeon pile was unique.',
  [DUNGEON_OUTCOME_MESSAGE_KIND.FAILED]: 'The run failed.',
})

/**
 * @param {{ result?: string; winVia?: string } | null | undefined} lastDungeonRun
 */
export function resolveDungeonOutcomeMessage(lastDungeonRun) {
  const kind = resolveDungeonOutcomeMessageKind(lastDungeonRun)
  if (!kind) return ''
  return DUNGEON_OUTCOME_MESSAGES[kind] ?? ''
}

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
