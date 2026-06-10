import {
  createBiddingAddPresentationMotionTimeline,
  biddingAddCatalogEntry,
} from './entries/biddingAdd.js'
import {
  createBiddingDrawPresentationMotionTimeline,
  biddingDrawCatalogEntry,
} from './entries/biddingDraw.js'
import {
  createBiddingSacrificePresentationMotionTimeline,
  biddingSacrificeCatalogEntry,
} from './entries/biddingSacrifice.js'
import {
  createDungeonContinuePresentationMotionTimeline,
  dungeonContinueCatalogEntry,
} from './entries/dungeonContinue.js'
import {
  createDungeonDamagePresentationMotionTimeline,
  dungeonDamageCatalogEntry,
} from './entries/dungeonDamage.js'
import {
  createDungeonNeutralizePresentationMotionTimeline,
  dungeonNeutralizeCatalogEntry,
} from './entries/dungeonNeutralize.js'
import {
  createDungeonOutcomePresentationMotionTimeline,
  dungeonOutcomeCatalogEntry,
} from './entries/dungeonOutcome.js'
import {
  createDungeonRevealPresentationMotionTimeline,
  dungeonRevealCatalogEntry,
} from './entries/dungeonReveal.js'
import {
  createHeroChangeInterstitialPresentationMotionTimeline,
  heroChangeInterstitialCatalogEntry,
} from './entries/heroChangeInterstitial.js'
import {
  createBoardShellPresentationMotionTimeline,
  shellPulseCatalogEntry,
} from './entries/shellPulse.js'

/** @typedef {import('./types.js').OrchestratorPresentationKind} OrchestratorPresentationKind */
/** @typedef {import('./types.js').PresentationMotionCatalogEntry} PresentationMotionCatalogEntry */

/** @type {Readonly<Record<OrchestratorPresentationKind, PresentationMotionCatalogEntry>>} */
export const PRESENTATION_MOTION_CATALOG = Object.freeze({
  BIDDING_ADD: biddingAddCatalogEntry,
  BIDDING_DRAW: biddingDrawCatalogEntry,
  BIDDING_SACRIFICE: biddingSacrificeCatalogEntry,
  DUNGEON_CONTINUE: dungeonContinueCatalogEntry,
  DUNGEON_DAMAGE: dungeonDamageCatalogEntry,
  DUNGEON_NEUTRALIZE: dungeonNeutralizeCatalogEntry,
  DUNGEON_OUTCOME: dungeonOutcomeCatalogEntry,
  DUNGEON_REVEAL: dungeonRevealCatalogEntry,
  HERO_CHANGE_INTERSTITIAL: heroChangeInterstitialCatalogEntry,
  PHASE_ENTER_DUNGEON: shellPulseCatalogEntry,
  PHASE_MATCH_OVER: shellPulseCatalogEntry,
  PHASE_PICK_ADVENTURER: shellPulseCatalogEntry,
  TURN_ADVANCE: shellPulseCatalogEntry,
})

/**
 * @param {OrchestratorPresentationKind} kind
 * @returns {PresentationMotionCatalogEntry | undefined}
 */
export function getPresentationMotionCatalogEntry(kind) {
  return PRESENTATION_MOTION_CATALOG[kind]
}

/** @type {Readonly<Record<OrchestratorPresentationKind, Function>>} */
export const PRESENTATION_MOTION_REGISTRY = Object.freeze({
  BIDDING_ADD: createBiddingAddPresentationMotionTimeline,
  BIDDING_DRAW: createBiddingDrawPresentationMotionTimeline,
  BIDDING_SACRIFICE: createBiddingSacrificePresentationMotionTimeline,
  DUNGEON_CONTINUE: createDungeonContinuePresentationMotionTimeline,
  DUNGEON_DAMAGE: createDungeonDamagePresentationMotionTimeline,
  DUNGEON_NEUTRALIZE: createDungeonNeutralizePresentationMotionTimeline,
  DUNGEON_OUTCOME: createDungeonOutcomePresentationMotionTimeline,
  DUNGEON_REVEAL: createDungeonRevealPresentationMotionTimeline,
  HERO_CHANGE_INTERSTITIAL: createHeroChangeInterstitialPresentationMotionTimeline,
  PHASE_ENTER_DUNGEON: createBoardShellPresentationMotionTimeline,
  PHASE_MATCH_OVER: createBoardShellPresentationMotionTimeline,
  PHASE_PICK_ADVENTURER: createBoardShellPresentationMotionTimeline,
  TURN_ADVANCE: createBoardShellPresentationMotionTimeline,
})

/**
 * @param {OrchestratorPresentationKind} kind
 * @param {Record<string, unknown> | undefined} [payload]
 */
export function presentationMotionClearKeys(kind, payload) {
  const entry = PRESENTATION_MOTION_CATALOG[kind]
  return entry ? entry.clearKeys(payload) : ['boardShell']
}

/**
 * @param {OrchestratorPresentationKind} kind
 * @param {Record<string, unknown> | undefined} [payload]
 */
export function presentationMotionIsLayoutFragile(kind, payload) {
  const entry = PRESENTATION_MOTION_CATALOG[kind]
  return entry ? entry.layoutFragile(payload) : false
}

export {
  createBiddingAddPresentationMotionTimeline,
  createBiddingDrawPresentationMotionTimeline,
  createBiddingSacrificePresentationMotionTimeline,
  createBoardShellPresentationMotionTimeline,
  createDungeonContinuePresentationMotionTimeline,
  createDungeonDamagePresentationMotionTimeline,
  createDungeonNeutralizePresentationMotionTimeline,
  createDungeonOutcomePresentationMotionTimeline,
  createDungeonRevealPresentationMotionTimeline,
  createHeroChangeInterstitialPresentationMotionTimeline,
}
