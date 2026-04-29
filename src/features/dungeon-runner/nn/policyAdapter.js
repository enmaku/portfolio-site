import { ACTION_TYPES } from '../engine/kernel.js'

export const OBS_DIM = 87
export const POLICY_ACTIONS = 26

const HERO_EQUIPMENT_SLOTS = {
  WARRIOR: ['W_PLATE', 'W_SHIELD', 'W_VORPAL', 'W_TORCH', 'W_HOLY', 'W_SPEAR'],
  BARBARIAN: ['B_HEAL', 'B_SHIELD', 'B_CHAIN', 'B_AXE', 'B_TORCH', 'B_HAMMER'],
  MAGE: ['M_WALL', 'M_HOLY', 'M_OMNI', 'M_BRACE', 'M_POLY', 'M_PACT'],
  ROGUE: ['R_ARMOR', 'R_HEAL', 'R_RING', 'R_BUCK', 'R_VORP', 'R_CLOAK'],
}
const MONSTER_SPECIES = ['goblin', 'skeleton', 'orc', 'vampire', 'golem', 'lich', 'demon', 'dragon']
const ADVENTURERS = ['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE']

export const POLICY_INDEX = {
  PASS: 0,
  DRAW: 1,
  ADD: 2,
  SACRIFICE_BASE: 3,
  PICK_HERO_BASE: 9,
  VORPAL_BASE: 13,
  REVEAL: 21,
  FIRE_AXE: 22,
  DECLINE_FIRE_AXE: 23,
  POLYMORPH: 24,
  DECLINE_POLYMORPH: 25,
}

export function buildPolicyObservation(state, actor) {
  const seatId = actor.seatId
  const activeSeatIndex = state.seats.findIndex((seat) => seat.id === state.turn.activeSeatId)
  const isBidding = state.phase === 'bidding'
  const isDungeon = state.phase === 'dungeon'
  const isPick = state.phase === 'pick-adventurer'
  const pending = isBidding && state.bidding?.subphase === 'pending'
  const values = []

  values.push(...oneHot(4, isBidding ? 0 : isDungeon ? 1 : isPick ? 2 : 3))
  values.push(...(pending ? [0, 1] : isBidding ? [1, 0] : [0, 0]))
  values.push(...buildDungeonSubphaseOneHot(state))
  values.push((state.seats.length || 0) / 4)
  values.push(...oneHot(4, activeSeatIndex))

  for (let i = 0; i < 4; i += 1) {
    const seat = state.seats[i]
    if (!seat) {
      values.push(0, 0, 0, 0)
      continue
    }
    const score = state.scoreboard[seat.id]
    values.push((score?.successes ?? 0) / 2)
    values.push(Math.max(0, 2 - (score?.lives ?? 2)) / 2)
    values.push(score?.eliminated ? 1 : 0)
    values.push(isBidding && state.bidding.passedSeatIds.includes(seat.id) ? 1 : 0)
  }

  values.push(...buildHeroOneHot(state))
  values.push(Math.min(1, (state.bidding.dungeonMonsters.length || 0) / 13))
  values.push(Math.min(1, (state.bidding.monsterDeck.length || 0) / 13))
  values.push((state.successCardsLeft ?? Math.max(0, 5 - Math.max(...Object.values(state.scoreboard).map((score) => score.successes ?? 0)))) / 5)

  const centerEquipment = state.centerEquipment ?? state.heroLoadout?.[seatId] ?? []
  for (const equipmentId of getHeroEquipmentSlots(state?.hero)) values.push(centerEquipment.includes(equipmentId) ? 1 : 0)

  values.push(...buildPendingFeatures(state, seatId))
  values.push(...buildOwnPileSpeciesCounts(state, seatId))
  values.push(state.turn.activeSeatId === seatId ? 1 : 0)
  values.push(state.bidding.runnerSeatId === seatId ? 1 : 0)
  values.push(...buildDungeonFeatures(state, seatId))

  if (values.length > OBS_DIM) return values.slice(0, OBS_DIM)
  if (values.length < OBS_DIM) return [...values, ...new Array(OBS_DIM - values.length).fill(0)]
  return values
}

export function buildPolicyLegalMask(state, actor, legalActions) {
  const mask = new Array(POLICY_ACTIONS).fill(0)
  for (const action of legalActions ?? []) {
    const index = encodeActionIndex(state, actor, action)
    if (index >= 0 && index < POLICY_ACTIONS) mask[index] = 1
  }
  return mask
}

