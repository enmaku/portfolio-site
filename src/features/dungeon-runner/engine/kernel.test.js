import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACTION_TYPES,
  BIDDING_SUBPHASES,
  DUNGEON_SUBPHASES,
  MATCH_PHASES,
  applyAction,
  createInitialMatchState,
  getLegalActions,
  getPlayerView,
} from './kernel.js'
import { TEST_GATE_THRESHOLDS, getDeterminismGateSeeds } from '../test-gates.js'

test('createInitialMatchState is deterministic for same seed and setup', () => {
  const setup = {
    totalSeats: 4,
    opponents: [
      { type: 'randombot' },
      { type: 'nn', modelId: 'latest' },
      { type: 'randombot' },
    ],
  }
  const a = createInitialMatchState(setup, { seed: 4242 })
  const b = createInitialMatchState(setup, { seed: 4242 })
  assert.deepEqual(a, b)
})

test('createInitialMatchState includes rng progression metadata baseline', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 12 },
  )
  assert.equal(typeof state.rng.seed, 'number')
  assert.equal(typeof state.rng.state, 'number')
  assert.equal(state.rng.step >= 0, true)
})

test('createInitialMatchState enforces core seat invariants across 2-4 seats', () => {
  for (const totalSeats of [2, 3, 4]) {
    const opponents = Array.from({ length: totalSeats - 1 }, (_, index) =>
      index % 2 === 0 ? { type: 'randombot' } : { type: 'nn', modelId: 'latest' },
    )
    const state = createInitialMatchState({ totalSeats, opponents }, { seed: 2026 + totalSeats })
    assert.equal(state.seats.length, totalSeats)
    assert.equal(new Set(state.seats.map((seat) => seat.id)).size, totalSeats)
    assert.equal(new Set(state.seats.map((seat) => seat.label)).size, totalSeats)
    assert.equal(state.seats.filter((seat) => seat.role.type === 'human').length, 1)
    assert.equal(
      state.seats.filter((seat) => seat.role.type === 'nn' || seat.role.type === 'randombot').length,
      totalSeats - 1,
    )
  }
})

test('getLegalActions returns canonical actions for active seat only', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 3,
      opponents: [{ type: 'randombot' }, { type: 'nn', modelId: 'latest' }],
    },
    { seed: 77 },
  )
  const activeSeatId = state.turn.activeSeatId
  const activeActions = getLegalActions(state, { seatId: activeSeatId })
  assert.equal(activeActions.some((action) => action.type === ACTION_TYPES.PASS), true)
  assert.equal(activeActions.some((action) => action.type === ACTION_TYPES.DRAW), true)

  const otherSeatId = state.seats.find((seat) => seat.id !== activeSeatId)?.id
  assert.ok(otherSeatId)
  assert.deepEqual(getLegalActions(state, { seatId: otherSeatId }), [])
})

test('engine exposes python-parity phase and subphase constants', () => {
  assert.equal(MATCH_PHASES.BIDDING, 'bidding')
  assert.equal(MATCH_PHASES.DUNGEON, 'dungeon')
  assert.equal(MATCH_PHASES.PICK_ADVENTURER, 'pick-adventurer')
  assert.equal(BIDDING_SUBPHASES.PENDING, 'pending')
  assert.equal(DUNGEON_SUBPHASES.REVEAL, 'reveal')
})

test('pick-adventurer phase exposes choose-next-adventurer actions', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 620 },
  )
  const state = {
    ...base,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    turn: { ...base.turn, activeSeatId: base.seats[0].id },
  }
  const legal = getLegalActions(state, { seatId: state.turn.activeSeatId })
  assert.equal(legal.length, 4)
  assert.equal(legal.every((action) => action.type === ACTION_TYPES.CHOOSE_NEXT_ADVENTURER), true)
})

