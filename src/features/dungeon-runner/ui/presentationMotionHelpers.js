import { isDungeonPresentationTraceEnabled } from './dungeonPresentationTrace.js'

/** Mark DOM clones from equipment ghost flights so teardown can purge stragglers. */
export const PRESENTATION_EQUIPMENT_GHOST_ATTR = 'data-dr-presentation-equipment-ghost'

export const EQUIPMENT_ACTIVATION_PULSE_CLASS = 'dr-equip-token--activation-pulse'

const PRESENTATION_WARN = '[dungeon-runner presentation]'

export function isPresentationDomElement(value) {
  return value != null && typeof value === 'object' && value.nodeType === 1
}

function ghostFlightTargetRect(el) {
  if (!isPresentationDomElement(el) || typeof el.getBoundingClientRect !== 'function') return null
  const r = el.getBoundingClientRect()
  if (!(r.width > 2) || !(r.height > 2)) return null
  return r
}

/**
 * @param {Element | null | undefined} flightRoot
 * @param {DOMRect} srcRect
 * @param {DOMRect} dstRect
 */
export function ghostFlightCloneCoords(flightRoot, srcRect, dstRect) {
  const endLeft = dstRect.left + dstRect.width / 2 - srcRect.width / 2
  const endTop = dstRect.top + dstRect.height / 2 - srcRect.height / 2

  if (isPresentationDomElement(flightRoot) && typeof flightRoot.getBoundingClientRect === 'function') {
    const rootRect = flightRoot.getBoundingClientRect()
    return {
      position: 'absolute',
      startLeft: srcRect.left - rootRect.left,
      startTop: srcRect.top - rootRect.top,
      endLeft: endLeft - rootRect.left,
      endTop: endTop - rootRect.top,
    }
  }

  return {
    position: 'fixed',
    startLeft: srcRect.left,
    startTop: srcRect.top,
    endLeft,
    endTop,
  }
}

/**
 * @param {Element} fromEl
 * @param {Element} toEl
 */
export function centerDeltaBetweenElements(fromEl, toEl) {
  if (!isPresentationDomElement(fromEl) || !isPresentationDomElement(toEl)) {
    return { dx: 0, dy: 0, ok: false }
  }
  if (typeof fromEl.getBoundingClientRect !== 'function' || typeof toEl.getBoundingClientRect !== 'function') {
    return { dx: 0, dy: 0, ok: false }
  }
  const a = fromEl.getBoundingClientRect()
  const b = toEl.getBoundingClientRect()
  const acx = a.left + a.width / 2
  const acy = a.top + a.height / 2
  const bcx = b.left + b.width / 2
  const bcy = b.top + b.height / 2
  return { dx: acx - bcx, dy: acy - bcy, ok: true }
}

/**
 * @param {import('gsap').GSAP} gsapApi
 * @param {import('gsap').core.Timeline} tl
 * @param {{
 *   card: Element,
 *   anchor: Element | null | undefined,
 *   flip: Element | null | undefined,
 *   dur: number,
 *   reserveFlipPhasing: boolean,
 *   animateFlipRotation: boolean,
 *   cardOpacityForInitialSet: number,
 *   debugTag?: 'DUNGEON_REVEAL' | 'BIDDING_DRAW',
 * }} opts
 */
