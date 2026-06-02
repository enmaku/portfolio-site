/** @type {{ runToken: string, promise: Promise<{ runToken: string, action: object|null }> } | null} */
let prefetchEntry = null
/** @type {string | null} */
let lastPrefetchSkipLogKey = null
/** @type {{ isRecovering: (modelId: string) => boolean } | null} */
let prefetchRecoveryGate = null

export function resetAiTurnPrefetch() {
  prefetchEntry = null
  lastPrefetchSkipLogKey = null
}

/**
 * @param {{ isRecovering: (modelId: string) => boolean } | null} gate
 */
export function setAiTurnPrefetchRecoveryGate(gate) {
  prefetchRecoveryGate = gate
}

export function cancelAiTurnPrefetch() {
  prefetchEntry = null
}

/**
 * @param {{
 *   runToken: string
 *   compute: () => Promise<object|null>
 *   trace?: (step: string, detail?: Record<string, unknown>) => void
 * }} params
 */
export function startAiTurnPrefetch({ runToken, compute, trace, modelId }) {
  if (!runToken) return
  if (modelId && prefetchRecoveryGate?.isRecovering(modelId)) {
    trace?.('prefetch.skip', { reason: 'model-recovering', runToken, modelId })
    return
  }
  if (prefetchEntry?.runToken === runToken) {
    const skipKey = `already-in-flight:${runToken}`
    if (lastPrefetchSkipLogKey !== skipKey) {
      lastPrefetchSkipLogKey = skipKey
      trace?.('prefetch.skip', { reason: 'already-in-flight', runToken })
    }
    return
  }
  if (prefetchEntry && prefetchEntry.runToken !== runToken) {
    trace?.('prefetch.supersede', { fromToken: prefetchEntry.runToken, runToken })
    prefetchEntry = null
  }
  lastPrefetchSkipLogKey = null
  trace?.('prefetch.start', { runToken })
  const startMs = performance.now()
  prefetchEntry = {
    runToken,
    promise: compute()
      .then((action) => {
        trace?.('prefetch.done', {
          runToken,
          actionType: action?.type ?? null,
          ms: Math.round(performance.now() - startMs),
        })
        return { runToken, action: action ?? null }
      })
      .catch((error) => {
        trace?.('prefetch.error', {
          runToken,
          message: error instanceof Error ? error.message : String(error),
          ms: Math.round(performance.now() - startMs),
        })
        throw error
      }),
  }
}

/**
 * @param {string} runToken
 * @param {(step: string, detail?: Record<string, unknown>) => void} [trace]
 * @returns {Promise<object|null>}
 */
export async function consumeAiTurnPrefetch(runToken, trace, modelId) {
  if (modelId && prefetchRecoveryGate?.isRecovering(modelId)) {
    trace?.('prefetch.consume.blocked', { runToken, modelId, reason: 'model-recovering' })
    return null
  }
  if (!prefetchEntry || prefetchEntry.runToken !== runToken) {
    trace?.('prefetch.consume.miss', {
      runToken,
      hasEntry: Boolean(prefetchEntry),
      entryToken: prefetchEntry?.runToken ?? null,
    })
    return null
  }
  trace?.('prefetch.consume.await', { runToken })
  const waitStart = performance.now()
  const result = await prefetchEntry.promise
  trace?.('prefetch.consume.resolved', { runToken, waitMs: Math.round(performance.now() - waitStart) })
  prefetchEntry = null
  if (result.runToken !== runToken) {
    trace?.('prefetch.consume.stale', { runToken, resultToken: result.runToken })
    return null
  }
  trace?.('prefetch.consume.hit', { runToken, actionType: result.action?.type ?? null })
  return result.action
}
