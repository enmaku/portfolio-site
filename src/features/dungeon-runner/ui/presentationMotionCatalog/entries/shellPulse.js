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
