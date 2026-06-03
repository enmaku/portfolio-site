import {
  createInitialMatchState,
  shuffleMatchDeck,
  shuffleMatchSeats,
  MATCH_PHASES,
} from '../engine/kernel.js'

export const MATCH_SEAT_SHUFFLE_SEED_XOR = 0x5f3759df
export const MATCH_DECK_SHUFFLE_SEED_XOR = 0x9e3779b9

/**
 * Pre-history match engine state for new match start and replay bootstrap:
 * seat shuffle, deck shuffle, then pick-adventurer phase with first actor set.
 */
export function materializeNewMatchState(setup, seed, options = {}) {
  const { preservedBotLabels } = options
  const baseState = createInitialMatchState(setup, { seed })
  const seatShuffleOptions = { seed: seed ^ MATCH_SEAT_SHUFFLE_SEED_XOR }
  if (preservedBotLabels) {
    seatShuffleOptions.preservedBotLabels = preservedBotLabels
  }
  const shuffledState = shuffleMatchDeck(
    shuffleMatchSeats(baseState, seatShuffleOptions),
    { seed: seed ^ MATCH_DECK_SHUFFLE_SEED_XOR },
  )
  const firstSeatId = shuffledState.turn.activeSeatId
  return {
    ...shuffledState,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    hero: null,
    pickAdventurer: {
      ...shuffledState.pickAdventurer,
      activeSeatId: firstSeatId,
    },
  }
}