export function decodePolicyIndexToAction(index, legalActions, state = null, actor = null) {
  if (index === POLICY_INDEX.PASS) return chooseLegalByType(legalActions, ACTION_TYPES.PASS)
  if (index === POLICY_INDEX.DRAW) return chooseLegalByType(legalActions, ACTION_TYPES.DRAW)
  if (index === POLICY_INDEX.ADD) return chooseLegalByType(legalActions, ACTION_TYPES.ADD_TO_DUNGEON)
  if (index >= POLICY_INDEX.SACRIFICE_BASE && index < POLICY_INDEX.SACRIFICE_BASE + 6) {
    const equipmentSlots = getSacrificeSlots(state, actor)
    const equipmentId = equipmentSlots[index - POLICY_INDEX.SACRIFICE_BASE]
    return (
      legalActions.find((action) => action.type === ACTION_TYPES.SACRIFICE && action.equipmentId === equipmentId) ?? null
    )
  }
  if (index >= POLICY_INDEX.PICK_HERO_BASE && index < POLICY_INDEX.PICK_HERO_BASE + 4) {
    const hero = ADVENTURERS[index - POLICY_INDEX.PICK_HERO_BASE]
    return legalActions.find((action) => action.type === ACTION_TYPES.CHOOSE_NEXT_ADVENTURER && action.hero === hero) ?? null
  }
  if (index >= POLICY_INDEX.VORPAL_BASE && index < POLICY_INDEX.VORPAL_BASE + 8) {
    const species = MONSTER_SPECIES[index - POLICY_INDEX.VORPAL_BASE]
    return legalActions.find((action) => action.type === ACTION_TYPES.DECLARE_VORPAL && action.species === species) ?? null
  }
  if (index === POLICY_INDEX.REVEAL) return chooseLegalByType(legalActions, ACTION_TYPES.REVEAL_OR_CONTINUE)
  if (index === POLICY_INDEX.FIRE_AXE) return chooseLegalByType(legalActions, ACTION_TYPES.USE_FIRE_AXE)
  if (index === POLICY_INDEX.DECLINE_FIRE_AXE) return chooseLegalByType(legalActions, ACTION_TYPES.DECLINE_FIRE_AXE)
  if (index === POLICY_INDEX.POLYMORPH) return chooseLegalByType(legalActions, ACTION_TYPES.USE_POLYMORPH)
  if (index === POLICY_INDEX.DECLINE_POLYMORPH) return chooseLegalByType(legalActions, ACTION_TYPES.DECLINE_POLYMORPH)
  return null
}

function encodeActionIndex(state, actor, action) {
  if (action.type === ACTION_TYPES.PASS) return POLICY_INDEX.PASS
  if (action.type === ACTION_TYPES.DRAW) return POLICY_INDEX.DRAW
  if (action.type === ACTION_TYPES.ADD_TO_DUNGEON) return POLICY_INDEX.ADD
  if (action.type === ACTION_TYPES.SACRIFICE) {
    const equipmentSlots = getSacrificeSlots(state, actor)
    const index = equipmentSlots.indexOf(action.equipmentId)
    return index === -1 ? -1 : POLICY_INDEX.SACRIFICE_BASE + index
  }
  if (action.type === ACTION_TYPES.CHOOSE_NEXT_ADVENTURER) {
    const index = ADVENTURERS.indexOf(action.hero)
    return index === -1 ? -1 : POLICY_INDEX.PICK_HERO_BASE + index
  }
  if (action.type === ACTION_TYPES.DECLARE_VORPAL) {
    const index = MONSTER_SPECIES.indexOf(action.species)
    return index === -1 ? -1 : POLICY_INDEX.VORPAL_BASE + index
  }
  if (action.type === ACTION_TYPES.REVEAL_OR_CONTINUE) return POLICY_INDEX.REVEAL
  if (action.type === ACTION_TYPES.USE_FIRE_AXE) return POLICY_INDEX.FIRE_AXE
  if (action.type === ACTION_TYPES.DECLINE_FIRE_AXE) return POLICY_INDEX.DECLINE_FIRE_AXE
  if (action.type === ACTION_TYPES.USE_POLYMORPH) return POLICY_INDEX.POLYMORPH
  if (action.type === ACTION_TYPES.DECLINE_POLYMORPH) return POLICY_INDEX.DECLINE_POLYMORPH
  if (action.type === ACTION_TYPES.ADVANCE_DUNGEON && state.phase === 'dungeon' && state.bidding.runnerSeatId === actor.seatId) {
    return POLICY_INDEX.PASS
  }
  return -1
}

