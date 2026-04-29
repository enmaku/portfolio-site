export function exportReplayEnvelope(payload) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    seed: payload.seed,
    setup: payload.setup,
    history: payload.history ?? [],
  }
}

export function importReplayEnvelope(raw) {
  if (
    !raw ||
    raw.version !== 1 ||
    !Number.isInteger(raw.seed) ||
    !raw.setup ||
    !Array.isArray(raw.history)
  ) {
    return { ok: false, errorCode: 'INVALID_REPLAY' }
  }
  if (!hasValidTurnBoundaryHistory(raw.history)) {
    return { ok: false, errorCode: 'INVALID_REPLAY_HISTORY' }
  }
  return { ok: true, replay: raw }
}

function hasValidTurnBoundaryHistory(history) {
  let previousAfter = null
  for (const entry of history) {
    if (!entry || typeof entry !== 'object') return false
    if (!entry.action || typeof entry.action.type !== 'string') return false
    if (typeof entry.actorSeatId !== 'string' || !entry.actorSeatId) return false
    if (!Number.isInteger(entry.rngStepBefore) || !Number.isInteger(entry.rngStepAfter)) return false
    if (entry.rngStepAfter <= entry.rngStepBefore) return false
    if (previousAfter != null && entry.rngStepBefore !== previousAfter) return false
    previousAfter = entry.rngStepAfter
  }
  return true
}
