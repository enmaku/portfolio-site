/**
 * Political-pressure streak / clear-and-rearm / refractory state.
 * Domain: world-builder/CONTEXT.md — Political pressure; sticky membership anti-churn.
 */

import {
  DEFAULT_POLITICAL_PRESSURE_TUNING,
  getPoliticalPressureTuning,
} from './politicalPressureTuning.js'

export const POLITICAL_PRESSURE_COOLDOWN_KIND = 'alliance'

/**
 * Map-gray / singleton pressure join waits longer than soft-power paint+join
 * (2+2) so commercial **trade partner** can win first when both pull.
 * Peels of sticky hinterland members still use Sweep B streakEpochs (3).
 */
export const POLITICAL_PRESSURE_MAP_GRAY_STREAK_EPOCHS = 5

/**
 * @typedef {{
 *   politicalPressureStreak?: Record<string, number>,
 *   politicalPressureClearStreak?: Record<string, number>,
 *   politicalPressureArmedBySettlementId?: Record<string, string>,
 *   membershipCooldown?: Array<{ subjectId?: string, untilEpoch?: number, kind?: string }>,
 * }} PoliticalPressureStreakState
 */

/**
 * @param {{
 *   state: PoliticalPressureStreakState,
 *   scores: Record<string, { dominantFactionId?: string | null }>,
 *   epoch: number,
 *   eligibleSubjectIds: Set<string>,
 *   homeFactionBySettlementId?: Record<string, string | null | undefined>,
 *   mapGraySettlementIds?: Set<string>,
 *   streakEpochs?: number,
 *   clearAndRearmEpochs?: number,
 * }} params
 * @returns {{ state: PoliticalPressureStreakState }}
 */
export function advancePoliticalPressureStreaks(params) {
  const tuning = getPoliticalPressureTuning()
  const streakEpochs =
    params.streakEpochs ?? tuning.streakEpochs ?? DEFAULT_POLITICAL_PRESSURE_TUNING.streakEpochs
  const clearAndRearmEpochs =
    params.clearAndRearmEpochs ??
    tuning.clearAndRearmEpochs ??
    DEFAULT_POLITICAL_PRESSURE_TUNING.clearAndRearmEpochs
  /** @type {Record<string, number>} */
  const streak = { ...(params.state.politicalPressureStreak ?? {}) }
  /** @type {Record<string, number>} */
  const clearStreak = { ...(params.state.politicalPressureClearStreak ?? {}) }
  /** @type {Record<string, string>} */
  const armed = { ...(params.state.politicalPressureArmedBySettlementId ?? {}) }
  const cooldowns = Array.isArray(params.state.membershipCooldown)
    ? params.state.membershipCooldown
    : []
  const homeFactionBySettlementId = params.homeFactionBySettlementId ?? {}
  const mapGraySettlementIds = params.mapGraySettlementIds ?? new Set()

  /** @type {Set<string>} */
  const refractory = new Set()
  for (const row of cooldowns) {
    if (!row || row.kind !== POLITICAL_PRESSURE_COOLDOWN_KIND) continue
    if (typeof row.subjectId !== 'string') continue
    if (typeof row.untilEpoch === 'number' && params.epoch < row.untilEpoch) {
      refractory.add(row.subjectId)
    }
  }

  for (const subjectId of params.eligibleSubjectIds) {
    if (refractory.has(subjectId)) {
      streak[subjectId] = 0
      clearStreak[subjectId] = 0
      delete armed[subjectId]
      continue
    }
    let dominant = params.scores[subjectId]?.dominantFactionId ?? null
    if (dominant && homeFactionBySettlementId[subjectId] === dominant) {
      dominant = null
    }
    const armAt = mapGraySettlementIds.has(subjectId)
      ? Math.max(streakEpochs, POLITICAL_PRESSURE_MAP_GRAY_STREAK_EPOCHS)
      : streakEpochs
    const prevArmed = armed[subjectId] ?? null
    if (dominant && (!prevArmed || prevArmed === dominant)) {
      clearStreak[subjectId] = 0
      const next = (streak[subjectId] ?? 0) + 1
      streak[subjectId] = next
      if (next >= armAt) {
        armed[subjectId] = dominant
      }
    } else if (dominant && prevArmed && prevArmed !== dominant) {
      const cleared = (clearStreak[subjectId] ?? 0) + 1
      clearStreak[subjectId] = cleared
      streak[subjectId] = 0
      if (cleared >= clearAndRearmEpochs) {
        delete armed[subjectId]
        streak[subjectId] = 1
        if (armAt <= 1) armed[subjectId] = dominant
      }
    } else {
      const cleared = (clearStreak[subjectId] ?? 0) + 1
      clearStreak[subjectId] = cleared
      streak[subjectId] = 0
      if (cleared >= clearAndRearmEpochs) {
        delete armed[subjectId]
      }
    }
  }

  for (const id of Object.keys(streak)) {
    if (!params.eligibleSubjectIds.has(id)) {
      delete streak[id]
      delete clearStreak[id]
      delete armed[id]
    }
  }

  return {
    state: {
      politicalPressureStreak: streak,
      politicalPressureClearStreak: clearStreak,
      politicalPressureArmedBySettlementId: armed,
      membershipCooldown: params.state.membershipCooldown,
    },
  }
}
