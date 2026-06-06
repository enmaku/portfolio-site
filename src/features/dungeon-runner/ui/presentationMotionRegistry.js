import gsap from 'gsap'

import { isDungeonPresentationTraceEnabled } from './dungeonPresentationTrace.js'
import { ORCHESTRATOR_PRESENTATION_KINDS } from './orchestratorPresentationKinds.js'

/**
 * @typedef {import('./orchestratorPresentationKinds.js').OrchestratorPresentationKind} OrchestratorPresentationKind
 */

const PRESENTATION_WARN = '[dungeon-runner presentation]'

/** Mark DOM clones from {@link addConsumedEquipmentGhostFlights} so teardown can purge stragglers. */
export const PRESENTATION_EQUIPMENT_GHOST_ATTR = 'data-dr-presentation-equipment-ghost'

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

function isDomElement(value) {
  return value != null && typeof value === 'object' && value.nodeType === 1
}

function ghostFlightTargetRect(el) {
  if (!isDomElement(el) || typeof el.getBoundingClientRect !== 'function') return null
  const r = el.getBoundingClientRect()
  if (!(r.width > 2) || !(r.height > 2)) return null
  return r
}

/**
 * Viewport rects → clone `left`/`top` for ghost flight. Prefer layer-local `absolute`
 * coords on `presentationFlightLayer` so motion stays aligned when an ancestor (project
 * shell desktop frame) uses `transform` and re-parents `position: fixed`.
 *
 * @param {Element | null | undefined} flightRoot
 * @param {DOMRect} srcRect
 * @param {DOMRect} dstRect
 */
