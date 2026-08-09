/**
 * Soft-power paint / join / rebellion-pressure streak state machine.
 * Domain: world-builder/CONTEXT.md — Soft power; ADR 0019 anti-churn.
 */

import { getSoftPowerTuning } from './softPowerTuning.js'

/** Shorter streak that arms overlay paint and trade-backed rebellion pressure. */
export const SOFT_POWER_PAINT_STREAK_EPOCHS = 2

/** Extra clear hold after paint before peaceful trade-partner join eligibility. */
export const SOFT_POWER_JOIN_HOLD_EPOCHS = 2

/** Epochs dominance must stay clear before re-arming. */
export const SOFT_POWER_CLEAR_AND_REARM_EPOCHS = 2

/** Refractory after join / peel / trade-backed exit (mirrors membership). */
export const SOFT_POWER_REFRACTORY_EPOCHS = 2

/** Only commercial-affiliation cooldowns gate soft-power arming. */
export const SOFT_POWER_COOLDOWN_KINDS = new Set([
  'trade_partner_join',
  'trade_partner_peel',
])

/**
 * @typedef {Object} SoftPowerStreakState
 * @property {Record<string, number>} softPowerPaintStreak
 * @property {Record<string, number>} softPowerJoinHoldStreak
 * @property {Record<string, number>} softPowerClearStreak
 * @property {Record<string, string>} softPowerPaintBySettlementId
 * @property {Record<string, string>} softPowerJoinEligibleBySettlementId
 * @property {Record<string, number>} [softPowerRebellionPressureStreak]
 * @property {Array<{ subjectId?: string, untilEpoch?: number, kind?: string }> | null | undefined} [membershipCooldown]
 */

/**
 * @param {{
 *   state: SoftPowerStreakState,
 *   scores: Record<string, { dominantFactionId?: string | null }>,
 *   epoch: number,
 *   mapGraySettlementIds: Set<string>,
 *   taxedMemberSettlementIds?: Set<string>,
 *   homeFactionBySettlementId?: Record<string, string>,
 *   paintStreakEpochs?: number,
 *   joinHoldEpochs?: number,
 *   clearAndRearmEpochs?: number,
 * }} params
 * @returns {{ state: SoftPowerStreakState }}
 */
