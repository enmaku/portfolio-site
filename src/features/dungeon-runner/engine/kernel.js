export const ACTION_TYPES = {
  PASS: 'PASS',
  DRAW: 'DRAW',
  ADD_TO_DUNGEON: 'ADD_TO_DUNGEON',
  SACRIFICE: 'SACRIFICE',
  ADVANCE_DUNGEON: 'ADVANCE_DUNGEON',
  CHOOSE_NEXT_ADVENTURER: 'CHOOSE_NEXT_ADVENTURER',
  DECLARE_VORPAL: 'DECLARE_VORPAL',
  REVEAL_OR_CONTINUE: 'REVEAL_OR_CONTINUE',
  USE_FIRE_AXE: 'USE_FIRE_AXE',
  DECLINE_FIRE_AXE: 'DECLINE_FIRE_AXE',
  USE_POLYMORPH: 'USE_POLYMORPH',
  DECLINE_POLYMORPH: 'DECLINE_POLYMORPH',
}

export const MATCH_PHASES = {
  BIDDING: 'bidding',
  DUNGEON: 'dungeon',
  PICK_ADVENTURER: 'pick-adventurer',
  MATCH_OVER: 'match-over',
}

export const BIDDING_SUBPHASES = {
  TURN: 'turn',
  PENDING: 'pending',
}

export const DUNGEON_SUBPHASES = {
  VORPAL: 'vorpal',
  REVEAL: 'reveal',
  PICK_FIRE_AXE: 'pick-fire-axe',
  PICK_POLYMORPH: 'pick-polymorph',
}

/**
 * @param {number} seed
 * @returns {{seed:number,state:number,step:number}}
 */
function createRng(seed) {
  const normalizedSeed = Number(seed) >>> 0
  return {
    seed: normalizedSeed,
    state: normalizedSeed || 1,
    step: 0,
  }
}

/**
 * @param {{seed:number,state:number,step:number}} rng
 * @returns {{value:number,rng:{seed:number,state:number,step:number}}}
 */
function nextRng(rng) {
  let x = rng.state >>> 0
  x ^= (x << 13) >>> 0
  x ^= x >>> 17
  x ^= (x << 5) >>> 0
  const nextState = x >>> 0
  return {
    value: nextState / 0x100000000,
    rng: {
      seed: rng.seed,
      state: nextState || 1,
      step: rng.step + 1,
    },
  }
}

/**
 * @param {unknown[]} values
 * @param {{seed:number,state:number,step:number}} rng
 */