export function appendCardFlyFromAnchorThenMaybeFlip(gsapApi, tl, opts) {
  const {
    card,
    anchor,
    flip,
    dur,
    reserveFlipPhasing,
    animateFlipRotation,
    cardOpacityForInitialSet,
    debugTag,
  } = opts
  const set = gsapApi?.set
  const origin = { transformOrigin: 'center center' }
  const flightRatio = reserveFlipPhasing && isPresentationDomElement(flip) ? 0.62 : 0.85
  const flightDur = dur * flightRatio
  const flipDur = Math.max(0, dur - flightDur)

  let startX = 0
  let startY = 0
  const startScale = 0.42
  let centerDelta = { dx: 0, dy: 0, ok: false }
  if (isPresentationDomElement(anchor)) {
    centerDelta = centerDeltaBetweenElements(anchor, card)
    if (centerDelta.ok) {
      startX = centerDelta.dx
      startY = centerDelta.dy
    }
  }

  if (isDungeonPresentationTraceEnabled() && debugTag) {
    const snap = (el) => {
      if (!isPresentationDomElement(el) || typeof el.getBoundingClientRect !== 'function') {
        return { present: false }
      }
      const r = el.getBoundingClientRect()
      return {
        present: true,
        tag: el.tagName,
        w: Math.round(r.width * 100) / 100,
        h: Math.round(r.height * 100) / 100,
        cx: Math.round((r.left + r.width / 2) * 100) / 100,
        cy: Math.round((r.top + r.height / 2) * 100) / 100,
      }
    }
    console.log('[dungeon-runner][card-flight]', debugTag, {
      durationSec: dur,
      flightRatio,
      flightDur,
      flipDur,
      reserveFlipPhasing,
      animateFlipRotation,
      anchor: snap(anchor),
      card: snap(card),
      flip: snap(flip),
      centerDelta,
      start: { x: Math.round(startX * 100) / 100, y: Math.round(startY * 100) / 100 },
      flightPixels: Math.hypot(startX, startY),
      gsapSet: typeof set === 'function',
    })
  }

  if (typeof set === 'function') {
    set(card, { x: startX, y: startY, scale: startScale, opacity: cardOpacityForInitialSet, ...origin })
    if (isPresentationDomElement(flip)) set(flip, { rotationY: 0, transformOrigin: 'center center' })
  }

  tl.fromTo(
    card,
    { x: startX, y: startY, scale: startScale, opacity: 0.92, ...origin },
    { x: 0, y: 0, scale: 1, opacity: 1, duration: flightDur, ease: 'power2.out', ...origin },
    0,
  )

  if (animateFlipRotation && isPresentationDomElement(flip) && flipDur > 0) {
    tl.fromTo(
      flip,
      { rotationY: 0, transformOrigin: 'center center' },
      { rotationY: 180, duration: flipDur, ease: 'power2.inOut' },
      flightDur,
    )
  } else if (flightDur < dur) {
    tl.to({}, { duration: dur - flightDur })
  }
}

/**
 * @param {import('gsap').GSAP} gsapApi
 * @param {import('gsap').core.Timeline} tl
 * @param {import('./presentationMotionCatalog/types.js').PresentationMotionContext} ctx
 * @param {{ flightTimeRatio?: number }} [flightOpts]
 */