test('dungeon subphases expose python-style legal action intents', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 621 },
  )
  const runner = base.seats[0].id
  const state = {
    ...base,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...base.turn, activeSeatId: runner },
    bidding: { ...base.bidding, runnerSeatId: runner },
    dungeon: { ...base.dungeon, subphase: DUNGEON_SUBPHASES.PICK_FIRE_AXE },
  }
  const legal = getLegalActions(state, { seatId: runner })
  assert.deepEqual(
    legal.map((action) => action.type),
    [ACTION_TYPES.USE_FIRE_AXE, ACTION_TYPES.DECLINE_FIRE_AXE],
  )
})

test('bidding->dungeon transition enters vorpal subphase when dungeon has monsters', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 622 },
  )
  const state = {
    ...base,
    bidding: {
      ...base.bidding,
      dungeonMonsters: ['goblin'],
    },
  }
  const pass = applyAction(state, { type: ACTION_TYPES.PASS }, { seatId: state.turn.activeSeatId })
  assert.equal(pass.ok, true)
  assert.equal(pass.state.phase, MATCH_PHASES.DUNGEON)
  assert.equal(pass.state.dungeon.subphase, DUNGEON_SUBPHASES.VORPAL)
})

test('dungeon decision sequence advances through python-style subphases', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 623 },
  )
  const seatId = base.seats[0].id
  let state = {
    ...base,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...base.turn, activeSeatId: seatId },
    bidding: { ...base.bidding, runnerSeatId: seatId, dungeonMonsters: ['goblin'] },
    dungeon: {
      ...base.dungeon,
      subphase: DUNGEON_SUBPHASES.VORPAL,
      remainingMonsters: ['goblin'],
      hp: 20,
      inPlayEquipmentIds: ['W_PLATE', 'B_AXE', 'M_POLY'],
      polySpent: false,
      axeSpent: false,
    },
  }
  let result = applyAction(state, { type: ACTION_TYPES.DECLARE_VORPAL, species: 'goblin' }, { seatId })
  assert.equal(result.ok, true)
  state = result.state
  assert.equal(state.dungeon.subphase, DUNGEON_SUBPHASES.REVEAL)
  result = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(result.ok, true)
  state = result.state
  assert.equal(state.dungeon.subphase, DUNGEON_SUBPHASES.PICK_FIRE_AXE)
  result = applyAction(state, { type: ACTION_TYPES.DECLINE_FIRE_AXE }, { seatId })
  assert.equal(result.ok, true)
  state = result.state
  assert.equal(state.dungeon.subphase, DUNGEON_SUBPHASES.PICK_POLYMORPH)
  result = applyAction(state, { type: ACTION_TYPES.DECLINE_POLYMORPH }, { seatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.dungeon.subphase, null)
})

test('reveal skips pick-fire-axe when B_AXE not in play (warrior center loadout)', () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 624 },
  )
  const seatId = base.seats[0].id
  const warriorCenter = ['W_PLATE', 'W_SHIELD', 'W_VORPAL', 'W_TORCH', 'W_HOLY', 'W_SPEAR']
  let state = {
    ...base,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...base.turn, activeSeatId: seatId },
    bidding: { ...base.bidding, runnerSeatId: seatId, dungeonMonsters: ['goblin'] },
    dungeon: {
      ...base.dungeon,
      subphase: DUNGEON_SUBPHASES.VORPAL,
      remainingMonsters: ['goblin'],
      hp: 11,
      inPlayEquipmentIds: warriorCenter,
      polySpent: true,
      axeSpent: true,
    },
  }
  state = applyAction(state, { type: ACTION_TYPES.DECLARE_VORPAL, species: 'goblin' }, { seatId }).state
  const reveal = applyAction(state, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId })
  assert.equal(reveal.ok, true)
  assert.equal(reveal.state.dungeon.subphase, null)
  assert.equal(reveal.state.dungeon.hp, 10)
})

test('applyAction rejects invalid actions cleanly', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 99 },
  )
  const activeSeatId = state.turn.activeSeatId
  const result = applyAction(state, { type: 'NOT_A_REAL_ACTION' }, { seatId: activeSeatId })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'INVALID_ACTION')
})

