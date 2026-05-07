export function exportReplayEnvelope(payload) {
  const envelope = {
    version: 1,
    createdAt: new Date().toISOString(),
    seed: payload.seed,
    setup: payload.setup,
    history: payload.history ?? [],
  }
  const pace = payload.presentationSpeedProfile
  if (pace === 'cinematic' || pace === 'brisk') {
    envelope.presentationSpeedProfile = pace
  }
  return envelope
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
  if ('presentationSpeedProfile' in raw) {
    const pace = raw.presentationSpeedProfile
    if (pace !== 'cinematic' && pace !== 'brisk') {
      return { ok: false, errorCode: 'INVALID_REPLAY' }
    }
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
