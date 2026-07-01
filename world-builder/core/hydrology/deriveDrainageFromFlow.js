/**
 * Normalize flow accumulation into a drainage scalar field in [0, 1].
 * @param {Float32Array} flowAccumulation
 * @returns {Float32Array}
 */
export function deriveDrainageFromFlow(flowAccumulation) {
  const out = new Float32Array(flowAccumulation.length)
  let maxFlow = 0

  for (let i = 0; i < flowAccumulation.length; i += 1) {
    if (flowAccumulation[i] > maxFlow) {
      maxFlow = flowAccumulation[i]
    }
  }

  if (maxFlow <= 0) {
    return out
  }

  for (let i = 0; i < flowAccumulation.length; i += 1) {
    out[i] = flowAccumulation[i] / maxFlow
  }

  return out
}
