import { ACTION_TYPES } from '../engine/kernel.js'

/**
 * @param {Array<{ action?: { type?: string, modelId?: string } }>} history
 */
export function countEquipmentSacrifices(history) {
  if (!Array.isArray(history)) return 0
  return history.filter((entry) => entry?.action?.type === ACTION_TYPES.SACRIFICE).length
}

/**
 * @param {string | null | undefined} matchId
 */
export function parseMatchIdEpochMs(matchId) {
  if (typeof matchId !== 'string') return null
  const match = /^match-(\d+)$/.exec(matchId)
  if (!match) return null
  const epoch = Number(match[1])
  return Number.isFinite(epoch) ? epoch : null
}

/**
 * @param {Array<{ seatId: string, role: { type: string } }>} seats
 */
function seatRoleById(seats) {
  /** @type {Map<string, string>} */
  const map = new Map()
  for (const seat of seats ?? []) {
    if (seat?.seatId && seat?.role?.type) map.set(seat.seatId, seat.role.type)
  }
  return map
}

/**
 * @param {Array<{ action?: { type?: string, modelId?: string }, actorSeatId?: string }>} history
 * @param {Array<{ seatId: string, role: { type: string } }>} outcomeSeats
 */
export function buildHistoryRollups(history, outcomeSeats) {
  const entries = Array.isArray(history) ? history : []
  const roleBySeatId = seatRoleById(outcomeSeats)
  const historyStepsBySeatRole = { human: 0, nn: 0, randombot: 0 }
  /** @type {Set<string>} */
  const modelIdSet = new Set()
  let historyActionStepCount = 0
  let finalRngStep = null

  for (const entry of entries) {
    const actionType = entry?.action?.type
    if (typeof actionType === 'string' && actionType.length > 0) historyActionStepCount += 1
    const modelId = entry?.action?.modelId
    if (typeof modelId === 'string' && modelId.length > 0) modelIdSet.add(modelId)
    const roleType = roleBySeatId.get(entry?.actorSeatId ?? '')
    if (roleType && roleType in historyStepsBySeatRole) {
      historyStepsBySeatRole[roleType] += 1
    }
    if (Number.isInteger(entry?.rngStepAfter)) finalRngStep = entry.rngStepAfter
  }

  return {
    historyStepCount: entries.length,
    historyActionStepCount,
    historyStepsBySeatRole,
    historyModelIds: [...modelIdSet].sort(),
    finalRngStep,
  }
}

/**
 * @param {{ opponents?: Array<{ type: string, modelId?: string }> }} setup
 */
export function buildOpponentRollups(setup) {
  const opponents = Array.isArray(setup?.opponents) ? setup.opponents : []
  const opponentCountByType = { nn: 0, randombot: 0 }
  /** @type {Set<string>} */
  const modelIds = new Set()
  for (const opponent of opponents) {
    if (opponent?.type === 'nn') {
      opponentCountByType.nn += 1
      if (typeof opponent.modelId === 'string' && opponent.modelId.length > 0) {
        modelIds.add(opponent.modelId)
      }
    } else if (opponent?.type === 'randombot') {
      opponentCountByType.randombot += 1
    }
  }
  return {
    opponentCountByType,
    opponentModelIds: [...modelIds].sort(),
  }
}

/**
 * @param {Array<{ id: string, label: string, role: { type: string, modelId?: string } }>} seats
 */
export function normalizeOutcomeSeats(seats) {
  return (seats ?? []).map((seat) => ({
    seatId: seat.id,
    role: {
      type: seat.role?.type ?? 'unknown',
      ...(typeof seat.role?.modelId === 'string' && seat.role.modelId.length > 0
        ? { modelId: seat.role.modelId }
        : {}),
    },
    label: seat.label ?? seat.id,
  }))
}

/**
 * @param {{ type: string, modelId?: string }} role
 */
export function normalizeOutcomeRole(role) {
  if (!role || typeof role.type !== 'string') return { type: 'unknown' }
  return {
    type: role.type,
    ...(typeof role.modelId === 'string' && role.modelId.length > 0 ? { modelId: role.modelId } : {}),
  }
}
