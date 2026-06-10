import { createDurationOnlyTimeline } from '../timelineHelpers.js'

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

    if (!isDomElement(card) || dur <= 0) {
      return createDurationOnlyTimeline(gsapApi, ctx.durationMs)
    }

    const tl = gsapApi.timeline({ paused: true })
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
