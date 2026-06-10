import {
  computeCardExitSlideOffset,
  createDurationOnlyTimeline,
  exitPhaseTiming,
} from '../timelineHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const dungeonDamageCatalogEntry = {
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
    const origin = { transformOrigin: 'center center' }
    const hit = dur * 0.22
    const swing1 = dur * 0.2
    const swing2 = dur * 0.18
    const settle = Math.max(0, dur - hit - swing1 - swing2)
    const { exitStart, exitDur } = exitPhaseTiming(dur)
    tl.fromTo(
      el,
      { x: 0, filter: 'saturate(1)', ...origin },
      { x: -7, filter: 'saturate(1.38)', duration: hit, ease: 'power2.out', ...origin },
      0,
    )
    tl.to(el, { x: 6, duration: swing1, ease: 'power1.inOut', ...origin }, hit)
    tl.to(el, { x: -4, duration: swing2, ease: 'power1.inOut', ...origin }, hit + swing1)
    tl.to(el, { x: 0, filter: 'saturate(1)', duration: settle, ease: 'power2.out', ...origin }, hit + swing1 + swing2)
    if (exitDur > 0) {
      const off = computeCardExitSlideOffset(el)
      tl.to(el, { x: off, opacity: 0, duration: exitDur, ease: 'power3.in' }, exitStart)
    }
    return tl
  },
}
