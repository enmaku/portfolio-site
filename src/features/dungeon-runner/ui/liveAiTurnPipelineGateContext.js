import { evaluateLiveAiTurnPipelineGate } from './liveAiTurnPipelineGate.js'
import { nnSeatModelId, shouldBlockAiTurnScheduleForRecovery } from './neuralSeatRecoveryView.js'

/**
 * @param {{
 *   matchState?: object | null
 *   humanSeatId?: string | null
 *   isHumanTurn?: boolean
 *   hasMatch?: boolean
 *   neuralRefreshTerminalOpen?: boolean
 *   matchNeuralLoadGateInFlight?: boolean
 *   aiTurnInFlight?: boolean
 *   headlessCompletionInFlight?: boolean
 *   deferredPostDungeonState?: object | null
 *   gameplayInputLocked?: boolean
 *   recovery?: { isRecovering: (modelId: string) => boolean, shouldBlockTurn?: (modelId: string) => boolean }
 *   runToken?: string
 *   lastAppliedAiTurnToken?: string | null
 *   timerPending?: boolean
 *   pickAdventurerNnEnabled?: boolean
 * }} params
 */
export function buildLiveAiTurnPipelineGateInputs({
  matchState = null,
  humanSeatId = null,
  isHumanTurn = false,
  hasMatch = false,
  neuralRefreshTerminalOpen = false,
  matchNeuralLoadGateInFlight = false,
  aiTurnInFlight = false,
  headlessCompletionInFlight = false,
  deferredPostDungeonState = null,
  gameplayInputLocked = false,
  recovery = null,
  runToken = '',
  lastAppliedAiTurnToken = null,
  timerPending = false,
  pickAdventurerNnEnabled = true,
} = {}) {
  const seatId = matchState?.turn?.activeSeatId ?? null
  const seat = matchState?.seats?.find((candidate) => candidate.id === seatId)
  const roleType = seat?.role?.type ?? null
  const modelId = nnSeatModelId(seat)
  const blockForRecovery =
    matchState && recovery
      ? shouldBlockAiTurnScheduleForRecovery({ state: matchState, recovery })
      : false
  const modelRecovering = modelId && recovery ? recovery.isRecovering(modelId) : false

  return {
    neuralRefreshTerminalOpen,
    matchNeuralLoadGateInFlight,
    aiTurnInFlight,
    headlessCompletionInFlight,
    deferredPostDungeonState,
    hasMatch,
    isHumanTurn,
    blockForRecovery,
    gameplayInputLocked,
    phase: matchState?.phase ?? null,
    seatId,
    humanSeatId,
    roleType,
    pickAdventurerNnEnabled,
    runToken,
    lastAppliedAiTurnToken,
    timerPending,
    modelRecovering,
  }
}

/**
 * @param {Parameters<typeof buildLiveAiTurnPipelineGateInputs>[0]} params
 */
export function evaluateLiveAiTurnPipelineGateForContext(params) {
  return evaluateLiveAiTurnPipelineGate(buildLiveAiTurnPipelineGateInputs(params))
}
