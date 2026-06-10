/**
 * Thin re-export shim for the presentation motion pipeline (layer 3).
 * Implementation lives in {@link ./presentationMotionCatalog/index.js} and {@link ./presentationMotionInterpreter.js}.
 */

export {
  PRESENTATION_MOTION_CATALOG,
  PRESENTATION_MOTION_REGISTRY,
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
  presentationMotionClearKeys,
  presentationMotionIsLayoutFragile,
} from './presentationMotionCatalog/index.js'

export {
  createPresentationMotionTimeline,
  createPresentationResizeFallbackMotionTimeline,
  purgePresentationEquipmentGhostNodes,
} from './presentationMotionInterpreter.js'

export {
  EQUIPMENT_ACTIVATION_PULSE_CLASS,
  PRESENTATION_EQUIPMENT_GHOST_ATTR,
} from './presentationMotionHelpers.js'

/**
 * DOM refs for GSAP (`createLiveMatchShellPresentationBinding` passes these from `getMotionRefs`):
 *
 * - **`boardShell`** — `.dr-board-shell` wrapper around the live bidding/dungeon board.
 * - **`dungeonCardWrap`** — `.dr-dungeon-card-motion-wrap` around the hero/dungeon card.
 * - **`dungeonCardFlipAxis`** — inner flip pivot in `MonsterCardFace`.
 * - **`deckBadge`** — deck pile control; `BIDDING_ADD` / `BIDDING_DRAW` anchor deck motion here.
 * - **`heroChangeInterstitialOverlay`** — full-screen `.dr-hero-interstitial` control.
 * - **`presentationFlightLayer`** — host for equipment ghost clones.
 * - **`equipment_<id>`** — in-play equipment token cell from payload equipment ids.
 *
 * @typedef {import('./presentationMotionCatalog/types.js').PresentationMotionContext} PresentationMotionContext
 */