test('applyAction rotates turn and records rng metadata history for canonical action', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 3,
      opponents: [{ type: 'randombot' }, { type: 'randombot' }],
    },
    { seed: 31415 },
  )
  const beforeStep = state.rng.step
  const result = applyAction(state, { type: ACTION_TYPES.PASS }, { seatId: state.turn.activeSeatId })
  assert.equal(result.ok, true)
  assert.equal(result.state.rng.step, beforeStep + 1)
  assert.equal(result.state.history.length, 1)
  assert.equal(result.state.history[0].action.type, ACTION_TYPES.PASS)
  assert.equal(result.state.history[0].rngStepBefore, beforeStep)
  assert.equal(result.state.history[0].rngStepAfter, beforeStep + 1)
})

test('rng lifecycle is monotonic across successive canonical actions', () => {
  const initial = createInitialMatchState(
    {
      totalSeats: 3,
      opponents: [{ type: 'randombot' }, { type: 'randombot' }],
    },
    { seed: 8080 },
  )
  const first = applyAction(initial, { type: ACTION_TYPES.PASS }, { seatId: initial.turn.activeSeatId })
  assert.equal(first.ok, true)
  const second = applyAction(first.state, { type: ACTION_TYPES.PASS }, { seatId: first.state.turn.activeSeatId })
  assert.equal(second.ok, true)
  assert.equal(first.state.rng.step, initial.rng.step + 1)
  assert.equal(second.state.rng.step, first.state.rng.step + 1)
  assert.equal(second.state.history.at(-1).rngStepBefore < second.state.history.at(-1).rngStepAfter, true)
})

test('headless deterministic gate enforces seed sweep and invariants', () => {
  const setup = {
    totalSeats: 4,
    opponents: [{ type: 'randombot' }, { type: 'nn', modelId: 'latest' }, { type: 'randombot' }],
  }
  const seeds = getDeterminismGateSeeds()
  assert.equal(seeds.length >= TEST_GATE_THRESHOLDS.determinismSeedCount, true)
  let invariantsChecked = 0

  for (const seed of seeds) {
    const a = createInitialMatchState(setup, { seed })
    const b = createInitialMatchState(setup, { seed })
    assert.deepEqual(a, b)
    assert.equal(a.seats.length, setup.totalSeats)
    assert.equal(typeof a.turn.activeSeatId, 'string')
    assert.equal(a.seats.some((seat) => seat.id === a.turn.activeSeatId), true)
    assert.equal(Object.keys(a.scoreboard).length, setup.totalSeats)
    assert.equal(a.seats.filter((seat) => seat.role.type === 'human').length, 1)
    invariantsChecked += 6
  }

  assert.equal(invariantsChecked >= TEST_GATE_THRESHOLDS.minimumInvariantChecks, true)
})

test('bidding round ends when all but one seat has passed', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 3,
      opponents: [{ type: 'randombot' }, { type: 'randombot' }],
    },
    { seed: 111 },
  )

  let cursor = state
  for (let i = 0; i < 2; i += 1) {
    const seatId = cursor.turn.activeSeatId
    const result = applyAction(cursor, { type: ACTION_TYPES.PASS }, { seatId })
    assert.equal(result.ok, true)
    cursor = result.state
  }

  assert.equal(cursor.phase, 'dungeon')
  assert.equal(cursor.bidding.runnerSeatId, state.seats[2].id)
  assert.equal(cursor.bidding.passedSeatIds.length, 2)
})

