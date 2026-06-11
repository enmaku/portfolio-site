/**
 * Stub `Date.now` for deterministic timer tests.
 * @template T
 * @param {number} startMs
 * @param {(advance: (ms: number) => void) => T} run
 * @returns {T}
 */
export function withFakeNow(startMs, run) {
  const originalNow = Date.now
  let now = startMs
  Date.now = () => now
  const advance = (ms) => {
    now += ms
  }
  try {
    return run(advance)
  } finally {
    Date.now = originalNow
  }
}
