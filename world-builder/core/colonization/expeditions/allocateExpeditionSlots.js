import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'

/**
 * @typedef {import('./evaluateFrontierEligibility.js').FrontierEligibleSender} FrontierEligibleSender
 */

/**
 * @typedef {Object} ExpeditionSlotAssignment
 * @property {string} settlementId
 * @property {'land' | 'maritime'} pool
 * @property {import('./classifySettlementMaritimeRole.js').SettlementMaritimeRole} maritimeRole
 */

/**
 * @param {{
 *   landSlots: number,
 *   maritimeSlots: number,
 *   senders: FrontierEligibleSender[],
 *   geographySeed: number,
 *   epoch: number,
 * }} params
 * @returns {ExpeditionSlotAssignment[]}
 */
export function allocateExpeditionSlots(params) {
  const { landSlots, maritimeSlots, senders, geographySeed, epoch } = params
  /** @type {ExpeditionSlotAssignment[]} */
  const assignments = []
  const usedSettlementIds = new Set()

  const landSenders = senders.filter((sender) => sender.pool === 'land')
  const maritimeSenders = senders.filter((sender) => sender.pool === 'maritime')

  pickWeightedSlots({
    slots: landSlots,
    senders: landSenders,
    usedSettlementIds,
    assignments,
    geographySeed,
    epoch,
    pool: 'land',
  })

  pickWeightedSlots({
    slots: maritimeSlots,
    senders: maritimeSenders,
    usedSettlementIds,
    assignments,
    geographySeed,
    epoch,
    pool: 'maritime',
  })

  return assignments
}

/**
 * @param {{
 *   slots: number,
 *   senders: FrontierEligibleSender[],
 *   usedSettlementIds: Set<string>,
 *   assignments: ExpeditionSlotAssignment[],
 *   geographySeed: number,
 *   epoch: number,
 *   pool: 'land' | 'maritime',
 * }} params
 */
function pickWeightedSlots(params) {
  const { slots, senders, usedSettlementIds, assignments, geographySeed, epoch, pool } = params
  if (slots <= 0 || senders.length === 0) {
    return
  }

  /** @type {FrontierEligibleSender[]} */
  const remaining = senders.filter((sender) => !usedSettlementIds.has(sender.settlementId))
  const random = createSeededRandom(
    deriveFieldSeed(geographySeed, `expedition-slots-${epoch}-${pool}`),
  )

  for (let slot = 0; slot < slots && remaining.length > 0; slot += 1) {
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
    usedSettlementIds.add(winner.settlementId)
    assignments.push({
      settlementId: winner.settlementId,
      pool,
      maritimeRole: winner.maritimeRole,
    })
    remaining.splice(winnerIndex, 1)
  }
}