export function advanceSoftPowerStreaks(params) {
  const tuning = getSoftPowerTuning()
  const paintNeed =
    params.paintStreakEpochs ?? tuning.paintStreakEpochs ?? SOFT_POWER_PAINT_STREAK_EPOCHS
  const joinNeed = params.joinHoldEpochs ?? tuning.joinHoldEpochs ?? SOFT_POWER_JOIN_HOLD_EPOCHS
  const clearNeed =
    params.clearAndRearmEpochs ?? tuning.clearAndRearmEpochs ?? SOFT_POWER_CLEAR_AND_REARM_EPOCHS
  const epoch = params.epoch
  const scores = params.scores ?? {}
  const mapGray = params.mapGraySettlementIds ?? new Set()
  const taxed = params.taxedMemberSettlementIds ?? new Set()
  const homeById = params.homeFactionBySettlementId ?? {}

  /** @type {Record<string, number>} */
  const paintStreak = { ...(params.state.softPowerPaintStreak ?? {}) }
  /** @type {Record<string, number>} */
  const joinHold = { ...(params.state.softPowerJoinHoldStreak ?? {}) }
  /** @type {Record<string, number>} */
  const clearStreak = { ...(params.state.softPowerClearStreak ?? {}) }
  /** @type {Record<string, string>} */
  const paintBy = { ...(params.state.softPowerPaintBySettlementId ?? {}) }
  /** @type {Record<string, string>} */
  const joinEligible = { ...(params.state.softPowerJoinEligibleBySettlementId ?? {}) }
  /** @type {Record<string, number>} */
  const rebellionStreak = { ...(params.state.softPowerRebellionPressureStreak ?? {}) }

  const cooldownBlocked = new Set()
  for (const entry of params.state.membershipCooldown ?? []) {
    if (!entry || typeof entry.subjectId !== 'string') continue
    if (typeof entry.kind === 'string' && !SOFT_POWER_COOLDOWN_KINDS.has(entry.kind)) continue
    if (typeof entry.untilEpoch === 'number' && epoch <= entry.untilEpoch) {
      cooldownBlocked.add(entry.subjectId)
    }
  }

  const allIds = new Set([
    ...mapGray,
    ...taxed,
    ...Object.keys(scores),
    ...Object.keys(paintBy),
    ...Object.keys(paintStreak),
    ...Object.keys(rebellionStreak),
  ])

  for (const settlementId of allIds) {
    const dominant = scores[settlementId]?.dominantFactionId ?? null
    const isGray = mapGray.has(settlementId)
    const isTaxed = taxed.has(settlementId)
    const homeFactionId = homeById[settlementId] ?? null
    const blocked = cooldownBlocked.has(settlementId)

    if (isTaxed) {
      const rival =
        typeof dominant === 'string' && dominant !== homeFactionId ? dominant : null
      if (rival && !blocked) {
        rebellionStreak[settlementId] = (rebellionStreak[settlementId] ?? 0) + 1
      } else if (!rival) {
        if ((rebellionStreak[settlementId] ?? 0) > 0) {
          clearStreak[settlementId] = (clearStreak[settlementId] ?? 0) + 1
          if (clearStreak[settlementId] >= clearNeed) {
            delete rebellionStreak[settlementId]
            delete clearStreak[settlementId]
          }
        }
      }
      // Taxed seats never receive soft-power paint/join from this machine.
      delete paintBy[settlementId]
      delete joinEligible[settlementId]
      delete paintStreak[settlementId]
      delete joinHold[settlementId]
      continue
    }

    if (!isGray) {
      delete paintBy[settlementId]
      delete joinEligible[settlementId]
      delete paintStreak[settlementId]
      delete joinHold[settlementId]
      delete clearStreak[settlementId]
      continue
    }

    if (blocked) {
      delete paintStreak[settlementId]
      delete joinHold[settlementId]
      continue
    }

    const priorPaint = paintBy[settlementId]
    const sameDominant = typeof dominant === 'string' && dominant === priorPaint
    const hasDominant = typeof dominant === 'string'

    if (!hasDominant) {
      // Clear-and-rearm only after armed paint / join eligibility. An incomplete
      // paint streak simply drops — a one-epoch gap must not impose a full
      // clear penalty before the overlay ever armed.
      const hadArmedPaintOrJoin = Boolean(priorPaint || joinEligible[settlementId])
      const clearing = (clearStreak[settlementId] ?? 0) > 0
      delete paintBy[settlementId]
      delete joinEligible[settlementId]
      delete paintStreak[settlementId]
      delete joinHold[settlementId]
      if (hadArmedPaintOrJoin || clearing) {
        clearStreak[settlementId] = (clearStreak[settlementId] ?? 0) + 1
        if (clearStreak[settlementId] >= clearNeed) {
          delete clearStreak[settlementId]
        }
      }
      continue
    }

    // Still clearing from a prior loss — do not re-arm until clear completes.
    if ((clearStreak[settlementId] ?? 0) > 0 && clearStreak[settlementId] < clearNeed) {
      // Dominance returned mid-clear: hold clear counter, do not paint.
      delete paintStreak[settlementId]
      delete joinHold[settlementId]
      continue
    }

    if ((clearStreak[settlementId] ?? 0) >= clearNeed) {
      delete clearStreak[settlementId]
    }

    if (priorPaint && !sameDominant) {
      // Switched dominant faction — clear paint and require re-arm.
      delete paintBy[settlementId]
      delete joinEligible[settlementId]
      delete joinHold[settlementId]
      paintStreak[settlementId] = 1
      clearStreak[settlementId] = 1
      continue
    }

    if (priorPaint && sameDominant) {
      joinHold[settlementId] = (joinHold[settlementId] ?? 0) + 1
      if (joinHold[settlementId] >= joinNeed) {
        joinEligible[settlementId] = dominant
      }
      continue
    }

    // No prior paint — accumulate paint streak.
    paintStreak[settlementId] = (paintStreak[settlementId] ?? 0) + 1
    if (paintStreak[settlementId] >= paintNeed) {
      paintBy[settlementId] = dominant
      joinHold[settlementId] = 0
    }
  }

  return {
    state: {
      softPowerPaintStreak: paintStreak,
      softPowerJoinHoldStreak: joinHold,
      softPowerClearStreak: clearStreak,
      softPowerPaintBySettlementId: paintBy,
      softPowerJoinEligibleBySettlementId: joinEligible,
      softPowerRebellionPressureStreak: rebellionStreak,
      membershipCooldown: params.state.membershipCooldown,
    },
  }
}
