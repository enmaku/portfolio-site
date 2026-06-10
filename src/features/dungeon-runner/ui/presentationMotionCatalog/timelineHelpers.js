/**
 * @param {import('gsap').core.Timeline} tl
 * @param {number} dur
 */
export function appendDurationPlaceholderIfNeeded(tl, dur) {
  if (dur <= 0) return
  const played = typeof tl.duration === 'function' ? tl.duration() : 0
  if (played < dur) tl.to({}, { duration: dur - played })
}

/**
 * @param {import('gsap').GSAP} gsapApi
 * @param {number} ms
 */
export function createDurationOnlyTimeline(gsapApi, ms) {
  const tl = gsapApi.timeline({ paused: true })
  const dur = Math.max(0, Number(ms) || 0) / 1000
  if (dur > 0) tl.to({}, { duration: dur })
  return tl
}

/**
 * @param {import('gsap').GSAP} gsapApi
 * @param {import('./types.js').PresentationMotionContext} ctx
 * @param {(value: unknown) => boolean} isDomElement
 */
export function buildBoardShellPulseTimeline(gsapApi, ctx, isDomElement) {
  const tl = gsapApi.timeline({ paused: true })
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const boardShell = ctx.refs?.boardShell
  if (isDomElement(boardShell) && ms > 0) {
    tl.fromTo(
      boardShell,
      { opacity: 0.92 },
      { opacity: 1, duration: ms / 1000, ease: 'power1.out' },
    )
  } else if (ms > 0) {
    tl.to({}, { duration: ms / 1000 })
  }
  return tl
}

/**
 * @param {string[]} payloadEquipmentKey
 * @param {Record<string, unknown> | undefined} payload
 * @param {readonly string[]} baseKeys
 */
export function clearKeysWithEquipment(payload, baseKeys) {
  const keys = [...baseKeys]
  const ids = payload?.responsibleEquipmentIds ?? payload?.consumedEquipmentIds ?? []
  for (const id of ids) {
    keys.push(`equipment_${id}`)
  }
  return keys
}

/**
 * @param {Record<string, unknown> | undefined} payload
 */
export function layoutFragileWhenEquipmentIds(payload) {
  const ids = payload?.responsibleEquipmentIds ?? payload?.consumedEquipmentIds ?? []
  return ids.length > 0
}
