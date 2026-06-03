/** @type {{ runToken: string, promise: Promise<{ runToken: string, action: object|null }> } | null} */
let prefetchEntry = null
/** @type {string | null} */
let lastPrefetchSkipLogKey = null

export function resetAiTurnPrefetch() {
  prefetchEntry = null
  lastPrefetchSkipLogKey = null
}

export function cancelAiTurnPrefetch() {
  prefetchEntry = null
}

/**
 * @param {{
 *   runToken: string
 *   compute: () => Promise<object|null>
 *   trace?: (step: string, detail?: Record<string, unknown>) => void
 *   mayPrefetch?: boolean
 *   prefetchSkipReason?: string | null
 * }} params
 */
export function startAiTurnPrefetch({
  runToken,
  compute,
  trace,
  mayPrefetch = true,
  prefetchSkipReason = null,
}) {
  if (!runToken) return
  if (!mayPrefetch) {
    trace?.('prefetch.skip', { reason: prefetchSkipReason ?? 'blocked', runToken })
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
 * @param {{
 *   runToken: string
 *   trace?: (step: string, detail?: Record<string, unknown>) => void
 *   mayPrefetch?: boolean
 *   prefetchSkipReason?: string | null
 * }} params
 * @returns {Promise<object|null>}
 */
export async function consumeAiTurnPrefetch({
  runToken,
  trace,
  mayPrefetch = true,
  prefetchSkipReason = null,
}) {
  if (!mayPrefetch) {
    trace?.('prefetch.consume.blocked', {
      runToken,
      reason: prefetchSkipReason ?? 'blocked',
    })
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
