import {
  appendDurationPlaceholderIfNeeded,
  clearKeysWithEquipment,
  computeCardExitSlideOffset,
  exitPhaseTiming,
  layoutFragileWhenEquipmentIds,
} from '../timelineHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const dungeonNeutralizeCatalogEntry = {
  composition: 'inner-with-parallel-shell',
  clearKeys: (payload) => clearKeysWithEquipment(payload, ['dungeonCardWrap', 'boardShell']),
  layoutFragile: layoutFragileWhenEquipmentIds,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement, addEquipmentActivationGhostFlights } = helpers
    const el = ctx.refs?.dungeonCardWrap
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const dur = ms / 1000
    const tl = gsapApi.timeline({ paused: true })
    addEquipmentActivationGhostFlights(gsapApi, tl, ctx, { flightTimeRatio: 0.55 })
    if (!isDomElement(el)) {
      appendDurationPlaceholderIfNeeded(tl, dur)
      return tl
    }
    const strikeDur = Math.min(0.2, dur)
    const half = strikeDur / 2
    tl.fromTo(el, { x: 0 }, { x: 6, duration: half, ease: 'power2.out' }, 0)
    tl.to(el, { x: 0, duration: half, ease: 'power2.in' }, half)
    tl.fromTo(
      el,
      { filter: 'brightness(1)' },
      { filter: 'brightness(0.88)', duration: dur, ease: 'power1.out' },
      0,
    )

    const isFinalDefeat = ctx.payload?.isFinalDungeonMonsterDefeat === true
    const { exitStart, exitDur } = exitPhaseTiming(dur)
    if (!isFinalDefeat && exitDur > 0) {
      const off = computeCardExitSlideOffset(el)
      tl.to(el, { x: off, opacity: 0, duration: exitDur, ease: 'power3.in' }, exitStart)
    }

    appendDurationPlaceholderIfNeeded(tl, dur)
    return tl
  },
}
