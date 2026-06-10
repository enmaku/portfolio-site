import { presentationMotionInterpreterHelpers } from '../../presentationMotionHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const heroChangeInterstitialCatalogEntry = {
  composition: 'inner-only',
  clearKeys: () => ['heroChangeInterstitialOverlay'],
  layoutFragile: () => false,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement } = helpers
    const tl = gsapApi.timeline({ paused: true })
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const overlay = ctx.refs?.heroChangeInterstitialOverlay
    const dur = ms / 1000
    if (!isDomElement(overlay) || ms <= 0) {
      if (dur > 0) tl.to({}, { duration: dur })
      return tl
    }
    const inDur = dur * 0.18
    const holdDur = dur * 0.64
    const outDur = dur * 0.18
    tl.fromTo(
      overlay,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: inDur, ease: 'power2.out' },
    )
    tl.to(overlay, { duration: holdDur })
    tl.to(overlay, { autoAlpha: 0, duration: outDur, ease: 'power2.in' })
    return tl
  },
}

/** @param {import('gsap').GSAP} gsapApi @param {import('../types.js').PresentationMotionContext} ctx */
export function createHeroChangeInterstitialPresentationMotionTimeline(gsapApi, ctx) {
  return heroChangeInterstitialCatalogEntry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}