test('bidding ends when all but one non-eliminated seat has passed', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 4,
      opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
    },
    { seed: 444 },
  )
  const eliminatedSeatId = state.seats[3].id
  const seeded = {
    ...state,
    scoreboard: {
      ...state.scoreboard,
      [eliminatedSeatId]: {
        ...state.scoreboard[eliminatedSeatId],
        eliminated: true,
        lives: 0,
      },
    },
  }
  const passA = applyAction(seeded, { type: ACTION_TYPES.PASS }, { seatId: seeded.turn.activeSeatId })
  assert.equal(passA.ok, true)
  const passB = applyAction(passA.state, { type: ACTION_TYPES.PASS }, { seatId: passA.state.turn.activeSeatId })
  assert.equal(passB.ok, true)
  assert.equal(passB.state.phase, 'dungeon')
  assert.equal(passB.state.bidding.runnerSeatId != null, true)
})

test('draw action updates top card only for acting seat view', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 5 },
  )
  const seatId = state.turn.activeSeatId
  const legal = getLegalActions(state, { seatId })
  assert.equal(legal.some((action) => action.type === ACTION_TYPES.DRAW), true)

  const result = applyAction(state, { type: ACTION_TYPES.DRAW }, { seatId })
  assert.equal(result.ok, true)
  const next = result.state
  assert.equal(next.bidding.revealedMonsterCard != null, true)

  const actorView = getPlayerView(next, { seatId })
  assert.equal(actorView.bidding.revealedMonsterCard != null, true)

  const otherSeatId = next.seats.find((seat) => seat.id !== seatId).id
  const otherView = getPlayerView(next, { seatId: otherSeatId })
  assert.equal(otherView.bidding.revealedMonsterCard, null)
})

test('sacrifice action removes selected equipment and advances turn', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 19 },
  )
  const seatId = state.turn.activeSeatId
  const draw = applyAction(state, { type: ACTION_TYPES.DRAW }, { seatId })
  assert.equal(draw.ok, true)

  const sacrifice = applyAction(
    draw.state,
    { type: ACTION_TYPES.SACRIFICE, equipmentId: 'W_TORCH' },
    { seatId },
  )
  assert.equal(sacrifice.ok, true)
  const next = sacrifice.state
  assert.equal(next.turn.activeSeatId !== seatId, true)
  assert.equal(next.heroLoadout[seatId].includes('W_TORCH'), false)
  assert.equal(next.centerEquipment.includes('W_TORCH'), false)
})

test('bidding to dungeon initializes runner dungeon state like Python _end_bidding', () => {
  const initial = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    { seed: 888 },
  )
  let state = initial
  const s1 = state.turn.activeSeatId
  state = applyAction(state, { type: ACTION_TYPES.DRAW }, { seatId: s1 }).state
  state = applyAction(state, { type: ACTION_TYPES.ADD_TO_DUNGEON }, { seatId: s1 }).state
  const s2 = state.turn.activeSeatId
  state = applyAction(state, { type: ACTION_TYPES.DRAW }, { seatId: s2 }).state
  state = applyAction(state, { type: ACTION_TYPES.ADD_TO_DUNGEON }, { seatId: s2 }).state
  const toDungeon = applyAction(state, { type: ACTION_TYPES.PASS }, { seatId: s1 })
  assert.equal(toDungeon.ok, true)
  state = toDungeon.state
  assert.equal(state.phase, MATCH_PHASES.DUNGEON)
  assert.equal(state.bidding.runnerSeatId, s2)
  assert.equal(state.bidding.dungeonMonsters.length, 2)
  const d = state.dungeon
  assert.equal(d.currentMonster, null)
  assert.equal(d.remainingMonsters.length, 2)
  assert.equal(d.subphase, DUNGEON_SUBPHASES.VORPAL)
  assert.equal(d.hp, 3 + 5 + 3)
  assert.equal(d.inPlayEquipmentIds.length, 6)
  assert.equal(d.polySpent, true)
  assert.equal(d.axeSpent, true)
})

