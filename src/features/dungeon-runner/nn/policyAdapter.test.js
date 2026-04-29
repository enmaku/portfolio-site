import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTION_TYPES, createInitialMatchState, getLegalActions } from '../engine/kernel.js'
import {
  OBS_DIM,
  POLICY_INDEX,
  POLICY_ACTIONS,
  buildPolicyObservation,
  buildPolicyLegalMask,
  decodePolicyIndexToAction,
} from './policyAdapter.js'

test('policy observation stays fixed at 87 dimensions', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 1 })
  const seatId = state.turn.activeSeatId
  const obs = buildPolicyObservation(state, { seatId })
  assert.equal(obs.length, OBS_DIM)
  assert.equal(obs.every((value) => Number.isFinite(value)), true)
})

test('policy legal mask maps canonical legal actions into 26-index space', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 2 })
  const seatId = state.turn.activeSeatId
  const legal = getLegalActions(state, { seatId })
  const mask = buildPolicyLegalMask(state, { seatId }, legal)
  assert.equal(mask.length, POLICY_ACTIONS)
  assert.equal(mask[POLICY_INDEX.PASS], 1)
  assert.equal(mask[POLICY_INDEX.DRAW], 1)
  assert.equal(mask[POLICY_INDEX.ADD], 0)
})

test('policy decoder supports indexed sacrifice slots', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 3 })
  const seatId = state.turn.activeSeatId
  const legal = getLegalActions(state, { seatId })
  const drawResult = {
    ...state,
    bidding: {
      ...state.bidding,
      revealedMonsterCard: 'goblin',
      revealedBySeatId: seatId,
    },
  }
  const drawLegal = getLegalActions(drawResult, { seatId })
  const sacrifice = decodePolicyIndexToAction(POLICY_INDEX.SACRIFICE_BASE, drawLegal)
  assert.equal(sacrifice.type, ACTION_TYPES.SACRIFICE)
  assert.equal(typeof sacrifice.equipmentId, 'string')
  assert.equal(legal.some((action) => action.type === ACTION_TYPES.SACRIFICE), false)
})

test('policy sacrifice slot mapping follows python slot order semantics', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 33 })
  const seatId = state.turn.activeSeatId
  const pendingState = {
    ...state,
    bidding: {
      ...state.bidding,
      revealedMonsterCard: 'goblin',
      revealedBySeatId: seatId,
    },
  }
  const legal = getLegalActions(pendingState, { seatId })
  const action = decodePolicyIndexToAction(POLICY_INDEX.SACRIFICE_BASE + 1, legal, pendingState, { seatId })
  assert.equal(action?.type, ACTION_TYPES.SACRIFICE)
  assert.equal(action?.equipmentId, 'W_SHIELD')
  const mask = buildPolicyLegalMask(pendingState, { seatId }, legal)
  assert.equal(mask[POLICY_INDEX.SACRIFICE_BASE + 1], 1)
})

test('policy sacrifice slots use hero-specific loadout order', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 34 })
  const seatId = state.turn.activeSeatId
  const barbarianState = {
    ...state,
    hero: 'BARBARIAN',
    centerEquipment: ['B_HEAL', 'B_SHIELD', 'B_CHAIN', 'B_AXE', 'B_TORCH', 'B_HAMMER'],
    heroLoadout: {
      ...state.heroLoadout,
      [seatId]: ['B_HEAL', 'B_SHIELD', 'B_CHAIN', 'B_AXE', 'B_TORCH', 'B_HAMMER'],
    },
    bidding: {
      ...state.bidding,
      revealedMonsterCard: 'goblin',
      revealedBySeatId: seatId,
    },
  }
  const legal = getLegalActions(barbarianState, { seatId })
  const action = decodePolicyIndexToAction(POLICY_INDEX.SACRIFICE_BASE + 3, legal, barbarianState, { seatId })
  assert.equal(action?.type, ACTION_TYPES.SACRIFICE)
  assert.equal(action?.equipmentId, 'B_AXE')
})

