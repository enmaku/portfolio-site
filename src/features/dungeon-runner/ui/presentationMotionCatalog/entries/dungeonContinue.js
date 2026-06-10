import { createDurationOnlyTimeline } from '../timelineHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const dungeonContinueCatalogEntry = {
  composition: 'inner-with-parallel-shell',
  clearKeys: () => ['dungeonCardWrap', 'boardShell'],
  layoutFragile: () => false,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement } = helpers
    const el = ctx.refs?.dungeonCardWrap
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const dur = ms / 1000
    if (!isDomElement(el)) {
      return createDurationOnlyTimeline(gsapApi, ctx.durationMs)
    }
    const tl = gsapApi.timeline({ paused: true })
    tl.fromTo(
      el,
      { filter: 'brightness(1)' },
      { filter: 'brightness(0.88)', duration: dur, ease: 'power1.out' },
    )
    return tl
  },
}
