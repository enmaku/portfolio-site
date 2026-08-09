const MIN_SPACING_MS = 5000

/** @type {Promise<void>} */
let chain = Promise.resolve()

/** @type {number} */
let lastUpstreamAt = 0

/**
 * Serialize upstream BGG calls with ~5s spacing per functions instance.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function withBggRateLimit(fn) {
  const run = async () => {
    const now = Date.now()
    const waitMs = Math.max(0, MIN_SPACING_MS - (now - lastUpstreamAt))
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
    lastUpstreamAt = Date.now()
    return fn()
  }

  const next = chain.then(run, run)
  chain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

module.exports = {
  withBggRateLimit,
}
