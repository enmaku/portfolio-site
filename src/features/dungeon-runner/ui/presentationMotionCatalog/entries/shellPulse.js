import { presentationMotionInterpreterHelpers } from '../../presentationMotionHelpers.js'
import { buildBoardShellPulseTimeline } from '../timelineHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const shellPulseCatalogEntry = {
  composition: 'shell-only',
  clearKeys: () => ['boardShell'],
  layoutFragile: () => false,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    return buildBoardShellPulseTimeline(gsapApi, ctx, helpers.isDomElement)
  },
}

/** @param {import('gsap').GSAP} gsapApi @param {import('../types.js').PresentationMotionContext} ctx */
export function createBoardShellPresentationMotionTimeline(gsapApi, ctx) {
  return shellPulseCatalogEntry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}
