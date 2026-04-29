import { ACTION_TYPES, getLegalActions } from '../engine/kernel.js'

const WEIGHTS = {
  [ACTION_TYPES.DRAW]: 5,
  [ACTION_TYPES.SACRIFICE]: 3,
  [ACTION_TYPES.PASS]: 1,
}

export function chooseRandombotAction(state, actor) {
  const options = arguments[2] ?? {}
  const weightTable = options.weights ? { ...WEIGHTS, ...options.weights } : WEIGHTS
  const legalActions = getLegalActions(state, actor)
  if (!legalActions.length) return null
  const score = legalActions.map((action) => weightTable[action.type] ?? 1)
  const total = score.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return legalActions[0]
  const sample = ((state.rng.state >>> 0) / 0x100000000) * total
  let cursor = 0
  for (let i = 0; i < legalActions.length; i += 1) {
    cursor += score[i]
    if (sample < cursor) return legalActions[i]
  }
  return legalActions[legalActions.length - 1]
}
