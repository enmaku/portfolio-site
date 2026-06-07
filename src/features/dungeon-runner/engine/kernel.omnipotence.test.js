import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACTION_TYPES,
  DUNGEON_SUBPHASES,
  MATCH_PHASES,
  applyAction,
  createInitialMatchState,
} from './kernel.js'
import { DUNGEON_RUN_WIN_VIA } from './omnipotencePolicy.js'

/**
 * @param {object} params
 * @param {ReturnType<typeof createInitialMatchState>} params.base
 * @param {string} params.seatId
 * @param {readonly string[]} params.dungeonMonsters
 * @param {readonly string[]} [params.discardedMonsterCards]
 * @param {readonly string[]} params.inPlayEquipmentIds
 * @param {number} params.hp
 * @param {readonly string[]} [params.remainingMonsters]
 * @param {readonly string[]} [params.discardedRunMonsters]
 * @param {string} [params.hero]
 */
function buildLethalRevealState({
  base,
  seatId,
  dungeonMonsters,
  discardedMonsterCards = [],
  inPlayEquipmentIds,
  hp,
  remainingMonsters,
  discardedRunMonsters = [],
  hero = 'MAGE',
}) {
  const pile = remainingMonsters ?? [...dungeonMonsters]
  return {
    ...base,
    hero,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...base.turn, activeSeatId: seatId },
    bidding: {
      ...base.bidding,
      runnerSeatId: seatId,
      dungeonMonsters: [...dungeonMonsters],
      discardedMonsterCards: [...discardedMonsterCards],
    },
    dungeon: {
      ...base.dungeon,
      subphase: DUNGEON_SUBPHASES.REVEAL,
      currentMonster: null,
      remainingMonsters: [...pile],
      omnipotenceSet: [...dungeonMonsters],
      hp,
      inPlayEquipmentIds: [...inPlayEquipmentIds],
      polySpent: true,
      axeSpent: true,
      discardedRunMonsters: [...discardedRunMonsters],
    },
  }
}

test('omnipotence wins when sacrifice discards duplicate species not in the dungeon pile', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7001 },
  )
  const seatId = base.seats[0].id
  const state = buildLethalRevealState({
    base,
    seatId,
    dungeonMonsters: ['goblin', 'orc', 'dragon'],
    discardedMonsterCards: ['goblin'],
    inPlayEquipmentIds: ['M_OMNI'],
    hp: 1,
    remainingMonsters: ['goblin'],
  })
  const result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.equal(result.state.lastDungeonRun?.result, 'success')
  assert.equal(result.state.scoreboard[seatId].successes, 1)
})

test('omnipotence fails when initial pile has duplicate species', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7002 },
  )
  const seatId = base.seats[0].id
  const state = buildLethalRevealState({
    base,
    seatId,
    dungeonMonsters: ['goblin', 'goblin', 'orc'],
    inPlayEquipmentIds: ['M_OMNI'],
    hp: 1,
    remainingMonsters: ['goblin'],
  })
  const result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.equal(result.state.lastDungeonRun?.result, 'failure')
  assert.equal(result.state.scoreboard[seatId].lives, 1)
})

test('lethal combat fails ordinarily when M_OMNI is not in play', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7003 },
  )
  const seatId = base.seats[0].id
  const state = buildLethalRevealState({
    base,
    seatId,
    dungeonMonsters: ['goblin', 'orc', 'dragon'],
    inPlayEquipmentIds: ['M_WALL'],
    hp: 1,
    remainingMonsters: ['goblin'],
  })
  const result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.lastDungeonRun?.result, 'failure')
})

test('omnipotence is gated by M_OMNI in play rather than adventurer identity', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7004 },
  )
  const seatId = base.seats[0].id
  const state = buildLethalRevealState({
    base,
    seatId,
    hero: 'WARRIOR',
    dungeonMonsters: ['goblin', 'orc', 'dragon'],
    inPlayEquipmentIds: ['M_OMNI'],
    hp: 1,
    remainingMonsters: ['goblin'],
  })
  const result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.lastDungeonRun?.result, 'success')
})

test('healing potion revives before omnipotence alternate win is considered', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7005 },
  )
  const seatId = base.seats[0].id
  const state = buildLethalRevealState({
    base,
    seatId,
    hero: 'ROGUE',
    dungeonMonsters: ['goblin', 'orc', 'dragon'],
    inPlayEquipmentIds: ['R_HEAL', 'M_OMNI'],
    hp: 1,
    remainingMonsters: ['goblin', 'dragon'],
  })
  const result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.DUNGEON)
  assert.equal(result.state.dungeon.hp, 3)
  assert.equal(result.state.dungeon.remainingMonsters.length, 1)
  assert.equal(result.state.dungeon.inPlayEquipmentIds.includes('R_HEAL'), false)
  assert.equal(result.state.dungeon.inPlayEquipmentIds.includes('M_OMNI'), true)
  assert.equal(result.state.lastDungeonRun, null)
})

test('lane removals do not shrink the omnipotence set used at defeat', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7006 },
  )
  const seatId = base.seats[0].id
  const state = buildLethalRevealState({
    base,
    seatId,
    dungeonMonsters: ['goblin', 'orc', 'dragon'],
    inPlayEquipmentIds: ['M_OMNI'],
    hp: 1,
    remainingMonsters: ['dragon'],
    discardedRunMonsters: ['goblin', 'orc'],
  })
  const result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.lastDungeonRun?.result, 'success')
})

test('omnipotence success records winVia metadata on lastDungeonRun', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7007 },
  )
  const seatId = base.seats[0].id
  const state = buildLethalRevealState({
    base,
    seatId,
    dungeonMonsters: ['goblin', 'orc', 'dragon'],
    inPlayEquipmentIds: ['M_OMNI'],
    hp: 1,
    remainingMonsters: ['goblin'],
  })
  const result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.lastDungeonRun?.winVia, DUNGEON_RUN_WIN_VIA.OMNIPOTENCE)
})

test('normal dungeon clear omits winVia on lastDungeonRun', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 7008 },
  )
  const seatId = base.seats[0].id
  const state = {
    ...base,
    hero: 'MAGE',
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...base.turn, activeSeatId: seatId },
    bidding: {
      ...base.bidding,
      runnerSeatId: seatId,
      dungeonMonsters: ['goblin'],
    },
    dungeon: {
      ...base.dungeon,
      subphase: DUNGEON_SUBPHASES.PICK_POLYMORPH,
      currentMonster: 'goblin',
      remainingMonsters: [],
      omnipotenceSet: ['goblin'],
      hp: 20,
      inPlayEquipmentIds: ['M_POLY'],
      polySpent: false,
    },
  }
  const result = applyAction(state, { type: ACTION_TYPES.USE_POLYMORPH }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.lastDungeonRun?.result, 'success')
  assert.equal(result.state.lastDungeonRun?.winVia, undefined)
})
