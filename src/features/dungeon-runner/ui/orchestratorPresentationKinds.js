/**
 * Canonical list of every presentation `kind` the orchestrator may enqueue via
 * `mapEngineTransitionToAnimations`. Update when adding new animation kinds.
 */

/** @type {readonly string[]} */
export const ORCHESTRATOR_PRESENTATION_KINDS = Object.freeze([
  'BOT_BIDDING_ADD',
  'BOT_BIDDING_DRAW',
  'BOT_BIDDING_SACRIFICE',
  'DUNGEON_CONTINUE',
  'DUNGEON_DAMAGE',
  'DUNGEON_NEUTRALIZE',
  'DUNGEON_OUTCOME',
  'DUNGEON_REVEAL',
  'HERO_CHANGE_INTERSTITIAL',
  'PHASE_ENTER_DUNGEON',
  'PHASE_MATCH_OVER',
  'PHASE_PICK_ADVENTURER',
  'TURN_ADVANCE',
])

/** @typedef {(typeof ORCHESTRATOR_PRESENTATION_KINDS)[number]} OrchestratorPresentationKind */
