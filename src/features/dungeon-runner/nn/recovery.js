export function createModelFailureRecovery(options = {}) {
  const threshold = options.threshold ?? 2
  const cooldownMs = options.cooldownMs ?? 30_000
  const now = options.now ?? Date.now
  const stateByModelId = new Map()

  function getState(modelId) {
    const current = stateByModelId.get(modelId) ?? { failures: 0, cooldownUntil: 0 }
    stateByModelId.set(modelId, current)
    return current
  }

  return {
    recordFailure(modelId) {
      const state = getState(modelId)
      state.failures += 1
      if (state.failures >= threshold) {
        state.cooldownUntil = now() + cooldownMs
        state.failures = 0
      }
    },
    isCoolingDown(modelId) {
      const state = getState(modelId)
      return now() < state.cooldownUntil
    },
  }
}
