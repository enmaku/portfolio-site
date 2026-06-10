import { presentationMotionInterpreterHelpers } from '../../presentationMotionHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const biddingAddCatalogEntry = {
  composition: 'inner-with-parallel-shell',
  clearKeys: () => ['dungeonCardWrap', 'dungeonCardFlipAxis', 'deckBadge', 'dungeonPileBadge', 'boardShell'],
  layoutFragile: () => true,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement, centerDeltaBetweenElements } = helpers
    const card = ctx.refs?.dungeonCardWrap
    const dungeonPile = ctx.refs?.dungeonPileBadge
    const flip = ctx.refs?.dungeonCardFlipAxis
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const dur = ms / 1000
    const tl = gsapApi.timeline({ paused: true })
    const payload = ctx.payload ?? {}
    const shouldFlipDown = payload.shouldFlipToBackBeforeDungeon === true

    if (!isDomElement(card) || dur <= 0) {
      if (dur > 0) tl.to({}, { duration: dur })
      return tl
    }

    const origin = { transformOrigin: 'center center' }
    let flipDur = 0
    let flyDur = dur
    if (shouldFlipDown && isDomElement(flip)) {
      flipDur = Math.min(dur * 0.28, 0.45)
      flyDur = Math.max(0.08, dur - flipDur)
      tl.fromTo(
        flip,
        { rotationY: 180, transformOrigin: 'center center' },
        { rotationY: 0, duration: flipDur, ease: 'power2.inOut' },
        0,
      )
    }

    let endX = typeof window !== 'undefined' ? window.innerWidth * 0.22 : 180
    let endY = -12
    if (isDomElement(dungeonPile)) {
      const d = centerDeltaBetweenElements(dungeonPile, card)
      if (d.ok) {
        endX = d.dx
        endY = d.dy
      }
    }

    tl.to(
      card,
      {
        x: endX,
        y: endY,
        scale: 0.38,
        opacity: 0.65,
        duration: flyDur,
        ease: 'power2.in',
        ...origin,
      },
      flipDur,
    )

    return tl
  },
}

/** @param {import('gsap').GSAP} gsapApi @param {import('../types.js').PresentationMotionContext} ctx */
export function createBiddingAddPresentationMotionTimeline(gsapApi, ctx) {
  return biddingAddCatalogEntry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}