test('policy codec maps pick-adventurer slots', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 4 })
  const seatId = state.turn.activeSeatId
  const pickState = {
    ...state,
    phase: 'pick-adventurer',
    turn: { ...state.turn, activeSeatId: seatId },
  }
  const legal = getLegalActions(pickState, { seatId })
  const mask = buildPolicyLegalMask(pickState, { seatId }, legal)
  assert.equal(mask[POLICY_INDEX.PICK_HERO_BASE], 1)
  const action = decodePolicyIndexToAction(POLICY_INDEX.PICK_HERO_BASE + 2, legal)
  assert.equal(action.type, ACTION_TYPES.CHOOSE_NEXT_ADVENTURER)
  assert.equal(action.hero, 'MAGE')
})

test('policy codec maps dungeon decision slots', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 5 })
  const seatId = state.turn.activeSeatId
  const dungeonState = {
    ...state,
    phase: 'dungeon',
    turn: { ...state.turn, activeSeatId: seatId },
    bidding: { ...state.bidding, runnerSeatId: seatId },
    dungeon: { ...state.dungeon, subphase: 'pick-fire-axe' },
  }
  const legal = getLegalActions(dungeonState, { seatId })
  const mask = buildPolicyLegalMask(dungeonState, { seatId }, legal)
  assert.equal(mask[POLICY_INDEX.FIRE_AXE], 1)
  assert.equal(mask[POLICY_INDEX.DECLINE_FIRE_AXE], 1)
  assert.equal(decodePolicyIndexToAction(POLICY_INDEX.FIRE_AXE, legal).type, ACTION_TYPES.USE_FIRE_AXE)
})

test('policy observation encodes bidding pending and pending-card strength', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 6 })
  const seatId = state.turn.activeSeatId
  const pendingState = {
    ...state,
    bidding: {
      ...state.bidding,
      subphase: 'pending',
      revealedBySeatId: seatId,
      revealedMonsterCard: 'dragon',
      revealedMonsterStrength: 9,
    },
  }
  const obs = buildPolicyObservation(pendingState, { seatId })
  assert.deepEqual(obs.slice(4, 6), [0, 1])
  assert.equal(obs[52], 1)
})

test('policy observation encodes dungeon subphase and runner-only block', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 7 })
  const seatId = state.turn.activeSeatId
  const dungeonState = {
    ...state,
    phase: 'dungeon',
    turn: { ...state.turn, activeSeatId: seatId },
    bidding: { ...state.bidding, runnerSeatId: seatId, dungeonMonsters: ['goblin', 'orc'] },
    dungeon: {
      ...state.dungeon,
      subphase: 'pick-polymorph',
      currentMonster: 'orc',
      remainingMonsters: ['orc'],
      hp: 12,
      inPlayEquipmentIds: ['W_PLATE', 'W_SHIELD'],
      polySpent: true,
      axeSpent: false,
    },
  }
  const obs = buildPolicyObservation(dungeonState, { seatId })
  assert.deepEqual(obs.slice(6, 10), [0, 0, 0, 1])
  assert.equal(obs[67], 1)
  assert.equal(obs.slice(69, 77).some((value) => value > 0), true)
})

test('policy observation uses center-equipment and full-deck normalization', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 8 })
  const seatId = state.turn.activeSeatId
  const obs = buildPolicyObservation(state, { seatId })
  assert.equal(obs[36], 1)
  assert.deepEqual(obs.slice(38, 44), [1, 1, 1, 1, 1, 1])
})

test('policy observation encodes own pile species counts', () => {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }, { seed: 9 })
  const seatId = state.turn.activeSeatId
  const custom = {
    ...state,
    playerOwnPileAdds: {
      ...state.playerOwnPileAdds,
      [seatId]: ['goblin', 'skeleton', 'goblin'],
    },
  }
  const obs = buildPolicyObservation(custom, { seatId })
  assert.equal(obs[59], 1)
  assert.equal(obs[60], 0.5)
})
