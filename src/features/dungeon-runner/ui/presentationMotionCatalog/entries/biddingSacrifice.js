import {
  appendDurationPlaceholderIfNeeded,
  clearKeysWithEquipment,
  exitPhaseTiming,
  layoutFragileWhenEquipmentIds,
} from '../timelineHelpers.js'

/** @type {import('../types.js').PresentationMotionCatalogEntry} */
export const biddingSacrificeCatalogEntry = {
  composition: 'inner-with-parallel-shell',
  clearKeys: (payload) => clearKeysWithEquipment(payload, ['dungeonCardWrap', 'boardShell']),
  layoutFragile: layoutFragileWhenEquipmentIds,
  buildInnerTimeline(gsapApi, ctx, helpers) {
    const { isDomElement, addEquipmentActivationGhostFlights } = helpers
    const card = ctx.refs?.dungeonCardWrap
    const ms = Math.max(0, Number(ctx.durationMs) || 0)
    const dur = ms / 1000
    const tl = gsapApi.timeline({ paused: true })
    const consumedIds = ctx.payload?.responsibleEquipmentIds ?? ctx.payload?.consumedEquipmentIds ?? []
    const hasCard = isDomElement(card)

    addEquipmentActivationGhostFlights(gsapApi, tl, ctx, { flightTimeRatio: 0.58 })

    if (!hasCard && consumedIds.length === 0) {
      appendDurationPlaceholderIfNeeded(tl, dur)
      return tl
    }

    const pulseDur = dur > 0 ? Math.max(0.08, dur / 6) : 0
    const { exitStart, exitDur } = exitPhaseTiming(dur)

    if (hasCard && dur > 0) {
      tl.fromTo(
        card,
        { filter: 'brightness(1)', x: 0 },
        {
          filter: 'brightness(0.88)',
          duration: pulseDur,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: 2,
        },
        0,
      )
    }

    if (hasCard && exitDur > 0) {
      const off =
        typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
          ? Math.max(220, window.innerWidth * 0.42)
          : 320
      tl.to(
        card,
        {
          x: off,
          opacity: 0.15,
          duration: exitDur,
          ease: 'power2.in',
        },
        exitStart,
      )
    }

    appendDurationPlaceholderIfNeeded(tl, dur)
    return tl
  },
}
