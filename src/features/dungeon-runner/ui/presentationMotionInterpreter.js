import gsap from 'gsap'

import { getPresentationMotionCatalogEntry } from './presentationMotionCatalog/index.js'
import {
  PRESENTATION_EQUIPMENT_GHOST_ATTR,
  isPresentationDomElement,
  presentationMotionInterpreterHelpers,
} from './presentationMotionHelpers.js'

/**
 * @param {import('gsap').GSAP} gsapApi
 * @param {import('./presentationMotionCatalog/types.js').PresentationMotionContext} ctx
 */
export function createPresentationResizeFallbackMotionTimeline(gsapApi, ctx) {
  const tl = gsapApi.timeline({ paused: true })
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const boardShell = ctx.refs?.boardShell
  const card = ctx.refs?.dungeonCardWrap
  let hasTween = false
  if (isPresentationDomElement(boardShell) && dur > 0) {
    tl.fromTo(
      boardShell,
      { opacity: 0.94 },
      { opacity: 1, duration: dur, ease: 'power1.out' },
      0,
    )
    hasTween = true
  }
  if (isPresentationDomElement(card) && dur > 0) {
    tl.fromTo(
      card,
      { opacity: 0.96, y: 3 },
      { opacity: 1, y: 0, duration: dur, ease: 'power1.out' },
      0,
    )
    hasTween = true
  }
  if (!hasTween && dur > 0) {
    tl.to({}, { duration: dur })
  }
  return tl
}

/**
 * @param {import('gsap').GSAP} [gsapApi]
 * @param {import('./presentationMotionCatalog/types.js').PresentationMotionContext} ctx
 */
export function createPresentationMotionTimeline(gsapApi = gsap, ctx) {
  const entry = getPresentationMotionCatalogEntry(ctx.kind)
  if (!entry) {
    throw new Error(`No presentation motion factory for kind: ${ctx.kind}`)
  }
  const inner = entry.buildInnerTimeline(gsapApi, ctx, presentationMotionInterpreterHelpers)

  if (entry.composition === 'shell-only' || entry.composition === 'inner-only') {
    return inner
  }

  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const boardShell = ctx.refs?.boardShell
  if (!isPresentationDomElement(boardShell) || dur <= 0) {
    return inner
  }
  const master = gsapApi.timeline({ paused: true })
  master.add(inner, 0)
  if (typeof inner.paused === 'function') inner.paused(false)
  master.fromTo(
    boardShell,
    { opacity: 0.92 },
    { opacity: 1, duration: dur, ease: 'power1.out' },
    0,
  )
  return master
}

/**
 * Removes any equipment ghost clones still in the document (missed timeline callback, resize, fast skip).
 */
export function purgePresentationEquipmentGhostNodes() {
  if (typeof document === 'undefined' || !document.body?.querySelectorAll) return
  const sel = `[${PRESENTATION_EQUIPMENT_GHOST_ATTR}]`
  for (const node of document.body.querySelectorAll(sel)) {
    try {
      if (typeof node.remove === 'function') node.remove()
      else {
        const p = node.parentNode
        if (p) p.removeChild(node)
      }
    } catch {
      /* ignore */
    }
  }
}
