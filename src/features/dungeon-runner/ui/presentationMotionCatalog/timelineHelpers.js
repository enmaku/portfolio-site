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
 * @param {number} dur
 * @returns {{ exitStart: number, exitDur: number }}
 */
export function exitPhaseTiming(dur) {
  const exitStart = dur > 0 ? Math.min(dur * 0.58, dur - Math.max(0.22, dur * 0.12)) : 0
  const exitDur = dur > exitStart ? dur - exitStart : 0
  return { exitStart, exitDur }
}

/**
 * @param {Element} el
 */
export function computeCardExitSlideOffset(el) {
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
  return off
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