function chooseLegalByType(legalActions, type) {
  return legalActions.find((action) => action.type === type) ?? null
}

function getSacrificeSlots(state, actor) {
  const slots = getHeroEquipmentSlots(state?.hero)
  if (!state) return slots
  const seatId = actor?.seatId ?? state?.turn?.activeSeatId ?? null
  const loadout = seatId ? state?.heroLoadout?.[seatId] ?? [] : []
  if (!loadout.length) return slots
  return slots.filter((equipmentId) => loadout.includes(equipmentId))
}

function getHeroEquipmentSlots(hero) {
  return HERO_EQUIPMENT_SLOTS[hero] ?? HERO_EQUIPMENT_SLOTS.WARRIOR
}

function buildPendingFeatures(state, seatId) {
  const pending =
    state.phase === 'bidding' &&
    state.bidding?.subphase === 'pending' &&
    state.bidding.revealedBySeatId === seatId &&
    state.bidding.revealedMonsterCard
  if (!pending) return new Array(15).fill(0)
  const species = oneHot(8, MONSTER_SPECIES.indexOf(state.bidding.revealedMonsterCard))
  const strengthValue = Number(state.bidding.revealedMonsterStrength ?? 3)
  const strength = [Math.min(1, Math.max(0, strengthValue / 9))]
  const icons = buildIconBits(state.bidding.revealedMonsterIcons ?? [])
  return [...species, ...strength, ...icons]
}

function buildDungeonFeatures(state, seatId) {
  if (state.phase !== 'dungeon' || state.bidding.runnerSeatId !== seatId) return new Array(18).fill(0)
  const current = state.dungeon?.currentMonster ?? null
  const speciesIdx = current ? MONSTER_SPECIES.indexOf(current) : -1
  const currentSpecies = speciesIdx >= 0 ? oneHot(8, speciesIdx) : new Array(8).fill(0)
  const hpRaw = Number(state.dungeon?.hp ?? 0)
  const hp = hpRaw > 0 ? Math.min(1, hpRaw / 20) : 0
  const remLen = state.dungeon?.remainingMonsters?.length ?? state.bidding?.dungeonMonsters?.length ?? 0
  const rem = Math.min(1, Math.max(0, remLen / 13))
  const sub = state.dungeon?.subphase
  const flags = [
    sub === 'vorpal' ? 1 : 0,
    sub === 'reveal' ? 1 : 0,
    sub === 'pick-fire-axe' ? 1 : 0,
    sub === 'pick-polymorph' ? 1 : 0,
    state.dungeon?.polySpent ? 1 : 0,
    state.dungeon?.axeSpent ? 1 : 0,
  ]
  const slots = getHeroEquipmentSlots(state?.hero)
  const inPlay = new Set(state.dungeon?.inPlayEquipmentIds ?? [])
  const inplayBits = slots.map((eid) => (inPlay.has(eid) ? 1 : 0))
  const msum = inplayBits.reduce((a, b) => a + b, 0) / 6
  const mcnt = inPlay.size / 6
  return [...currentSpecies, hp, rem, ...flags, msum, mcnt]
}

function buildHeroOneHot(state) {
  const hero = state.hero ?? 'WARRIOR'
  return oneHot(4, ADVENTURERS.indexOf(hero))
}

function buildDungeonSubphaseOneHot(state) {
  if (state.phase !== 'dungeon') return [0, 0, 0, 0]
  const map = {
    vorpal: 0,
    reveal: 1,
    'pick-fire-axe': 2,
    'pick-polymorph': 3,
  }
  return oneHot(4, map[state.dungeon?.subphase] ?? -1)
}

function buildOwnPileSpeciesCounts(state, seatId) {
  const speciesCounts = new Array(8).fill(0)
  const ownAdds = state.playerOwnPileAdds?.[seatId] ?? []
  for (const species of ownAdds) {
    const index = MONSTER_SPECIES.indexOf(species)
    if (index < 0) continue
    speciesCounts[index] = Math.min(2, speciesCounts[index] + 1)
  }
  return speciesCounts.map((value) => value / 2)
}

function buildIconBits(iconIds) {
  const iconOrder = ['torch', 'chalice', 'hammer', 'cloak', 'pact', 'staff']
  return iconOrder.map((icon) => (iconIds.includes(icon) ? 1 : 0))
}

function oneHot(size, index) {
  const out = new Array(size).fill(0)
  if (index >= 0 && index < size) out[index] = 1
  return out
}
