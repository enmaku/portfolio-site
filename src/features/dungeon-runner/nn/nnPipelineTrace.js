/**
 * @param {string} channel e.g. 'AITurn' | 'NN'
 * @param {boolean} enabled
 * @param {Record<string, unknown>} [baseContext]
 */
export function createPipelineStepLogger(channel, enabled, baseContext = {}) {
  if (!enabled) return () => {}
  const t0 = performance.now()
  let tLast = t0
  return (step, detail = {}) => {
    const now = performance.now()
    console.log(`[DungeonRunner][${channel}]`, step, {
      ...baseContext,
      ...detail,
      msTotal: Math.round(now - t0),
      msStep: Math.round(now - tLast),
    })
    tLast = now
  }
}
