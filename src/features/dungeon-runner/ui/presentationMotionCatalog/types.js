/**
 * @typedef {import('../orchestratorPresentationKinds.js').OrchestratorPresentationKind} OrchestratorPresentationKind
 */

/**
 * @typedef {'shell-only' | 'inner-only' | 'inner-with-parallel-shell'} PresentationMotionComposition
 */

/**
 * @typedef {{
 *   kind: OrchestratorPresentationKind,
 *   durationMs: number,
 *   payload?: Record<string, unknown>,
 *   refs?: Record<string, unknown>,
 * }} PresentationMotionContext
 */

/**
 * @typedef {{
 *   isDomElement: (value: unknown) => boolean,
 *   appendCardFlyFromAnchorThenMaybeFlip: Function,
 *   addEquipmentActivationGhostFlights: Function,
 *   centerDeltaBetweenElements: Function,
 * }} PresentationMotionInterpreterHelpers
 */

/**
 * @typedef {{
 *   composition: PresentationMotionComposition,
 *   clearKeys: (payload?: Record<string, unknown>) => readonly string[],
 *   layoutFragile: (payload?: Record<string, unknown>) => boolean,
 *   buildInnerTimeline: (
 *     gsapApi: import('gsap').GSAP,
 *     ctx: PresentationMotionContext,
 *     helpers: PresentationMotionInterpreterHelpers,
 *   ) => import('gsap').core.Timeline,
 * }} PresentationMotionCatalogEntry
 */

export {}