function shuffle(values, rng) {
  const out = [...values]
  let cursorRng = rng
  for (let i = out.length - 1; i > 0; i -= 1) {
    const next = nextRng(cursorRng)
    cursorRng = next.rng
    const j = Math.floor(next.value * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return { values: out, rng: cursorRng }
}

/**
 * @param {{totalSeats:number,opponents:Array<{type:'nn'|'randombot',modelId?:string}>}} setup
 * @param {{seed:number}} options
 */
export function createInitialMatchState(setup, options) {
  validateSetup(setup)
  const seed = Number(options?.seed ?? 0)
  const rng = createRng(seed)
  const humanSeat = { type: 'human' }
  const roles = [humanSeat, ...setup.opponents.map((opponent) => ({ ...opponent }))]
  const seats = roles.map((role, index) => ({
    id: `seat-${index + 1}`,
    label: `Player ${index + 1}`,
    role,
  }))
  return {
    schemaVersion: 1,
    phase: MATCH_PHASES.BIDDING,
    hero: 'WARRIOR',
    seats,
    turn: {
      activeSeatId: seats[0]?.id ?? null,
      turnNumber: 0,
    },
    heroLoadout: Object.fromEntries(seats.map((seat) => [seat.id, [...BASE_HERO_LOADOUT]])),
    centerEquipment: [...BASE_HERO_LOADOUT],
    successCardsLeft: 5,
    scoreboard: Object.fromEntries(
      seats.map((seat) => [
        seat.id,
        {
          successes: 0,
          lives: 2,
          eliminated: false,
        },
      ]),
    ),
    matchWinnerSeatId: null,
    lastDungeonRun: null,
    nnSeatMetadata: {},
    bidding: {
      subphase: BIDDING_SUBPHASES.TURN,
      passedSeatIds: [],
      runnerSeatId: null,
      revealedMonsterCard: null,
      revealedMonsterStrength: null,
      revealedMonsterIcons: [],
      revealedBySeatId: null,
      monsterDeck: createInitialMonsterDeck(),
      dungeonMonsters: [],
      discardedMonsterCards: [],
    },
    dungeon: {
      subphase: null,
      currentMonster: null,
      remainingMonsters: [],
      hp: 0,
      inPlayEquipmentIds: [],
      polySpent: false,
      axeSpent: false,
    },
    pickAdventurer: {
      activeSeatId: null,
    },
    playerOwnPileAdds: Object.fromEntries(seats.map((seat) => [seat.id, []])),
    rng,
    history: [],
  }
}

export function shuffleMatchDeck(state, options) {
  const seed = Number(options?.seed ?? state?.rng?.seed ?? 0) >>> 0
  const shuffled = shuffle(state.bidding.monsterDeck ?? [], createRng(seed))
  return {
    ...state,
    bidding: {
      ...state.bidding,
      monsterDeck: shuffled.values,
    },
  }
}

export function shuffleMatchSeats(state, options) {
  const seed = Number(options?.seed ?? state?.rng?.seed ?? 0) >>> 0
  const shuffled = shuffle(state.seats ?? [], createRng(seed))
  return {
    ...state,
    seats: shuffled.values.map((seat) => ({ ...seat })),
  }
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {{seatId:string}} actor
 * @returns {Array<{type:string}>}
 */
export function getLegalActions(state, actor) {
  if (state.turn.activeSeatId !== actor.seatId) return []
  if (state.phase === MATCH_PHASES.DUNGEON) {
    if (state.dungeon?.subphase === DUNGEON_SUBPHASES.VORPAL) {
      return MONSTER_SPECIES.map((species) => ({ type: ACTION_TYPES.DECLARE_VORPAL, species }))
    }
    if (state.dungeon?.subphase === DUNGEON_SUBPHASES.REVEAL) {
      return [{ type: ACTION_TYPES.REVEAL_OR_CONTINUE }]
    }
    if (state.dungeon?.subphase === DUNGEON_SUBPHASES.PICK_FIRE_AXE) {
      return [{ type: ACTION_TYPES.USE_FIRE_AXE }, { type: ACTION_TYPES.DECLINE_FIRE_AXE }]
    }
    if (state.dungeon?.subphase === DUNGEON_SUBPHASES.PICK_POLYMORPH) {
      return [{ type: ACTION_TYPES.USE_POLYMORPH }, { type: ACTION_TYPES.DECLINE_POLYMORPH }]
    }
    return [{ type: ACTION_TYPES.ADVANCE_DUNGEON }]
  }
  if (state.phase === MATCH_PHASES.PICK_ADVENTURER) {
    return ADVENTURERS.map((hero) => ({ type: ACTION_TYPES.CHOOSE_NEXT_ADVENTURER, hero }))
  }
  if (state.phase !== MATCH_PHASES.BIDDING) return []

  if (state.bidding.revealedMonsterCard) {
    const actions = [{ type: ACTION_TYPES.ADD_TO_DUNGEON }]
    const equipment = state.heroLoadout[actor.seatId] ?? []
    for (const equipmentId of equipment) {
      actions.push({ type: ACTION_TYPES.SACRIFICE, equipmentId })
    }
    return actions
  }
  const actions = [{ type: ACTION_TYPES.PASS }]
  if (state.bidding.monsterDeck.length > 0) {
    actions.push({ type: ACTION_TYPES.DRAW })
  }
  return actions
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {{type:string}} action
 * @param {{seatId:string}} actor
 */
export function applyAction(state, action, actor) {
  const legalActions = getLegalActions(state, actor)
  const isLegal = legalActions.some(
    (candidate) =>
      candidate.type === action.type &&
      (candidate.equipmentId === undefined || candidate.equipmentId === action.equipmentId),
  )
  if (!isLegal) return { ok: false, errorCode: 'INVALID_ACTION' }

  const next = nextRng(state.rng)
  let nextState = {
    ...state,
    rng: next.rng,
  }

  if (action.type === ACTION_TYPES.PASS) {
    nextState = applyPassAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.DRAW) {
    nextState = applyDrawAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.ADD_TO_DUNGEON) {
    nextState = applyAddToDungeonAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.SACRIFICE) {
    nextState = applySacrificeAction(nextState, action, actor)
  } else if (action.type === ACTION_TYPES.ADVANCE_DUNGEON) {
    nextState = applyAdvanceDungeonAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.CHOOSE_NEXT_ADVENTURER) {
    nextState = applyChooseNextAdventurerAction(nextState, action, actor)
  } else if (action.type === ACTION_TYPES.DECLARE_VORPAL) {
    nextState = applyDungeonStepAction(nextState, DUNGEON_SUBPHASES.REVEAL)
  } else if (action.type === ACTION_TYPES.REVEAL_OR_CONTINUE) {
    nextState = applyRevealOrContinueAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.USE_FIRE_AXE) {
    nextState = applyFireAxeUseAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.DECLINE_FIRE_AXE) {
    nextState = applyFireAxeDeclineAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.USE_POLYMORPH) {
    nextState = applyPolymorphUseAction(nextState, actor)
  } else if (action.type === ACTION_TYPES.DECLINE_POLYMORPH) {
    nextState = applyPolymorphDeclineAction(nextState, actor)
  }

  if (!nextState) return { ok: false, errorCode: 'INVALID_ACTION' }

  return {
    ok: true,
    state: {
      ...nextState,
      nnSeatMetadata: mergeNnSeatMetadata(state, nextState, action, actor),
      history: [...state.history, createHistoryEntry(state, nextState, action, actor)],
    },
  }
}

export function getPlayerView(state, actor) {
  const canSeeRevealed = state.bidding.revealedBySeatId === actor.seatId
  return {
    ...state,
    bidding: {
      ...state.bidding,
      revealedMonsterCard: canSeeRevealed ? state.bidding.revealedMonsterCard : null,
    },
  }
}

/**
 * @param {{totalSeats:number,opponents:Array<{type:'nn'|'randombot'}>}} setup
 */
function validateSetup(setup) {
  if (!Number.isInteger(setup.totalSeats) || setup.totalSeats < 2 || setup.totalSeats > 4) {
    throw new Error('totalSeats must be an integer between 2 and 4')
  }
  if (!Array.isArray(setup.opponents) || setup.opponents.length !== setup.totalSeats - 1) {
    throw new Error('opponents length must equal totalSeats - 1')
  }
  for (const opponent of setup.opponents) {
    if (opponent.type !== 'nn' && opponent.type !== 'randombot') {
      throw new Error('opponent.type must be nn or randombot')
    }
  }
}

const BASE_HERO_LOADOUT = ['W_PLATE', 'W_SHIELD', 'W_VORPAL', 'W_TORCH', 'W_HOLY', 'W_SPEAR']

const HP_FOR_EQUIP = {
  W_PLATE: 5,
  W_SHIELD: 3,
  W_VORPAL: 0,
  W_TORCH: 0,
  W_HOLY: 0,
  W_SPEAR: 0,
  B_HEAL: 0,
  B_SHIELD: 3,
  B_CHAIN: 4,
  B_AXE: 0,
  B_TORCH: 0,
  B_HAMMER: 0,
  M_WALL: 6,
  M_HOLY: 0,
  M_OMNI: 0,
  M_BRACE: 3,
  M_POLY: 0,
  M_PACT: 0,
  R_ARMOR: 5,
  R_HEAL: 0,
  R_RING: 0,
  R_BUCK: 3,
  R_VORP: 0,
  R_CLOAK: 0,
}
const BASE_HERO_HP = { WARRIOR: 3, BARBARIAN: 4, MAGE: 2, ROGUE: 3 }
const EQUIP_VORPAL_IDS = new Set(['W_VORPAL', 'R_VORP'])
const EQUIP_POLY = 'M_POLY'
const EQUIP_FIRE_AXE = 'B_AXE'
const BASE_MONSTER_DECK = [
  'goblin',
  'goblin',
  'skeleton',
  'skeleton',
  'orc',
  'orc',
  'vampire',
  'vampire',
  'golem',
  'golem',
  'lich',
  'demon',
  'dragon',
]
const ADVENTURERS = ['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE']
const MONSTER_SPECIES = ['goblin', 'skeleton', 'orc', 'vampire', 'golem', 'lich', 'demon', 'dragon']
const MONSTER_STATS = {
  goblin: { strength: 1, icons: ['torch'] },
  skeleton: { strength: 3, icons: ['torch'] },
  orc: { strength: 2, icons: ['hammer'] },
  vampire: { strength: 4, icons: ['chalice'] },
  golem: { strength: 5, icons: ['hammer'] },
  lich: { strength: 6, icons: ['chalice', 'cloak'] },
  demon: { strength: 7, icons: ['pact', 'cloak'] },
  dragon: { strength: 9, icons: ['staff', 'cloak'] },
}

function createInitialMonsterDeck() {
  return [...BASE_MONSTER_DECK]
}

function createHistoryEntry(prevState, nextState, action, actor) {
  return {
    action: { ...action },
    actorSeatId: actor.seatId,
    phaseBefore: prevState.phase,
    phaseAfter: nextState.phase,
    rngStepBefore: prevState.rng.step,
    rngStepAfter: nextState.rng.step,
    dungeonRunResult: nextState.lastDungeonRun?.result ?? null,
  }
}

function hpForEquip(equipmentId) {
  return HP_FOR_EQUIP[equipmentId] ?? 0
}

function baseHeroHp(hero) {
  return BASE_HERO_HP[hero] ?? 3
}

/**
 * Match Python `Match._end_bidding` dungeon init: d_remaining, d_in_play, d_hp, flags, first subphase.
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {typeof state.bidding} nextBidding
 */
function buildDungeonStateOnEnter(state, nextBidding) {
  const hero = state.hero ?? 'WARRIOR'
  const pile = [...(nextBidding.dungeonMonsters ?? [])]
  const inPlay = [...(state.centerEquipment ?? [])]
  const inSet = new Set(inPlay)
  const hp = baseHeroHp(hero) + inPlay.reduce((acc, eid) => acc + hpForEquip(eid), 0)
  const hasVorpal = inPlay.some((eid) => EQUIP_VORPAL_IDS.has(eid))
  let subphase = null
  if (pile.length > 0) {
    subphase = hasVorpal ? DUNGEON_SUBPHASES.VORPAL : DUNGEON_SUBPHASES.REVEAL
  }
  return {
    subphase,
    currentMonster: null,
    remainingMonsters: pile,
    hp,
    inPlayEquipmentIds: inPlay,
    polySpent: !inSet.has(EQUIP_POLY),
    axeSpent: !inSet.has(EQUIP_FIRE_AXE),
  }
}

function applyPassAction(state, actor) {
  const alreadyPassed = state.bidding.passedSeatIds.includes(actor.seatId)
  const passedSeatIds = alreadyPassed
    ? state.bidding.passedSeatIds
    : [...state.bidding.passedSeatIds, actor.seatId]

  const nextBidding = {
    ...state.bidding,
    subphase: BIDDING_SUBPHASES.TURN,
    passedSeatIds,
    revealedMonsterCard: null,
    revealedMonsterStrength: null,
    revealedMonsterIcons: [],
    revealedBySeatId: null,
  }
  const activeSeatIds = state.seats
    .filter((seat) => !state.scoreboard[seat.id]?.eliminated)
    .map((seat) => seat.id)
  const activePassedCount = activeSeatIds.filter((seatId) => passedSeatIds.includes(seatId)).length
  if (activePassedCount >= activeSeatIds.length - 1) {
    const runnerSeatId = activeSeatIds.find((seatId) => !passedSeatIds.includes(seatId)) ?? null
    if (runnerSeatId && state.scoreboard[runnerSeatId]?.eliminated) {
      return state
    }
    return {
      ...state,
      phase: MATCH_PHASES.DUNGEON,
      turn: {
        activeSeatId: runnerSeatId,
        turnNumber: state.turn.turnNumber + 1,
      },
      bidding: {
        ...nextBidding,
        runnerSeatId,
      },
      dungeon: buildDungeonStateOnEnter(state, nextBidding),
    }
  }
  return {
    ...state,
    turn: {
      activeSeatId: findNextActiveSeatId(state, actor.seatId, passedSeatIds),
      turnNumber: state.turn.turnNumber + 1,
    },
    bidding: nextBidding,
  }
}

function applyDrawAction(state, actor) {
  const [revealedMonsterCard, ...monsterDeck] = state.bidding.monsterDeck
  if (!revealedMonsterCard) return null
  const spec = MONSTER_STATS[revealedMonsterCard] ?? { strength: 3, icons: [] }
  return {
    ...state,
    bidding: {
      ...state.bidding,
      subphase: BIDDING_SUBPHASES.PENDING,
      revealedMonsterCard,
      revealedMonsterStrength: spec.strength,
      revealedMonsterIcons: spec.icons,
      revealedBySeatId: actor.seatId,
      monsterDeck,
    },
  }
}

function applySacrificeAction(state, action, actor) {
  const loadout = state.heroLoadout[actor.seatId] ?? []
  if (!loadout.includes(action.equipmentId) || !state.bidding.revealedMonsterCard) return null
  return {
    ...state,
    heroLoadout: {
      ...state.heroLoadout,
      [actor.seatId]: loadout.filter((equipmentId) => equipmentId !== action.equipmentId),
    },
    centerEquipment: (state.centerEquipment ?? []).filter((equipmentId) => equipmentId !== action.equipmentId),
    turn: {
      activeSeatId: findNextActiveSeatId(state, actor.seatId, state.bidding.passedSeatIds),
      turnNumber: state.turn.turnNumber + 1,
    },
    bidding: {
      ...state.bidding,
      subphase: BIDDING_SUBPHASES.TURN,
      revealedMonsterCard: null,
      revealedMonsterStrength: null,
      revealedMonsterIcons: [],
      revealedBySeatId: null,
      discardedMonsterCards: [
        ...state.bidding.discardedMonsterCards,
        state.bidding.revealedMonsterCard,
      ],
    },
  }
}

function applyAddToDungeonAction(state, actor) {
  if (!state.bidding.revealedMonsterCard) return null
  const ownAdds = state.playerOwnPileAdds?.[actor.seatId] ?? []
  return {
    ...state,
    turn: {
      activeSeatId: findNextActiveSeatId(state, actor.seatId, state.bidding.passedSeatIds),
      turnNumber: state.turn.turnNumber + 1,
    },
    bidding: {
      ...state.bidding,
      subphase: BIDDING_SUBPHASES.TURN,
      dungeonMonsters: [...state.bidding.dungeonMonsters, state.bidding.revealedMonsterCard],
      revealedMonsterCard: null,
      revealedMonsterStrength: null,
      revealedMonsterIcons: [],
      revealedBySeatId: null,
    },
    playerOwnPileAdds: {
      ...(state.playerOwnPileAdds ?? {}),
      [actor.seatId]: [...ownAdds, state.bidding.revealedMonsterCard],
    },
  }
}

function findNextActiveSeatId(state, seatId, passedSeatIds) {
  const index = state.seats.findIndex((seat) => seat.id === seatId)
  for (let i = 1; i <= state.seats.length; i += 1) {
    const next = state.seats[(index + i) % state.seats.length]
    if (!passedSeatIds.includes(next.id) && !state.scoreboard[next.id]?.eliminated) return next.id
  }
  return null
}

function applyAdvanceDungeonAction(state, actor) {
  const runnerSeatId = state.bidding.runnerSeatId
  if (!runnerSeatId || runnerSeatId !== actor.seatId) return null
  const power = state.heroLoadout[runnerSeatId]?.length ?? 0
  const resolution = resolveDungeonCards(state.bidding.dungeonMonsters, power)
  const success = resolution.success
  const currentScore = state.scoreboard[runnerSeatId]
  const nextRunnerScore = success
    ? { ...currentScore, successes: currentScore.successes + 1 }
    : {
        ...currentScore,
        lives: Math.max(0, currentScore.lives - 1),
        eliminated: currentScore.lives - 1 <= 0,
      }
  const nextScoreboard = {
    ...state.scoreboard,
    [runnerSeatId]: nextRunnerScore,
  }
  const resetOwnPiles = Object.fromEntries(state.seats.map((seat) => [seat.id, []]))
  const lastDungeonRun = {
    runnerSeatId,
    monsters: [...state.bidding.dungeonMonsters],
    heroLoadoutSize: power,
    result: success ? 'success' : 'failure',
    steps: resolution.steps,
  }
  if (nextRunnerScore.successes >= 2) {
    return {
      ...state,
      phase: MATCH_PHASES.MATCH_OVER,
      matchWinnerSeatId: runnerSeatId,
      scoreboard: nextScoreboard,
      lastDungeonRun,
      playerOwnPileAdds: resetOwnPiles,
      turn: {
        activeSeatId: null,
        turnNumber: state.turn.turnNumber + 1,
      },
    }
  }
  const activeSeats = state.seats.filter((seat) => !nextScoreboard[seat.id]?.eliminated)
  if (activeSeats.length === 1) {
    return {
      ...state,
      phase: MATCH_PHASES.MATCH_OVER,
      matchWinnerSeatId: activeSeats[0].id,
      scoreboard: nextScoreboard,
      lastDungeonRun,
      playerOwnPileAdds: resetOwnPiles,
      turn: {
        activeSeatId: null,
        turnNumber: state.turn.turnNumber + 1,
      },
    }
  }
  const nextStarterSeatId = findNextActiveSeatId(
    {
      ...state,
      scoreboard: nextScoreboard,
    },
    runnerSeatId,
    [],
  )
  return {
    ...state,
    phase: MATCH_PHASES.BIDDING,
    scoreboard: nextScoreboard,
    lastDungeonRun,
    playerOwnPileAdds: resetOwnPiles,
    turn: {
      activeSeatId: nextStarterSeatId,
      turnNumber: state.turn.turnNumber + 1,
    },
    bidding: {
      subphase: BIDDING_SUBPHASES.TURN,
      passedSeatIds: [],
      runnerSeatId: null,
      revealedMonsterCard: null,
      revealedMonsterStrength: null,
      revealedMonsterIcons: [],
      revealedBySeatId: null,
      monsterDeck: createInitialMonsterDeck(),
      dungeonMonsters: [],
      discardedMonsterCards: [],
    },
    dungeon: {
      subphase: null,
      currentMonster: null,
      remainingMonsters: [],
      hp: 0,
      inPlayEquipmentIds: [],
      polySpent: false,
      axeSpent: false,
    },
    pickAdventurer: {
      activeSeatId: null,
    },
  }
}

function resolveDungeonCards(monsters, heroPower) {
  let remainingPower = heroPower
  const steps = monsters.map((monsterId) => {
    const heroPowerBefore = remainingPower
    const defeated = remainingPower > 0
    if (defeated) remainingPower -= 1
    return {
      monsterId,
      heroPowerBefore,
      heroPowerAfter: remainingPower,
      defeated,
    }
  })
  return {
    success: steps.every((step) => step.defeated),
    steps,
  }
}

function applyChooseNextAdventurerAction(state, _action, actor) {
  if (state.phase !== MATCH_PHASES.PICK_ADVENTURER) return null
  return {
    ...state,
    phase: MATCH_PHASES.BIDDING,
    turn: {
      activeSeatId: actor.seatId,
      turnNumber: state.turn.turnNumber + 1,
    },
    bidding: {
      ...state.bidding,
      subphase: BIDDING_SUBPHASES.TURN,
      passedSeatIds: [],
      runnerSeatId: null,
      revealedMonsterCard: null,
      revealedBySeatId: null,
      monsterDeck: createInitialMonsterDeck(),
      dungeonMonsters: [],
      discardedMonsterCards: [],
    },
  }
}

function applyDungeonStepAction(state, nextSubphase) {
  if (state.phase !== MATCH_PHASES.DUNGEON) return null
  return {
    ...state,
    dungeon: {
      ...state.dungeon,
      subphase: nextSubphase,
    },
  }
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {{seatId:string}} actor
 */
function applyRevealOrContinueAction(state, actor) {
  const runnerSeatId = state.bidding.runnerSeatId
  if (!runnerSeatId || actor.seatId !== runnerSeatId) return null
  if (state.phase !== MATCH_PHASES.DUNGEON || state.dungeon?.subphase !== DUNGEON_SUBPHASES.REVEAL) {
    return null
  }
  const d0 = state.dungeon
  let remaining = [...(d0.remainingMonsters ?? [])]
  let current = d0.currentMonster
  if (current == null && remaining.length > 0) {
    current = remaining.shift()
  }
  if (current == null) {
    return {
      ...state,
      dungeon: {
        ...d0,
        remainingMonsters: remaining,
        currentMonster: null,
        subphase: null,
      },
    }
  }
  const inPlay = new Set(d0.inPlayEquipmentIds ?? [])
  const axeLegal = !d0.axeSpent && inPlay.has(EQUIP_FIRE_AXE)
  const polyLegal = !d0.polySpent && inPlay.has(EQUIP_POLY) && current != null
  if (axeLegal) {
    return {
      ...state,
      dungeon: {
        ...d0,
        currentMonster: current,
        remainingMonsters: remaining,
        subphase: DUNGEON_SUBPHASES.PICK_FIRE_AXE,
      },
    }
  }
  if (polyLegal) {
    return {
      ...state,
      dungeon: {
        ...d0,
        currentMonster: current,
        remainingMonsters: remaining,
        subphase: DUNGEON_SUBPHASES.PICK_POLYMORPH,
      },
    }
  }
  return applyMonsterCombatHits(state, {
    ...d0,
    currentMonster: current,
    remainingMonsters: remaining,
  })
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {typeof state.dungeon} dungeon
 */
function applyMonsterCombatHits(state, dungeon) {
  const current = dungeon.currentMonster
  if (!current) {
    const pileDone = (dungeon.remainingMonsters?.length ?? 0) === 0
    return {
      ...state,
      dungeon: {
        ...dungeon,
        subphase: pileDone ? null : DUNGEON_SUBPHASES.REVEAL,
      },
    }
  }
  const spec = MONSTER_STATS[current] ?? { strength: 3 }
  const hp = Math.max(0, (dungeon.hp ?? 0) - spec.strength)
  const remaining = [...(dungeon.remainingMonsters ?? [])]
  const pileDone = remaining.length === 0
  return {
    ...state,
    dungeon: {
      ...dungeon,
      currentMonster: null,
      remainingMonsters: remaining,
      hp,
      subphase: pileDone ? null : DUNGEON_SUBPHASES.REVEAL,
    },
  }
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {{seatId:string}} actor
 */
function applyFireAxeUseAction(state, actor) {
  const runnerSeatId = state.bidding.runnerSeatId
  if (!runnerSeatId || actor.seatId !== runnerSeatId) return null
  if (state.phase !== MATCH_PHASES.DUNGEON || state.dungeon?.subphase !== DUNGEON_SUBPHASES.PICK_FIRE_AXE) {
    return null
  }
  const d0 = state.dungeon
  const remaining = [...(d0.remainingMonsters ?? [])]
  const pileDone = remaining.length === 0
  return {
    ...state,
    dungeon: {
      ...d0,
      axeSpent: true,
      currentMonster: null,
      subphase: pileDone ? null : DUNGEON_SUBPHASES.REVEAL,
    },
  }
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {{seatId:string}} actor
 */
function applyFireAxeDeclineAction(state, actor) {
  const runnerSeatId = state.bidding.runnerSeatId
  if (!runnerSeatId || actor.seatId !== runnerSeatId) return null
  if (state.phase !== MATCH_PHASES.DUNGEON || state.dungeon?.subphase !== DUNGEON_SUBPHASES.PICK_FIRE_AXE) {
    return null
  }
  const d0 = state.dungeon
  const inPlay = new Set(d0.inPlayEquipmentIds ?? [])
  const polyLegal = !d0.polySpent && inPlay.has(EQUIP_POLY) && d0.currentMonster != null
  if (polyLegal) {
    return applyDungeonStepAction(state, DUNGEON_SUBPHASES.PICK_POLYMORPH)
  }
  return applyMonsterCombatHits(state, d0)
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {{seatId:string}} actor
 */
function applyPolymorphUseAction(state, actor) {
  const runnerSeatId = state.bidding.runnerSeatId
  if (!runnerSeatId || actor.seatId !== runnerSeatId) return null
  if (state.phase !== MATCH_PHASES.DUNGEON || state.dungeon?.subphase !== DUNGEON_SUBPHASES.PICK_POLYMORPH) {
    return null
  }
  const d0 = state.dungeon
  const remaining = [...(d0.remainingMonsters ?? [])]
  const pileDone = remaining.length === 0
  return {
    ...state,
    dungeon: {
      ...d0,
      polySpent: true,
      currentMonster: null,
      subphase: pileDone ? null : DUNGEON_SUBPHASES.REVEAL,
    },
  }
}

/**
 * @param {ReturnType<typeof createInitialMatchState>} state
 * @param {{seatId:string}} actor
 */
function applyPolymorphDeclineAction(state, actor) {
  const runnerSeatId = state.bidding.runnerSeatId
  if (!runnerSeatId || actor.seatId !== runnerSeatId) return null
  if (state.phase !== MATCH_PHASES.DUNGEON || state.dungeon?.subphase !== DUNGEON_SUBPHASES.PICK_POLYMORPH) {
    return null
  }
  return applyMonsterCombatHits(state, state.dungeon)
}

function mergeNnSeatMetadata(prevState, nextState, action, actor) {
  const current = { ...(prevState.nnSeatMetadata ?? {}) }
  const seat = nextState.seats.find((candidate) => candidate.id === actor.seatId)
  const meta = action?.meta
  if (!meta || seat?.role?.type !== 'nn') return current
  current[actor.seatId] = {
    backend: meta.backend ?? null,
    modelId: meta.modelId ?? seat.role.modelId ?? null,
    fallbackReason: meta.fallbackReason ?? null,
  }
  return current
}
