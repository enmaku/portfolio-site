import { presentationMotionInterpreterHelpers } from '../../presentationMotionHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const dungeonRevealCatalogEntry = {
  composition: 'inner-with-parallel-shell',
  clearKeys: () => ['dungeonCardWrap', 'dungeonCardFlipAxis', 'dungeonPileBadge', 'boardShell'],
  layoutFragile: () => true,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement, appendCardFlyFromAnchorThenMaybeFlip } = helpers
    const card = ctx.refs?.dungeonCardWrap
    const pile = ctx.refs?.dungeonPileBadge
    const flip = ctx.refs?.dungeonCardFlipAxis
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const dur = ms / 1000
    const tl = gsapApi.timeline({ paused: true })

    if (!isDomElement(card) || dur <= 0) {
      if (dur > 0) tl.to({}, { duration: dur })
      return tl
    }

    const flipEl = isDomElement(flip) ? flip : null
    appendCardFlyFromAnchorThenMaybeFlip(gsapApi, tl, {
      card,
      anchor: pile,
      flip: flipEl,
      dur,
      reserveFlipPhasing: !!flipEl,
      animateFlipRotation: !!flipEl,
      cardOpacityForInitialSet: 0.92,
      debugTag: 'DUNGEON_REVEAL',
    })

    return tl
  },
}

/** @param {import('gsap').GSAP} gsapApi @param {import('../types.js').PresentationMotionContext} ctx */
export function createDungeonRevealPresentationMotionTimeline(gsapApi, ctx) {
  return dungeonRevealCatalogEntry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}