test('passed seats are skipped in subsequent bidding turns', () => {
  const initial = createInitialMatchState(
    {
      totalSeats: 4,
      opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
    },
    { seed: 1234 },
  )
  const seatA = initial.turn.activeSeatId
  const passA = applyAction(initial, { type: ACTION_TYPES.PASS }, { seatId: seatA })
  assert.equal(passA.ok, true)
  const seatB = passA.state.turn.activeSeatId
  const passB = applyAction(passA.state, { type: ACTION_TYPES.PASS }, { seatId: seatB })
  assert.equal(passB.ok, true)
  assert.equal(passB.state.turn.activeSeatId !== seatA, true)
  assert.equal(passB.state.turn.activeSeatId !== seatB, true)
})

test('only the revealing seat can see currently revealed monster card', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 3,
      opponents: [{ type: 'randombot' }, { type: 'randombot' }],
    },
    { seed: 777 },
  )
  const actor = state.turn.activeSeatId
  const draw = applyAction(state, { type: ACTION_TYPES.DRAW }, { seatId: actor })
  assert.equal(draw.ok, true)

  const actorView = getPlayerView(draw.state, { seatId: actor })
  assert.equal(actorView.bidding.revealedMonsterCard != null, true)
  for (const seat of draw.state.seats) {
    if (seat.id === actor) continue
    const view = getPlayerView(draw.state, { seatId: seat.id })
    assert.equal(view.bidding.revealedMonsterCard, null)
  }
})

test('revealed monster can be added to dungeon without sacrificing equipment', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 333 },
  )
  const actor = state.turn.activeSeatId
  const draw = applyAction(state, { type: ACTION_TYPES.DRAW }, { seatId: actor })
  assert.equal(draw.ok, true)
  const add = applyAction(draw.state, { type: ACTION_TYPES.ADD_TO_DUNGEON }, { seatId: actor })
  assert.equal(add.ok, true)
  assert.equal(add.state.bidding.dungeonMonsters.length, 1)
  assert.equal(add.state.heroLoadout[actor].length, state.heroLoadout[actor].length)
  assert.equal(add.state.bidding.revealedMonsterCard, null)
})

test('runner can resolve dungeon and gain success on win', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 42 },
  )
  const seatA = state.turn.activeSeatId
  const passA = applyAction(state, { type: ACTION_TYPES.PASS }, { seatId: seatA })
  assert.equal(passA.ok, true)
  assert.equal(passA.state.phase, 'dungeon')
  const runnerId = passA.state.bidding.runnerSeatId
  const resolved = applyAction(passA.state, { type: ACTION_TYPES.ADVANCE_DUNGEON }, { seatId: runnerId })
  assert.equal(resolved.ok, true)
  assert.equal(resolved.state.scoreboard[runnerId].successes, 1)
  assert.equal(resolved.state.phase, 'bidding')
  assert.equal(resolved.state.lastDungeonRun.result, 'success')
  assert.equal(Array.isArray(resolved.state.lastDungeonRun.steps), true)
  assert.equal(resolved.state.lastDungeonRun.steps.length, resolved.state.lastDungeonRun.monsters.length)
  assert.equal(resolved.state.lastDungeonRun.steps.every((step) => step.defeated === true), true)
  assert.equal(resolved.state.history.at(-1).dungeonRunResult, 'success')
})

test('dungeon resolution records failure at first undefeated monster card', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 2001 },
  )
  const runnerId = state.seats[0].id
  const dungeonState = {
    ...state,
    phase: 'dungeon',
    turn: { ...state.turn, activeSeatId: runnerId },
    bidding: {
      ...state.bidding,
      runnerSeatId: runnerId,
      dungeonMonsters: ['goblin', 'orc', 'dragon'],
    },
    heroLoadout: {
      ...state.heroLoadout,
      [runnerId]: ['torch', 'sword'],
    },
  }
  const result = applyAction(dungeonState, { type: ACTION_TYPES.ADVANCE_DUNGEON }, { seatId: runnerId })
  assert.equal(result.ok, true)
  assert.equal(result.state.lastDungeonRun.result, 'failure')
  assert.equal(result.state.lastDungeonRun.steps.length, 3)
  assert.equal(result.state.lastDungeonRun.steps[0].defeated, true)
  assert.equal(result.state.lastDungeonRun.steps[1].defeated, true)
  assert.equal(result.state.lastDungeonRun.steps[2].defeated, false)
})

