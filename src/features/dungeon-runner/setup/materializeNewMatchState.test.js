import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialMatchState,
  MATCH_PHASES,
  shuffleMatchDeck,
  shuffleMatchSeats,
} from '../engine/kernel.js'
import { bootstrapMatchStateForReplay } from '../debug/replayBootstrap.js'
import {
  MATCH_DECK_SHUFFLE_SEED_XOR,
  MATCH_SEAT_SHUFFLE_SEED_XOR,
  materializeNewMatchState,
} from './materializeNewMatchState.js'

const FOUR_NN_SETUP = {
  totalSeats: 4,
  opponents: [
    { type: 'nn', modelId: 'latest' },
    { type: 'nn', modelId: 'latest' },
    { type: 'nn', modelId: 'latest' },
  ],
}

const MIXED_SETUP = {
  totalSeats: 4,
  opponents: [
    { type: 'randombot' },
    { type: 'nn', modelId: 'latest' },
    { type: 'randombot' },
  ],
}

test('materializeNewMatchState is deterministic for same setup and seed', () => {
  const a = materializeNewMatchState(MIXED_SETUP, 4242)
  const b = materializeNewMatchState(MIXED_SETUP, 4242)
  assert.deepEqual(a, b)
})

test('materializeNewMatchState varies with seed', () => {
  const a = materializeNewMatchState(MIXED_SETUP, 111)
  const b = materializeNewMatchState(MIXED_SETUP, 222)
  assert.notDeepEqual(a, b)
})

test('materializeNewMatchState enters pick-adventurer with first actor aligned', () => {
  const state = materializeNewMatchState(FOUR_NN_SETUP, 1355487512)
  assert.equal(state.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.equal(state.hero, null)
  assert.equal(state.turn.activeSeatId, 'seat-4')
  assert.equal(state.pickAdventurer.activeSeatId, state.turn.activeSeatId)
  assert.equal(state.rng.step, 0)
})

test('materializeNewMatchState preserves opponent seat labels when requested', () => {
  const initial = materializeNewMatchState(MIXED_SETUP, 8080)
  const preservedBotLabels = initial.seats
    .filter((seat) => seat.role.type !== 'human' && seat.label)
    .map((seat) => seat.label)

  const rematchState = materializeNewMatchState(MIXED_SETUP, 3333, { preservedBotLabels })
  assert.deepEqual(
    rematchState.seats.filter((seat) => seat.role.type !== 'human').map((seat) => seat.label),
    preservedBotLabels,
  )
})

test('materializeNewMatchState applies shuffles with exported XOR seed constants', () => {
  const setup = MIXED_SETUP
  const seed = 4242
  const baseState = createInitialMatchState(setup, { seed })
  const shuffledState = shuffleMatchDeck(
    shuffleMatchSeats(baseState, { seed: seed ^ MATCH_SEAT_SHUFFLE_SEED_XOR }),
    { seed: seed ^ MATCH_DECK_SHUFFLE_SEED_XOR },
  )
  const firstSeatId = shuffledState.turn.activeSeatId
  const expected = {
    ...shuffledState,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    hero: null,
    pickAdventurer: {
      ...shuffledState.pickAdventurer,
      activeSeatId: firstSeatId,
    },
  }
  assert.deepEqual(materializeNewMatchState(setup, seed), expected)
})

test('bootstrapMatchStateForReplay delegates to materializeNewMatchState', () => {
  const setup = FOUR_NN_SETUP
  const seed = 1355487512
  assert.deepEqual(bootstrapMatchStateForReplay(setup, seed), materializeNewMatchState(setup, seed))
})
