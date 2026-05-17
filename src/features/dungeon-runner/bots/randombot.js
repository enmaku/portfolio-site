import {
  ACTION_TYPES,
  BIDDING_SUBPHASES,
  getLegalActions,
  getMonsterStrength,
  MATCH_PHASES,
} from '../engine/kernel.js'

const PASS_WEIGHT_GROWTH_PER_DUNGEON_CARD = 0.14
const SACRIFICE_WEIGHT_DECAY_PER_EQUIP_REMOVED = 0.58
const SACRIFICE_STRENGTH_MIN = 0.2
const SACRIFICE_STRENGTH_SCALE = 0.14

function strengthDrivenWeight(strength) {
  return Math.max(SACRIFICE_STRENGTH_MIN, SACRIFICE_STRENGTH_SCALE * strength)
}

function simPassWeight(state, passWeight) {
  if (state.phase !== MATCH_PHASES.BIDDING) return passWeight
  const pile = state.bidding?.dungeonMonsters?.length ?? 0
  return passWeight * (1 + PASS_WEIGHT_GROWTH_PER_DUNGEON_CARD * pile)
}

function simSacrificeWeight(state, sacrificeWeight) {
  if (state.phase !== MATCH_PHASES.BIDDING || state.bidding?.subphase !== BIDDING_SUBPHASES.PENDING) {
    return sacrificeWeight
  }
  const n = state.bidding?.discardedMonsterCards?.length ?? 0
  return sacrificeWeight * SACRIFICE_WEIGHT_DECAY_PER_EQUIP_REMOVED ** n
}

function sacrificePendingStrengthFactor(state) {
  if (state.phase !== MATCH_PHASES.BIDDING || state.bidding?.subphase !== BIDDING_SUBPHASES.PENDING) {
    return 1
  }
  if (!state.bidding?.revealedMonsterCard) return 1
  const strength =
    state.bidding.revealedMonsterStrength ?? getMonsterStrength(state.bidding.revealedMonsterCard)
  return strengthDrivenWeight(strength)
}

function pythonStyleBaseWeight(action, state, passWeight, sacrificeWeight) {
  if (action.type === ACTION_TYPES.PASS) return simPassWeight(state, passWeight)
  if (action.type === ACTION_TYPES.SACRIFICE) {
    let w0 = simSacrificeWeight(state, sacrificeWeight)
    w0 *= sacrificePendingStrengthFactor(state)
    return Math.max(1e-9, w0)
  }
  if (action.type === ACTION_TYPES.DECLARE_VORPAL) {
    const st = action.species != null ? getMonsterStrength(action.species) : 3
    return Math.max(1e-9, strengthDrivenWeight(st))
  }
  return 1
}

/** `options.weights` multiplies per action.type after the Python-style base weight (JS-only, for tests / tuning). */
export function computeRandombotActionWeight(state, action, options = {}) {
  const passWeight = options.passWeight ?? 0.2
  const sacrificeWeight = options.sacrificeWeight ?? 0.03
  const base = pythonStyleBaseWeight(action, state, passWeight, sacrificeWeight)
  const mult = options.weights?.[action.type] ?? 1
  return base * mult
}

export function chooseRandombotAction(state, actor) {
  const options = arguments[2] ?? {}
  const legalActions = getLegalActions(state, actor)
  if (!legalActions.length) return null
  const score = legalActions.map((action) => computeRandombotActionWeight(state, action, options))
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
