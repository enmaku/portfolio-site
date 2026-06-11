/**
 * @import '../types.js'
 */

/**
 * @typedef {import('../timerRules.js').GameTimerRuleSession} GameTimerRuleSession
 */

/**
 * @param {Partial<GameTimerRuleSession>} [overrides]
 * @returns {GameTimerRuleSession}
 */
export function createTestSession(overrides = {}) {
  const base = {
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
    hardPassEnabled: false,
    hardPassOrderNextRound: false,
    hardPassOrderByRound: {},
    totalGameStartedAt: null,
  }

  const merged = { ...base, ...overrides }

  return {
    ...merged,
    players: (merged.players ?? []).map((p) => ({
      bankedMs: 0,
      bankedMsByRound: {},
      ...p,
    })),
    playerOrderByRound: { ...(merged.playerOrderByRound ?? {}) },
    hardPassOrderByRound: { ...(merged.hardPassOrderByRound ?? {}) },
  }
}

/**
 * @param {string} id
 * @param {{ name?: string, color?: string, bankedMs?: number, bankedMsByRound?: Record<string, number> }} [opts]
 * @returns {GameTimerPlayer}
 */
export function testPlayer(id, opts = {}) {
  return {
    id,
    name: opts.name ?? id,
    color: opts.color ?? '#5c6bc0',
    bankedMs: opts.bankedMs ?? 0,
    bankedMsByRound: opts.bankedMsByRound ?? {},
  }
}
