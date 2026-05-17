/**
 * Canonical list of every presentation `kind` the orchestrator may enqueue via
 * `mapEngineTransitionToAnimations`. Update when adding new animation kinds.
 */

/** @type {readonly string[]} */
export const ORCHESTRATOR_PRESENTATION_KINDS = Object.freeze([
  'BIDDING_ADD',
  'BIDDING_DRAW',
  'BIDDING_SACRIFICE',
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

/** @type {readonly string[]} */
export const DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS = Object.freeze(
  ORCHESTRATOR_PRESENTATION_KINDS.filter((kind) => kind.startsWith('DUNGEON_')),
)

const dungeonOrchestratorPresentationKindSet = new Set(DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS)

/**
 * @param {unknown} kind
 * @returns {boolean}
 */
export function isDungeonOrchestratorPresentationKind(kind) {
  return dungeonOrchestratorPresentationKindSet.has(kind)
}

/** @typedef {(typeof ORCHESTRATOR_PRESENTATION_KINDS)[number]} OrchestratorPresentationKind */