export function addEquipmentActivationGhostFlights(gsapApi, tl, ctx, flightOpts = {}) {
  const responsibleIds = Array.isArray(ctx.payload?.responsibleEquipmentIds)
    ? ctx.payload.responsibleEquipmentIds
    : ctx.payload?.consumedEquipmentIds ?? []
  const expendedIds = Array.isArray(ctx.payload?.expendedEquipmentIds)
    ? ctx.payload.expendedEquipmentIds
    : ctx.payload?.consumedEquipmentIds ?? []
  const expendedIdSet = new Set(expendedIds)
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  if (!responsibleIds.length || dur <= 0) return

  const card = ctx.refs?.dungeonCardWrap
  const flightRoot = ctx.refs?.presentationFlightLayer
  const ratio = Math.min(1, Math.max(0.12, flightOpts.flightTimeRatio ?? 0.55))
  const flightDur = dur * ratio

  /** @type {Element[]} */
  const clones = []
  /** @type {Element[]} */
  const activationPulseSources = []
  const killTweens = gsapApi?.killTweensOf
  const removeClones = () => {
    for (const node of clones) {
      try {
        if (typeof killTweens === 'function') killTweens(node)
        if (typeof node.remove === 'function') node.remove()
        else {
          const p = node.parentNode
          if (p) p.removeChild(node)
        }
      } catch {
        /* ignore */
      }
    }
    clones.length = 0
  }
  const clearActivationPulse = () => {
    for (const node of activationPulseSources) {
      node.classList?.remove(EQUIPMENT_ACTIVATION_PULSE_CLASS)
    }
    activationPulseSources.length = 0
  }
  const cleanupGhostFlight = () => {
    removeClones()
    clearActivationPulse()
  }

  if (typeof tl.eventCallback === 'function') {
    tl.eventCallback('onKill', cleanupGhostFlight)
  }

  let warnedMissingCard = false
  const set = gsapApi?.set
  if (typeof set !== 'function') return

  for (const id of responsibleIds) {
    const source = ctx.refs?.[`equipment_${id}`]
    if (!isPresentationDomElement(source)) {
      console.warn(PRESENTATION_WARN, 'missing equipment ref for ghost flight; skipping', id)
      continue
    }
    if (!isPresentationDomElement(card)) {
      if (!warnedMissingCard) {
        console.warn(PRESENTATION_WARN, 'missing dungeon card ref for ghost flight')
        warnedMissingCard = true
      }
      continue
    }

    const srcRect =
      typeof source.getBoundingClientRect === 'function' ? source.getBoundingClientRect() : null
    let dstRect = ghostFlightTargetRect(card)
    if (!dstRect) dstRect = ghostFlightTargetRect(ctx.refs?.presentationGhostTarget)
    if (!srcRect || !dstRect || !(srcRect.width > 0) || !(srcRect.height > 0)) {
      console.warn(PRESENTATION_WARN, 'layout not ready for ghost flight; skipping', id)
      continue
    }

    const clone = typeof source.cloneNode === 'function' ? source.cloneNode(true) : null
    if (!isPresentationDomElement(clone)) continue

    clone.setAttribute('aria-hidden', 'true')
    clone.setAttribute(PRESENTATION_EQUIPMENT_GHOST_ATTR, '')
    clone.classList?.remove('full-width')

    const mount =
      isPresentationDomElement(flightRoot) && typeof flightRoot.appendChild === 'function'
        ? flightRoot
        : typeof document !== 'undefined' && document.body
          ? document.body
          : null
    if (!mount) {
      console.warn(PRESENTATION_WARN, 'no flight mount; skipping ghost flight', id)
      continue
    }
    mount.appendChild(clone)
    clones.push(clone)

    const isExpended = expendedIdSet.has(id)
    if (isExpended) {
      set(source, { opacity: 0.38, filter: 'brightness(0.85)' })
    } else {
      source.classList?.add(EQUIPMENT_ACTIVATION_PULSE_CLASS)
      activationPulseSources.push(source)
      const pulseDur = Math.min(0.22, dur * 0.32)
      const fadeDur = Math.max(0.12, dur - pulseDur)
      tl.fromTo(
        source,
        {
          '--dr-equip-activation-glow-opacity': 0,
          scale: 1,
          transformOrigin: 'center center',
        },
        {
          '--dr-equip-activation-glow-opacity': 1,
          scale: 1.05,
          duration: pulseDur,
          ease: 'power2.out',
        },
        0,
      )
      tl.to(
        source,
        {
          '--dr-equip-activation-glow-opacity': 0,
          scale: 1,
          duration: fadeDur,
          ease: 'power2.inOut',
        },
        pulseDur,
      )
    }

    const flightCoords = ghostFlightCloneCoords(
      mount === flightRoot ? flightRoot : null,
      srcRect,
      dstRect,
    )

    set(clone, {
      position: flightCoords.position,
      left: flightCoords.startLeft,
      top: flightCoords.startTop,
      width: srcRect.width,
      height: srcRect.height,
      maxWidth: srcRect.width,
      maxHeight: srcRect.height,
      margin: 0,
      boxSizing: 'border-box',
      pointerEvents: 'none',
      zIndex: 10050,
      overflow: 'hidden',
    })

    tl.to(
      clone,
      {
        left: flightCoords.endLeft,
        top: flightCoords.endTop,
        duration: flightDur,
        ease: 'power2.inOut',
      },
      0,
    )
  }

  if (typeof tl.add === 'function') {
    if (clones.length) tl.add(removeClones, flightDur)
    if (activationPulseSources.length) tl.add(clearActivationPulse, dur)
  }
}

/** @type {import('./presentationMotionCatalog/types.js').PresentationMotionInterpreterHelpers} */
export const presentationMotionInterpreterHelpers = {
  isDomElement: isPresentationDomElement,
  appendCardFlyFromAnchorThenMaybeFlip,
  addEquipmentActivationGhostFlights,
  centerDeltaBetweenElements,
}