function ghostFlightCloneCoords(flightRoot, srcRect, dstRect) {
  const endLeft = dstRect.left + dstRect.width / 2 - srcRect.width / 2
  const endTop = dstRect.top + dstRect.height / 2 - srcRect.height / 2

  if (isDomElement(flightRoot) && typeof flightRoot.getBoundingClientRect === 'function') {
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
 * @returns {{ dx: number, dy: number, ok: boolean }}
 */
function centerDeltaBetweenElements(fromEl, toEl) {
  if (!isDomElement(fromEl) || !isDomElement(toEl)) return { dx: 0, dy: 0, ok: false }
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
 * Fly `.dr-dungeon-card-motion-wrap` from a pile badge toward the slot, then optionally rotate the flip axis.
 * Shared by dungeon reveal and bidding draw (anchor + flip phasing differ per caller).
 *
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
function appendCardFlyFromAnchorThenMaybeFlip(gsapApi, tl, opts) {
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
  const flightRatio = reserveFlipPhasing && isDomElement(flip) ? 0.62 : 0.85
  const flightDur = dur * flightRatio
  const flipDur = Math.max(0, dur - flightDur)

  let startX = 0
  let startY = 0
  const startScale = 0.42
  let centerDelta = { dx: 0, dy: 0, ok: false }
  if (isDomElement(anchor)) {
    centerDelta = centerDeltaBetweenElements(anchor, card)
    if (centerDelta.ok) {
      startX = centerDelta.dx
      startY = centerDelta.dy
    }
  }

  if (isDungeonPresentationTraceEnabled() && debugTag) {
    const snap = (el) => {
      if (!isDomElement(el) || typeof el.getBoundingClientRect !== 'function') {
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
    if (isDomElement(flip)) set(flip, { rotationY: 0, transformOrigin: 'center center' })
  }

  tl.fromTo(
    card,
    { x: startX, y: startY, scale: startScale, opacity: 0.92, ...origin },
    { x: 0, y: 0, scale: 1, opacity: 1, duration: flightDur, ease: 'power2.out', ...origin },
    0,
  )

  if (animateFlipRotation && isDomElement(flip) && flipDur > 0) {
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

export const EQUIPMENT_ACTIVATION_PULSE_CLASS = 'dr-equip-token--activation-pulse'

/**
 * Ghost flight for `payload.responsibleEquipmentIds`: clone → fixed layer → tween toward card. Sources
 * whose id is in `payload.expendedEquipmentIds` are dimmed in place (single-use feel matching bidding
 * sacrifice); other source tiles get a brief sunlight-colored activation pulse instead. Falls back to
 * `payload.consumedEquipmentIds` if the new payload fields are absent (back-compat).
 *
 * Skips missing refs with `console.warn` only. Cleans clones on segment end and timeline kill.
 *
 * @param {import('gsap').GSAP} gsapApi
 * @param {import('gsap').core.Timeline} tl
 * @param {PresentationMotionContext} ctx
 * @param {{ flightTimeRatio?: number }} [flightOpts]
 */
function addEquipmentActivationGhostFlights(gsapApi, tl, ctx, flightOpts = {}) {
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
    if (!isDomElement(source)) {
      console.warn(PRESENTATION_WARN, 'missing equipment ref for ghost flight; skipping', id)
      continue
    }
    if (!isDomElement(card)) {
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
    if (
      !srcRect ||
      !dstRect ||
      !(srcRect.width > 0) ||
      !(srcRect.height > 0)
    ) {
      console.warn(PRESENTATION_WARN, 'layout not ready for ghost flight; skipping', id)
      continue
    }

    const clone =
      typeof source.cloneNode === 'function' ? source.cloneNode(true) : null
    if (!isDomElement(clone)) continue

    clone.setAttribute('aria-hidden', 'true')
    clone.setAttribute(PRESENTATION_EQUIPMENT_GHOST_ATTR, '')
    clone.classList?.remove('full-width')

    const mount =
      isDomElement(flightRoot) && typeof flightRoot.appendChild === 'function'
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

/**
 * DOM refs for GSAP (`DungeonRunnerPage` passes these from `getMotionRefs`):
 *
 * - **`boardShell`** — `.dr-board-shell` wrapper around the live bidding/dungeon board. Most beats run a short shared opacity pulse here for `durationMs` (no horizontal `x` — translating this node shifted the whole in-match UI). Composited in parallel with kind-specific tweens via {@link createPresentationMotionTimeline}. Card-level motion uses `dungeonCardWrap` / flip axis / badges.
 * - **`dungeonCardWrap`** — `.dr-dungeon-card-motion-wrap` around the hero/dungeon card (HP chip stays outside this node). `DUNGEON_REVEAL` tweens `opacity` / `y` / `scale` here (parallel `rotationY` on `dungeonCardFlipAxis`); `DUNGEON_DAMAGE` / `DUNGEON_NEUTRALIZE` / `DUNGEON_CONTINUE` run combat / continue tweens here plus the parallel `boardShell` placeholder in {@link createPresentationMotionTimeline}. `DUNGEON_OUTCOME` runs only on the wrap (vertical + `rotationZ`, brief peak hold — no `x` shake/strike) **without** paralleling `boardShell`; teardown clears wrap **and** shell so idle / post-ack deferred beats start from a neutral baseline. All dungeon card beats are GSAP-only — no queue-driven `dr-dungeon-hit` / `dr-dungeon-strike` / `dr-dungeon-consume` CSS. `BIDDING_DRAW` / `BIDDING_SACRIFICE` run bidding card motion here.
 * - **`dungeonCardFlipAxis`** — inner flip pivot in `MonsterCardFace` (`transform-style: preserve-3d`). `DUNGEON_REVEAL` tweens `rotationY` 0→180 here; inline props cleared on teardown so settled rotation comes from the card’s CSS when `faceDown` is false.
 * - **`deckBadge`** — deck pile control; `BIDDING_ADD` / `BIDDING_DRAW` anchor deck motion here.
 * - **`heroChangeInterstitialOverlay`** — full-screen `.dr-hero-interstitial` control. `HERO_CHANGE_INTERSTITIAL` runs entrance / hold / exit here only (the board shell is not tweened for this beat).
 * - **`presentationFlightLayer`** — absolutely positioned, `pointer-events: none` host for equipment ghost clones (`DUNGEON_NEUTRALIZE`, `BIDDING_SACRIFICE`); clones use layer-local `absolute` coords (not viewport `fixed`).
 * - **`equipment_<id>`** — in-play equipment token cell. Iterated from `payload.responsibleEquipmentIds` (`consumedEquipmentIds` retained as a back-compat alias). Source tile dims when `id` is in `payload.expendedEquipmentIds`; otherwise it gets a brief sunlight-colored activation pulse during the ghost flight.
 *
 * @typedef {{
 *   kind: OrchestratorPresentationKind,
 *   durationMs: number,
 *   payload?: { consumedEquipmentIds?: string[] } | Record<string, unknown>,
 *   refs?: {
 *     boardShell?: Element,
 *     dungeonCardWrap?: Element,
 *     dungeonCardFlipAxis?: Element,
 *     deckBadge?: Element,
 *     heroChangeInterstitialOverlay?: Element,
 *     presentationFlightLayer?: Element,
 *     presentationGhostTarget?: Element,
 *     [key: string]: unknown,
 *   },
 * }} PresentationMotionContext
 */

/**
 * Beats whose motion should not continue across a viewport resize: ghost flight (fixed positioning from
 * `getBoundingClientRect`, GitHub #68) or dungeon reveal (`dungeonCardFlipAxis` rotationY).
 * On window resize, callers should drop that motion and continue with
 * {@link createPresentationResizeFallbackMotionTimeline} for the remaining beat time. Orchestrator queue
 * timing stays unchanged (see GitHub #68); this is presentation-only (GitHub #71).
 *
 * @param {OrchestratorPresentationKind} kind
 * @param {{ consumedEquipmentIds?: string[] }|undefined} [payload]
 */
export function presentationMotionIsLayoutFragile(kind, payload) {
  if (kind === 'DUNGEON_REVEAL') return true
  if (kind === 'BIDDING_DRAW' || kind === 'BIDDING_ADD') return true
  if (kind === 'DUNGEON_NEUTRALIZE' || kind === 'BIDDING_SACRIFICE') {
    const ids = payload?.responsibleEquipmentIds ?? payload?.consumedEquipmentIds ?? []
    return ids.length > 0
  }
  return false
}

/**
 * Shell + dungeon card wrap only (no flight clones, no flip axis). Used after resize during a fragile beat.
 *
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createPresentationResizeFallbackMotionTimeline(gsapApi, ctx) {
  const tl = gsapApi.timeline({ paused: true })
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const boardShell = ctx.refs?.boardShell
  const card = ctx.refs?.dungeonCardWrap
  let hasTween = false
  if (isDomElement(boardShell) && dur > 0) {
    tl.fromTo(
      boardShell,
      { opacity: 0.94 },
      { opacity: 1, duration: dur, ease: 'power1.out' },
      0,
    )
    hasTween = true
  }
  if (isDomElement(card) && dur > 0) {
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
 * Ref keys that received GSAP transforms for `kind`, used when clearing inline props on teardown.
 * Keep in sync with each factory and with {@link createPresentationMotionTimeline} parallel `boardShell` beat when present (not used for `HERO_CHANGE_INTERSTITIAL`). `DUNGEON_OUTCOME` does not tween `boardShell` but lists it so teardown clears any stale shell props after the beat (GitHub #66).
 *
 * @param {OrchestratorPresentationKind} kind
 * @param {{ consumedEquipmentIds?: string[] }|undefined} [payload]
 * @returns {readonly string[]}
 */
export function presentationMotionClearKeys(kind, payload) {
  if (kind === 'DUNGEON_REVEAL') return ['dungeonCardWrap', 'dungeonCardFlipAxis', 'dungeonPileBadge', 'boardShell']
  if (kind === 'DUNGEON_DAMAGE' || kind === 'DUNGEON_CONTINUE') return ['dungeonCardWrap', 'boardShell']
  if (kind === 'DUNGEON_OUTCOME') return ['dungeonCardWrap', 'boardShell']
  if (kind === 'DUNGEON_NEUTRALIZE') {
    const keys = ['dungeonCardWrap', 'boardShell']
    const ids = payload?.responsibleEquipmentIds ?? payload?.consumedEquipmentIds ?? []
    for (const id of ids) {
      keys.push(`equipment_${id}`)
    }
    return keys
  }
  if (kind === 'HERO_CHANGE_INTERSTITIAL') return ['heroChangeInterstitialOverlay']
  if (kind === 'BIDDING_DRAW') return ['dungeonCardWrap', 'dungeonCardFlipAxis', 'boardShell']
  if (kind === 'BIDDING_ADD') return ['dungeonCardWrap', 'dungeonCardFlipAxis', 'deckBadge', 'dungeonPileBadge', 'boardShell']
  if (kind === 'BIDDING_SACRIFICE') {
    const keys = ['dungeonCardWrap', 'boardShell']
    const ids = payload?.responsibleEquipmentIds ?? payload?.consumedEquipmentIds ?? []
    for (const id of ids) {
      keys.push(`equipment_${id}`)
    }
    return keys
  }
  return ['boardShell']
}

/**
 * Shell-only beat (phase / turn kinds). Specialized kinds use this only when explicitly routed here.
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createBoardShellPresentationMotionTimeline(gsapApi, ctx) {
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
 * Dungeon reveal: fly card from dungeon pile anchor to slot (scale up), then flip face-up (same rhythm as bidding draw).
 *
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createDungeonRevealPresentationMotionTimeline(gsapApi, ctx) {
  const card = ctx.refs?.dungeonCardWrap
  const pile = ctx.refs?.dungeonPileBadge
  const flip = ctx.refs?.dungeonCardFlipAxis
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })

  if (!isDomElement(card) || dur <= 0) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }

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
}

/**
 * Dungeon damage: horizontal shake + saturation bump on `.dr-dungeon-card-motion-wrap` (HP chip stays a sibling).
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createDungeonDamagePresentationMotionTimeline(gsapApi, ctx) {
  const el = ctx.refs?.dungeonCardWrap
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  if (!el || typeof el !== 'object' || el.nodeType !== 1) {
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
    tl.to(
      el,
      {
        x: off,
        opacity: 0,
        duration: exitDur,
        ease: 'power3.in',
      },
      exitStart,
    )
  }
  return tl
}

/**
 * Dungeon neutralize: horizontal strike on card wrap plus brightness dip (replaces stage `--strike` / `--consume` CSS).
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createDungeonNeutralizePresentationMotionTimeline(gsapApi, ctx) {
  const el = ctx.refs?.dungeonCardWrap
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  addEquipmentActivationGhostFlights(gsapApi, tl, ctx, { flightTimeRatio: 0.55 })
  if (!isDomElement(el)) {
    if (dur > 0) {
      const played = typeof tl.duration === 'function' ? tl.duration() : 0
      if (played < dur) tl.to({}, { duration: dur - played })
    }
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

  // Final-monster defeats keep the card visible for the outcome pose; otherwise slide off right.
  const isFinalDefeat = ctx.payload?.isFinalDungeonMonsterDefeat === true
  const exitStart = dur > 0 ? Math.min(dur * 0.58, dur - Math.max(0.22, dur * 0.12)) : 0
  const exitDur = dur > exitStart ? dur - exitStart : 0
  if (!isFinalDefeat && exitDur > 0) {
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
    tl.to(
      el,
      {
        x: off,
        opacity: 0,
        duration: exitDur,
        ease: 'power3.in',
      },
      exitStart,
    )
  }

  const played = typeof tl.duration === 'function' ? tl.duration() : dur
  if (played < dur) tl.to({}, { duration: dur - played })
  return tl
}

/**
 * Dungeon continue: brightness dip on card wrap (replaces stage `--consume` CSS).
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createDungeonContinuePresentationMotionTimeline(gsapApi, ctx) {
  const el = ctx.refs?.dungeonCardWrap
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  if (!el || typeof el !== 'object' || el.nodeType !== 1) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }
  tl.fromTo(
    el,
    { filter: 'brightness(1)' },
    { filter: 'brightness(0.88)', duration: dur, ease: 'power1.out' },
  )
  return tl
}

/**
 * Dungeon run outcome: vertical + `rotationZ` on the card wrap only (no horizontal shake/strike; no parallel boardShell).
 * Uses a short peak hold so the beat reads as a resolution pose, not combat recoil (GitHub #66).
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createDungeonOutcomePresentationMotionTimeline(gsapApi, ctx) {
  const el = ctx.refs?.dungeonCardWrap
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  const result = ctx.payload?.dungeonRunResult ?? null
  if (!el || typeof el !== 'object' || el.nodeType !== 1) {
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
      {
        ...sagVars,
        duration: sink,
        ease: 'power2.in',
      },
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
    const peakVars = {
      x: 0,
      y: -10,
      scale: 1.07,
      rotationZ: -7,
      boxShadow: '0 0 0 3px rgba(76, 175, 80, 0.55), 0 16px 36px rgba(0, 0, 0, 0.4)',
      filter: 'brightness(1.07)',
      ...origin,
    }
    tl.fromTo(
      el,
      {
        x: 0,
        y: 0,
        scale: 1,
        rotationZ: 0,
        boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)',
        filter: 'brightness(1)',
        ...origin,
      },
      {
        ...peakVars,
        duration: rise,
        ease: 'power2.out',
      },
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
        boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)',
        filter: 'brightness(1)',
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
      {
        ...peakVars,
        duration: rise,
        ease: 'power2.out',
      },
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
}

/**
 * Bidding draw: fly card from deck anchor to slot (scale up), optional privileged flip after landing.
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createBiddingDrawPresentationMotionTimeline(gsapApi, ctx) {
  const card = ctx.refs?.dungeonCardWrap
  const deck = ctx.refs?.deckBadge
  const flip = ctx.refs?.dungeonCardFlipAxis
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  const payload = ctx.payload ?? {}
  const shouldFlip = payload.shouldFlipFaceAfterArrival === true

  if (!isDomElement(card) || dur <= 0) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }

  const flipEl = isDomElement(flip) ? flip : null
  appendCardFlyFromAnchorThenMaybeFlip(gsapApi, tl, {
    card,
    anchor: deck,
    flip: flipEl,
    dur,
    reserveFlipPhasing: shouldFlip && !!flipEl,
    animateFlipRotation: shouldFlip && !!flipEl,
    cardOpacityForInitialSet: 1,
    debugTag: 'BIDDING_DRAW',
  })

  return tl
}

/**
 * Bidding add-to-dungeon: optional flip face-down for privileged viewer, then card flies toward dungeon pile.
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createBiddingAddPresentationMotionTimeline(gsapApi, ctx) {
  const card = ctx.refs?.dungeonCardWrap
  const dungeonPile = ctx.refs?.dungeonPileBadge
  const flip = ctx.refs?.dungeonCardFlipAxis
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  const payload = ctx.payload ?? {}
  const shouldFlipDown = payload.shouldFlipToBackBeforeDungeon === true

  if (!isDomElement(card) || dur <= 0) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }

  const origin = { transformOrigin: 'center center' }
  let flipDur = 0
  let flyDur = dur
  if (shouldFlipDown && isDomElement(flip)) {
    flipDur = Math.min(dur * 0.28, 0.45)
    flyDur = Math.max(0.08, dur - flipDur)
    tl.fromTo(
      flip,
      { rotationY: 180, transformOrigin: 'center center' },
      { rotationY: 0, duration: flipDur, ease: 'power2.inOut' },
      0,
    )
  }

  let endX = typeof window !== 'undefined' ? window.innerWidth * 0.22 : 180
  let endY = -12
  if (isDomElement(dungeonPile)) {
    const d = centerDeltaBetweenElements(dungeonPile, card)
    if (d.ok) {
      endX = d.dx
      endY = d.dy
    }
  }

  tl.to(
    card,
    {
      x: endX,
      y: endY,
      scale: 0.38,
      opacity: 0.65,
      duration: flyDur,
      ease: 'power2.in',
      ...origin,
    },
    flipDur,
  )

  return tl
}

/**
 * Bidding sacrifice: equipment ghost + card stress, then exit stage right.
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createBiddingSacrificePresentationMotionTimeline(gsapApi, ctx) {
  const card = ctx.refs?.dungeonCardWrap
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  const consumedIds = ctx.payload?.responsibleEquipmentIds ?? ctx.payload?.consumedEquipmentIds ?? []
  const hasCard = isDomElement(card)

  addEquipmentActivationGhostFlights(gsapApi, tl, ctx, { flightTimeRatio: 0.58 })

  if (!hasCard && consumedIds.length === 0) {
    if (dur > 0) {
      const played = typeof tl.duration === 'function' ? tl.duration() : 0
      if (played < dur) tl.to({}, { duration: dur - played })
    }
    return tl
  }

  const pulseDur = dur > 0 ? Math.max(0.08, dur / 6) : 0
  const exitStart = dur > 0 ? Math.min(dur * 0.58, dur - Math.max(0.22, dur * 0.12)) : 0
  const exitDur = dur > exitStart ? dur - exitStart : 0

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

  const played = typeof tl.duration === 'function' ? tl.duration() : dur
  if (played < dur) tl.to({}, { duration: dur - played })
  return tl
}

/**
 * Hero handoff overlay (`heroChangeInterstitialOverlay`) only.
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createHeroChangeInterstitialPresentationMotionTimeline(gsapApi, ctx) {
  const tl = gsapApi.timeline({ paused: true })
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const overlay = ctx.refs?.heroChangeInterstitialOverlay
  const dur = ms / 1000
  if (!overlay || typeof overlay !== 'object' || overlay.nodeType !== 1 || ms <= 0) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }
  const inDur = dur * 0.18
  const holdDur = dur * 0.64
  const outDur = dur * 0.18
  tl.fromTo(
    overlay,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: inDur, ease: 'power2.out' },
  )
  tl.to(overlay, { duration: holdDur })
  tl.to(overlay, { autoAlpha: 0, duration: outDur, ease: 'power2.in' })
  return tl
}

function presentationMotionFactoryForKind(kind) {
  if (kind === 'DUNGEON_REVEAL') return createDungeonRevealPresentationMotionTimeline
  if (kind === 'DUNGEON_DAMAGE') return createDungeonDamagePresentationMotionTimeline
  if (kind === 'DUNGEON_NEUTRALIZE') return createDungeonNeutralizePresentationMotionTimeline
  if (kind === 'DUNGEON_CONTINUE') return createDungeonContinuePresentationMotionTimeline
  if (kind === 'DUNGEON_OUTCOME') return createDungeonOutcomePresentationMotionTimeline
  if (kind === 'HERO_CHANGE_INTERSTITIAL') return createHeroChangeInterstitialPresentationMotionTimeline
  if (kind === 'BIDDING_DRAW') return createBiddingDrawPresentationMotionTimeline
  if (kind === 'BIDDING_ADD') return createBiddingAddPresentationMotionTimeline
  if (kind === 'BIDDING_SACRIFICE') return createBiddingSacrificePresentationMotionTimeline
  return createBoardShellPresentationMotionTimeline
}

/** @type {Readonly<Record<OrchestratorPresentationKind, typeof createBoardShellPresentationMotionTimeline | typeof createDungeonRevealPresentationMotionTimeline | typeof createDungeonDamagePresentationMotionTimeline | typeof createDungeonNeutralizePresentationMotionTimeline | typeof createDungeonContinuePresentationMotionTimeline | typeof createHeroChangeInterstitialPresentationMotionTimeline | typeof createBiddingDrawPresentationMotionTimeline | typeof createBiddingAddPresentationMotionTimeline | typeof createBiddingSacrificePresentationMotionTimeline>>} */
export const PRESENTATION_MOTION_REGISTRY = Object.freeze(
  Object.fromEntries(
    ORCHESTRATOR_PRESENTATION_KINDS.map((kind) => [kind, presentationMotionFactoryForKind(kind)]),
  ),
)

/**
 * @param {import('gsap').GSAP} [gsapApi]
 * @param {PresentationMotionContext} ctx
 */
export function createPresentationMotionTimeline(gsapApi = gsap, ctx) {
  const factory = PRESENTATION_MOTION_REGISTRY[ctx.kind]
  if (!factory) {
    throw new Error(`No presentation motion factory for kind: ${ctx.kind}`)
  }
  const inner = factory(gsapApi, ctx)
  if (factory === createBoardShellPresentationMotionTimeline) {
    return inner
  }
  if (ctx.kind === 'HERO_CHANGE_INTERSTITIAL') {
    return inner
  }
  if (ctx.kind === 'DUNGEON_OUTCOME') {
    return inner
  }
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const boardShell = ctx.refs?.boardShell
  if (!isDomElement(boardShell) || dur <= 0) {
    return inner
  }
  const master = gsapApi.timeline({ paused: true })
  master.add(inner, 0)
  // Nested timelines default to paused; a paused child added via .add() does not run and has zero
  // duration until unpaused — play() on the parent does not drive it (GSAP 3). Outcome/reveal paths
  // that return `inner` alone work because usePresentationMotion calls play() on that timeline.
  if (typeof inner.paused === 'function') inner.paused(false)
  master.fromTo(
    boardShell,
    { opacity: 0.92 },
    { opacity: 1, duration: dur, ease: 'power1.out' },
    0,
  )
  return master
}
