import { ORCHESTRATOR_PRESENTATION_KINDS } from '../orchestratorPresentationKinds.js'
import { presentationMotionInterpreterHelpers } from '../presentationMotionHelpers.js'
import { biddingAddCatalogEntry } from './entries/biddingAdd.js'
import { biddingDrawCatalogEntry } from './entries/biddingDraw.js'
import { biddingSacrificeCatalogEntry } from './entries/biddingSacrifice.js'
import { dungeonContinueCatalogEntry } from './entries/dungeonContinue.js'
import { dungeonDamageCatalogEntry } from './entries/dungeonDamage.js'
import { dungeonNeutralizeCatalogEntry } from './entries/dungeonNeutralize.js'
import { dungeonOutcomeCatalogEntry } from './entries/dungeonOutcome.js'
import { dungeonRevealCatalogEntry } from './entries/dungeonReveal.js'
import { heroChangeInterstitialCatalogEntry } from './entries/heroChangeInterstitial.js'
import { shellPulseCatalogEntry } from './entries/shellPulse.js'

/** @typedef {import('./types.js').OrchestratorPresentationKind} OrchestratorPresentationKind */
/** @typedef {import('./types.js').PresentationMotionCatalogEntry} PresentationMotionCatalogEntry */

/** @type {Readonly<Partial<Record<OrchestratorPresentationKind, PresentationMotionCatalogEntry>>>} */
const CATALOG_OVERRIDES = Object.freeze({
  BIDDING_ADD: biddingAddCatalogEntry,
  BIDDING_DRAW: biddingDrawCatalogEntry,
  BIDDING_SACRIFICE: biddingSacrificeCatalogEntry,
  DUNGEON_CONTINUE: dungeonContinueCatalogEntry,
  DUNGEON_DAMAGE: dungeonDamageCatalogEntry,
  DUNGEON_NEUTRALIZE: dungeonNeutralizeCatalogEntry,
  DUNGEON_OUTCOME: dungeonOutcomeCatalogEntry,
  DUNGEON_REVEAL: dungeonRevealCatalogEntry,
  HERO_CHANGE_INTERSTITIAL: heroChangeInterstitialCatalogEntry,
})

/** @type {Readonly<Record<OrchestratorPresentationKind, PresentationMotionCatalogEntry>>} */
export const PRESENTATION_MOTION_CATALOG = Object.freeze(
  Object.fromEntries(
    ORCHESTRATOR_PRESENTATION_KINDS.map((kind) => [
      kind,
      CATALOG_OVERRIDES[kind] ?? shellPulseCatalogEntry,
    ]),
  ),
)

/**
 * @param {OrchestratorPresentationKind} kind
 * @returns {PresentationMotionCatalogEntry | undefined}
 */
export function getPresentationMotionCatalogEntry(kind) {
  return PRESENTATION_MOTION_CATALOG[kind]
}

/**
 * @param {PresentationMotionCatalogEntry} entry
 * @returns {(gsapApi: import('gsap').GSAP, ctx: import('./types.js').PresentationMotionContext) => import('gsap').core.Timeline}
 */
function createRegistryTimelineFactory(entry) {
  return (gsapApi, ctx) => entry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}

/** @type {Readonly<Record<OrchestratorPresentationKind, ReturnType<typeof createRegistryTimelineFactory>>>} */
export const PRESENTATION_MOTION_REGISTRY = Object.freeze(
  Object.fromEntries(
    ORCHESTRATOR_PRESENTATION_KINDS.map((kind) => [
      kind,
      createRegistryTimelineFactory(PRESENTATION_MOTION_CATALOG[kind]),
    ]),
  ),
)

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

export const createBiddingAddPresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.BIDDING_ADD
export const createBiddingDrawPresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.BIDDING_DRAW
export const createBiddingSacrificePresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.BIDDING_SACRIFICE
export const createBoardShellPresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.PHASE_ENTER_DUNGEON
export const createDungeonContinuePresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.DUNGEON_CONTINUE
export const createDungeonDamagePresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.DUNGEON_DAMAGE
export const createDungeonNeutralizePresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.DUNGEON_NEUTRALIZE
export const createDungeonOutcomePresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.DUNGEON_OUTCOME
export const createDungeonRevealPresentationMotionTimeline = PRESENTATION_MOTION_REGISTRY.DUNGEON_REVEAL
export const createHeroChangeInterstitialPresentationMotionTimeline =
  PRESENTATION_MOTION_REGISTRY.HERO_CHANGE_INTERSTITIAL
