function queueSnapshotMetrics(snapshot = []) {
  return {
    activeKind: snapshot[0]?.kind ?? null,
    queueMs: snapshot.reduce((sum, item) => sum + item.remainingMs, 0),
    queueKinds: snapshot.map((item) => item.kind),
  }
}

export function buildAiTurnScheduleSkipTrace(gate, context = {}) {
  const reason = gate.scheduleSkipReason
  if (!reason) return null

  const { runToken, phase, activeSeatId, presentationQueueSnapshot = [] } = context

  if (reason === 'gameplay-locked') {
    return {
      reason,
      detail: {
        ...queueSnapshotMetrics(presentationQueueSnapshot),
        runToken,
      },
    }
  }
  if (reason === 'model-recovering') {
    return { reason, detail: { activeSeatId: activeSeatId ?? null } }
  }
  if (reason === 'phase-not-actionable') {
    return { reason, detail: { phase: phase ?? null } }
  }
  if (reason === 'already-applied-token' || reason === 'timer-pending') {
    return { reason, detail: { runToken } }
  }
  return { reason, detail: {} }
}

export function buildAiTurnRunSkipTrace(gate, context = {}) {
  const reason = gate.runSkipReason
  if (!reason) return null

  const {
    runToken,
    seatId,
    humanSeatId,
    phase,
    activePresentationKind,
    queueMs,
    lastAppliedAiTurnToken,
  } = context

  if (reason === 'gameplay-locked') {
    return {
      step: 'run.skip',
      detail: {
        reason,
        activePresentation: activePresentationKind ?? null,
        queueMs: queueMs ?? 0,
      },
    }
  }
  if (reason === 'phase-not-actionable') {
    return { step: 'run.skip', detail: { reason, phase: phase ?? null } }
  }
  if (reason === 'not-ai-seat') {
    return { step: 'run.skip', detail: { reason, seatId, humanSeatId } }
  }
  if (reason === 'model-recovering') {
    return { step: 'run.skip', detail: { reason, seatId } }
  }
  if (reason === 'duplicate-token') {
    return { step: 'run.skip', detail: { reason, runToken, lastAppliedAiTurnToken } }
  }
  return { step: 'run.skip', detail: { reason } }
}

export function buildAiTurnPrefetchSkipTrace(gate, context = {}) {
  const reason = gate.prefetchSkipReason
  if (!reason) return null

  const { seatId, phase, runToken, modelId, roleType } = context

  if (reason === 'not-ai-seat') {
    return { reason, detail: { seatId } }
  }
  if (reason === 'phase') {
    return { reason, detail: { phase } }
  }
  if (reason === 'token-not-ready') {
    return { reason, detail: { runToken } }
  }
  if (reason === 'not-nn-seat') {
    return { reason, detail: { roleType } }
  }
  if (reason === 'neural-refresh-terminal' || reason === 'model-recovering') {
    return { reason, detail: { modelId } }
  }
  return { reason, detail: {} }
}
