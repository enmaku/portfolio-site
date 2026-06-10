import { presentationMotionInterpreterHelpers } from '../../presentationMotionHelpers.js'

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
    const tl = gsapApi.timeline({ paused: true })
    if (!isDomElement(el)) {
      if (dur > 0) tl.to({}, { duration: dur })
      return tl
    }
    const origin = { transformOrigin: 'center center' }
    const hit = dur * 0.22
    const swing1 = dur * 0.2
    const swing2 = dur * 0.18
    const settle = Math.max(0, dur - hit - swing1 - swing2)
    const exitStart = dur > 0 ? Math.min(dur * 0.58, dur - Math.max(0.22, dur * 0.12)) : 0
    const exitDur = dur > exitStart ? dur - exitStart : 0
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
      let off = 420
      if (
        typeof window !== 'undefined' &&
        Number.isFinite(window.innerWidth) &&
        typeof el.getBoundingClientRect === 'function'
      ) {
        const r = el.getBoundingClientRect()
        if (Number.isFinite(r.left) && Number.isFinite(r.width)) {
          off = Math.max(320, window.innerWidth - r.left + Math.max(28, r.width))
        } else {
          off = Math.max(320, window.innerWidth * 0.75)
        }
      } else if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth)) {
        off = Math.max(320, window.innerWidth * 0.75)
      }
      tl.to(el, { x: off, opacity: 0, duration: exitDur, ease: 'power3.in' }, exitStart)
    }
    return tl
  },
}

/** @param {import('gsap').GSAP} gsapApi @param {import('../types.js').PresentationMotionContext} ctx */
export function createDungeonDamagePresentationMotionTimeline(gsapApi, ctx) {
  return dungeonDamageCatalogEntry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}
