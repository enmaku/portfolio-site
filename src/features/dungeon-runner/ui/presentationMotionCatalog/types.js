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

/** @typedef {typeof import('../presentationMotionHelpers.js').appendCardFlyFromAnchorThenMaybeFlip} AppendCardFlyFromAnchorThenMaybeFlip */
/** @typedef {typeof import('../presentationMotionHelpers.js').addEquipmentActivationGhostFlights} AddEquipmentActivationGhostFlights */
/** @typedef {typeof import('../presentationMotionHelpers.js').centerDeltaBetweenElements} CenterDeltaBetweenElements */

/**
 * @typedef {{
 *   isDomElement: (value: unknown) => boolean,
 *   appendCardFlyFromAnchorThenMaybeFlip: AppendCardFlyFromAnchorThenMaybeFlip,
 *   addEquipmentActivationGhostFlights: AddEquipmentActivationGhostFlights,
 *   centerDeltaBetweenElements: CenterDeltaBetweenElements,
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