test('runner failure reduces lives and can eliminate seat', () => {
  const setup = {
    totalSeats: 2,
    opponents: [{ type: 'randombot' }],
  }
  let state = createInitialMatchState(setup, { seed: 9001 })
  let runnerId = null
  for (let i = 0; i < 2; i += 1) {
    const pass = applyAction(state, { type: ACTION_TYPES.PASS }, { seatId: state.turn.activeSeatId })
    assert.equal(pass.ok, true)
    runnerId = pass.state.bidding.runnerSeatId
    const forcedFail = {
      ...pass.state,
      bidding: {
        ...pass.state.bidding,
        dungeonMonsters: ['goblin', 'orc', 'dragon', 'wraith'],
      },
      heroLoadout: {
        ...pass.state.heroLoadout,
        [runnerId]: ['torch'],
      },
    }
    const resolve = applyAction(forcedFail, { type: ACTION_TYPES.ADVANCE_DUNGEON }, { seatId: runnerId })
    assert.equal(resolve.ok, true)
    state = resolve.state
  }
  assert.equal(state.scoreboard[runnerId].lives, 0)
  assert.equal(state.scoreboard[runnerId].eliminated, true)
})

test('match ends when a seat reaches two successes', () => {
  const state = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 1 },
  )
  const runnerId = state.seats[0].id
  const almostWon = {
    ...state,
    phase: 'dungeon',
    turn: { ...state.turn, activeSeatId: runnerId },
    bidding: { ...state.bidding, runnerSeatId: runnerId, discardedMonsterCards: [] },
    scoreboard: {
      ...state.scoreboard,
      [runnerId]: { ...state.scoreboard[runnerId], successes: 1 },
    },
  }
  const result = applyAction(almostWon, { type: ACTION_TYPES.ADVANCE_DUNGEON }, { seatId: runnerId })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, 'match-over')
  assert.equal(result.state.matchWinnerSeatId, runnerId)
})

test('nn action metadata is persisted per seat for backend and fallback tracking', () => {
  const initial = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'nn', modelId: 'latest' }],
    },
    { seed: 700 },
  )
  const seatId = initial.seats.find((seat) => seat.role.type === 'nn')?.id
  assert.ok(seatId)
  const state = {
    ...initial,
    turn: {
      ...initial.turn,
      activeSeatId: seatId,
    },
  }
  const result = applyAction(
    state,
    {
      type: ACTION_TYPES.PASS,
      meta: { backend: 'cpu', modelId: 'latest', fallbackReason: 'ILLEGAL_OUTPUT' },
    },
    { seatId },
  )
  assert.equal(result.ok, true)
  assert.deepEqual(result.state.nnSeatMetadata[seatId], {
    backend: 'cpu',
    modelId: 'latest',
    fallbackReason: 'ILLEGAL_OUTPUT',
  })
})

test('own pile species tracking resets at next bidding round boundary', () => {
  const base = createInitialMatchState(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    { seed: 9100 },
  )
  const runnerId = base.seats[0].id
  const seeded = {
    ...base,
    phase: 'dungeon',
    turn: { ...base.turn, activeSeatId: runnerId },
    bidding: {
      ...base.bidding,
      runnerSeatId: runnerId,
      dungeonMonsters: ['goblin'],
    },
    playerOwnPileAdds: {
      ...base.playerOwnPileAdds,
      [runnerId]: ['goblin', 'orc'],
    },
  }
  const resolved = applyAction(seeded, { type: ACTION_TYPES.ADVANCE_DUNGEON }, { seatId: runnerId })
  assert.equal(resolved.ok, true)
  assert.equal(resolved.state.phase, 'bidding')
  assert.deepEqual(resolved.state.playerOwnPileAdds[runnerId], [])
})
