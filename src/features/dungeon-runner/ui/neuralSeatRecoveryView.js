import { NEURAL_RECOVERY_TERMINAL } from '../nn/recovery.js'

/**
 * @param {{ role?: { type?: string, modelId?: string } }} seat
 * @returns {string | null}
 */
export function nnSeatModelId(seat) {
  if (seat?.role?.type !== 'nn') return null
  return seat.role.modelId ?? 'latest'
}

/**
 * @param {{ seats: object[], recovery: { isRecovering: (modelId: string) => boolean } }} params
 */
export function buildSeatRecoveryIndicators({ seats, recovery }) {
  return seats.map((seat) => {
    const modelId = nnSeatModelId(seat)
    const recovering = modelId ? recovery.isRecovering(modelId) : false
    return {
      seatId: seat.id,
      recovering,
      testId: recovering ? `neural-seat-recovery-${seat.id}` : null,
    }
  })
}

/**
 * @param {{ state: { turn?: { activeSeatId?: string }, seats?: object[] }, recovery: { shouldBlockTurn: (modelId: string) => boolean } }} params
 */
export function isActiveNnSeatRecovering({ state, recovery }) {
  const activeSeatId = state?.turn?.activeSeatId
  if (!activeSeatId) return false
  const seat = state.seats?.find((candidate) => candidate.id === activeSeatId)
  const modelId = nnSeatModelId(seat)
  if (!modelId) return false
  return recovery.shouldBlockTurn(modelId)
}

/**
 * @param {{ state: { turn?: { activeSeatId?: string }, seats?: object[] }, recovery: { shouldBlockTurn: (modelId: string) => boolean } }} params
 */
export function shouldBlockAiTurnScheduleForRecovery({ state, recovery }) {
  return isActiveNnSeatRecovering({ state, recovery })
}

/**
 * @param {{ terminal: string, hasMatchSetup?: boolean }} params
 * @returns {{ action: 'setup-restore' | 'refresh-dialog' } | { action: null }}
 */
export function resolveNeuralRecoveryTerminalUx({ terminal, hasMatchSetup = false }) {
  if (terminal === NEURAL_RECOVERY_TERMINAL.SETUP && hasMatchSetup) {
    return { action: 'setup-restore' }
  }
  if (terminal === NEURAL_RECOVERY_TERMINAL.REFRESH) {
    return { action: 'refresh-dialog' }
  }
  return { action: null }
}
