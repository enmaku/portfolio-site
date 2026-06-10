import { presentationMotionInterpreterHelpers } from '../../presentationMotionHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const dungeonOutcomeCatalogEntry = {
  composition: 'inner-only',
  clearKeys: () => ['dungeonCardWrap', 'boardShell'],
  layoutFragile: () => false,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement } = helpers
    const el = ctx.refs?.dungeonCardWrap
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const dur = ms / 1000
    const tl = gsapApi.timeline({ paused: true })
    const result = ctx.payload?.dungeonRunResult ?? null
    if (!isDomElement(el)) {
      if (dur > 0) tl.to({}, { duration: dur })
      return tl
    }
    const rise = Math.min(0.36, dur * 0.38)
    const hold = Math.min(0.22, dur * 0.18)
    const release = Math.max(0, dur - rise - hold)
    const origin = { transformOrigin: 'center center' }
    if (result === 'failure') {
      const sink = Math.min(0.34, dur * 0.36)
      const holdSag = Math.min(0.2, dur * 0.16)
      const recover = Math.max(0, dur - sink - holdSag)
      const sagVars = {
        x: 0,
        y: 8,
        scale: 0.92,
        rotationZ: 5,
        filter: 'saturate(0.76) brightness(0.88)',
        ...origin,
      }
      tl.fromTo(
        el,
        { x: 0, y: 0, scale: 1, rotationZ: 0, filter: 'saturate(1) brightness(1)', ...origin },
        { ...sagVars, duration: sink, ease: 'power2.in' },
        0,
      )
      tl.to(el, { ...sagVars, duration: holdSag, ease: 'none' }, sink)
      tl.to(
        el,
        {
          x: 0,
          y: 0,
          scale: 1,
          rotationZ: 0,
          filter: 'saturate(1) brightness(1)',
          duration: recover,
          ease: 'power2.out',
          boxShadow: 'none',
        },
        sink + holdSag,
      )
    } else if (result === 'success') {
      const glowOpacity = '--dr-dungeon-outcome-glow-opacity'
      const peakVars = {
        x: 0,
        y: -10,
        scale: 1.07,
        rotationZ: -7,
        filter: 'brightness(1.07)',
        [glowOpacity]: 1,
        ...origin,
      }
      tl.fromTo(
        el,
        {
          x: 0,
          y: 0,
          scale: 1,
          rotationZ: 0,
          filter: 'brightness(1)',
          [glowOpacity]: 0,
          ...origin,
        },
        { ...peakVars, duration: rise, ease: 'power2.out' },
        0,
      )
      tl.to(el, { ...peakVars, duration: hold, ease: 'none' }, rise)
      tl.to(
        el,
        {
          x: 0,
          y: 0,
          scale: 1,
          rotationZ: 0,
          filter: 'brightness(1)',
          [glowOpacity]: 0,
          duration: release,
          ease: 'power3.inOut',
        },
        rise + hold,
      )
    } else {
      const peakVars = {
        x: 0,
        y: -7,
        scale: 1.05,
        rotationZ: -4,
        filter: 'brightness(1.05)',
        ...origin,
      }
      tl.fromTo(
        el,
        { x: 0, y: 0, scale: 1, rotationZ: 0, filter: 'brightness(1)', ...origin },
        { ...peakVars, duration: rise, ease: 'power2.out' },
        0,
      )
      tl.to(el, { ...peakVars, duration: hold, ease: 'none' }, rise)
      tl.to(
        el,
        {
          x: 0,
          y: 0,
          scale: 1,
          rotationZ: 0,
          filter: 'brightness(1)',
          duration: release,
          ease: 'power3.inOut',
        },
        rise + hold,
      )
    }
    return tl
  },
}

/** @param {import('gsap').GSAP} gsapApi @param {import('../types.js').PresentationMotionContext} ctx */
export function createDungeonOutcomePresentationMotionTimeline(gsapApi, ctx) {
  return dungeonOutcomeCatalogEntry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)
}
