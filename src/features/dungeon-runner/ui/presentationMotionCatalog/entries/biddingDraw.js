import { presentationMotionInterpreterHelpers } from '../../presentationMotionHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const biddingDrawCatalogEntry = {
  composition: 'inner-with-parallel-shell',
  clearKeys: () => ['dungeonCardWrap', 'dungeonCardFlipAxis', 'boardShell'],
  layoutFragile: () => true,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement, appendCardFlyFromAnchorThenMaybeFlip } = helpers
    const card = ctx.refs?.dungeonCardWrap
    const deck = ctx.refs?.deckBadge
    const flip = ctx.refs?.dungeonCardFlipAxis
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const dur = ms / 1000
    const tl = gsapApi.timeline({ paused: true })
    const payload = ctx.payload ?? {}
    const shouldFlip = payload.shouldFlipFaceAfterArrival === true

    if (!isDomElement(card) || dur <= 0) {
      if (dur > 0) tl.to({}, { duration: dur })
      return tl
    }

    const flipEl = isDomElement(flip) ? flip : null
    appendCardFlyFromAnchorThenMaybeFlip(gsapApi, tl, {
      card,
      anchor: deck,
      flip: flipEl,
      dur,
      reserveFlipPhasing: shouldFlip && !!flipEl,
      animateFlipRotation: shouldFlip && !!flipEl,
      cardOpacityForInitialSet: 1,
      debugTag: 'BIDDING_DRAW',
    })

    return tl
  },
}

/** @param {import('gsap').GSAP} gsapApi @param {import('../types.js').PresentationMotionContext} ctx */
export function createBiddingDrawPresentationMotionTimeline(gsapApi, ctx) {
  return biddingDrawCatalogEntry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}
