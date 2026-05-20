import {
  createInitialMatchState,
  shuffleMatchDeck,
  shuffleMatchSeats,
  MATCH_PHASES,
} from '../engine/kernel.js'

/** Must match `startMatch` / `rematch` in DungeonRunnerPage.vue. */
export const REPLAY_SEAT_SHUFFLE_SEED_XOR = 0x5f3759df
export const REPLAY_DECK_SHUFFLE_SEED_XOR = 0x9e3779b9

/**
 * Web-authoritative pre-history state for completed-match replays:
 * seat shuffle, deck shuffle, then pick-adventurer phase with first actor set.
 */
export function bootstrapMatchStateForReplay(setup, seed) {
  const baseState = createInitialMatchState(setup, { seed })
  const shuffledState = shuffleMatchDeck(
    shuffleMatchSeats(baseState, { seed: seed ^ REPLAY_SEAT_SHUFFLE_SEED_XOR }),
    { seed: seed ^ REPLAY_DECK_SHUFFLE_SEED_XOR },
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
