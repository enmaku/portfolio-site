import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'

/**
 * @typedef {import('./evaluateFrontierEligibility.js').FrontierEligibleSender} FrontierEligibleSender
 */

/** @typedef {FrontierEligibleSender} ExpeditionSlotAssignment */

/**
 * @param {FrontierEligibleSender[]} senders
 * @returns {FrontierEligibleSender[]}
 */
function listPortSenders(senders) {
  return senders.filter((sender) => sender.maritimeRole === 'port' && sender.canDispatchMaritime)
}

/**
 * @param {FrontierEligibleSender[]} remaining
 * @param {string} settlementId
 */
function removeSender(remaining, settlementId) {
  const index = remaining.findIndex((sender) => sender.settlementId === settlementId)
  if (index >= 0) {
    remaining.splice(index, 1)
  }
}

/**
 * @param {{
 *   landSlots: number,
 *   maritimeSlots: number,
 *   senders: FrontierEligibleSender[],
 *   geographySeed: number,
 *   epoch: number,
 *   remainingDispatchCapacity?: Map<string, number>,
 * }} params
 * @returns {ExpeditionSlotAssignment[]}
 */
export function allocateExpeditionSlots(params) {
  const { landSlots, maritimeSlots, senders, geographySeed, epoch, remainingDispatchCapacity } =
    params
  if (senders.length === 0) {
    return []
  }

  const portSenders = listPortSenders(senders)
  const totalPopulation = senders.reduce((sum, sender) => sum + sender.population, 0)
  const throughputFloor = Math.min(
    senders.length,
    Math.max(
      portSenders.length,
      Math.ceil(Math.sqrt(totalPopulation) / 2),
    ),
  )
  const totalSlots = Math.max(landSlots + maritimeSlots, throughputFloor)
  if (totalSlots <= 0) {
    return []
  }

  /** @type {ExpeditionSlotAssignment[]} */
  const assignments = []
  /** @type {FrontierEligibleSender[]} */
  const remaining = [...senders]
  /** @type {Map<string, number>} */
  const capacityBySender = new Map(
    remainingDispatchCapacity
      ? [...remainingDispatchCapacity]
      : senders.map((sender) => [sender.settlementId, 1]),
  )

  function consumeSenderCapacity(settlementId) {
    const slotsLeft = capacityBySender.get(settlementId) ?? 0
    if (slotsLeft <= 1) {
      capacityBySender.delete(settlementId)
      removeSender(remaining, settlementId)
    } else {
      capacityBySender.set(settlementId, slotsLeft - 1)
    }
  }

  for (const port of portSenders) {
    if (assignments.length >= totalSlots) {
      break
    }
    if ((capacityBySender.get(port.settlementId) ?? 0) <= 0) {
      continue
    }
    assignments.push({ ...port })
    consumeSenderCapacity(port.settlementId)
  }

  const random = createSeededRandom(
    deriveFieldSeed(geographySeed, `expedition-slots-${epoch}`),
  )

  for (let slot = assignments.length; slot < totalSlots && remaining.length > 0; slot += 1) {
    const totalWeight = remaining.reduce((sum, sender) => sum + sender.population, 0)
    let pick = random() * totalWeight
    let winnerIndex = 0
    for (let i = 0; i < remaining.length; i += 1) {
      pick -= remaining[i].population
      if (pick <= 0) {
        winnerIndex = i
        break
      }
    }

    const winner = remaining[winnerIndex]
    assignments.push({ ...winner })
    consumeSenderCapacity(winner.settlementId)
  }

  return assignments
}
