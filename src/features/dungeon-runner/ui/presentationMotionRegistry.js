import gsap from 'gsap'

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

/**
 * Ghost flight for `payload.consumedEquipmentIds`: clone → fixed layer → tween toward card; source dimmed in place.
 * Skips missing refs with `console.warn` only. Cleans clones on segment end and timeline kill.
 *
 * @param {import('gsap').GSAP} gsapApi
 * @param {import('gsap').core.Timeline} tl
 * @param {PresentationMotionContext} ctx
 * @param {{ flightTimeRatio?: number }} [flightOpts]
 */
function addConsumedEquipmentGhostFlights(gsapApi, tl, ctx, flightOpts = {}) {
  const ids = ctx.payload?.consumedEquipmentIds ?? []
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  if (!ids.length || dur <= 0) return

  const card = ctx.refs?.dungeonCardWrap
  const flightRoot = ctx.refs?.presentationFlightLayer
  const ratio = Math.min(1, Math.max(0.12, flightOpts.flightTimeRatio ?? 0.55))
  const flightDur = dur * ratio

  /** @type {Element[]} */
  const clones = []
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

  if (typeof tl.eventCallback === 'function') {
    tl.eventCallback('onKill', removeClones)
  }

  let warnedMissingCard = false
  const set = gsapApi?.set
  if (typeof set !== 'function') return

  for (const id of ids) {
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
    const dstRect = typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null
    if (
      !srcRect ||
      !dstRect ||
      !(srcRect.width > 0) ||
      !(srcRect.height > 0) ||
      !(dstRect.width > 0) ||
      !(dstRect.height > 0)
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

    set(source, { opacity: 0.38, filter: 'brightness(0.85)' })
    set(clone, {
      position: 'fixed',
      left: srcRect.left,
      top: srcRect.top,
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

    const destLeft = dstRect.left + dstRect.width / 2 - srcRect.width / 2
    const destTop = dstRect.top + dstRect.height / 2 - srcRect.height / 2

    tl.to(
      clone,
      {
        left: destLeft,
        top: destTop,
        duration: flightDur,
        ease: 'power2.inOut',
      },
      0,
    )
  }

  if (clones.length && typeof tl.add === 'function') {
    tl.add(removeClones, flightDur)
  }
}

/**
 * DOM refs for GSAP (`DungeonRunnerPage` passes these from `getMotionRefs`):
 *
 * - **`boardShell`** — `.dr-board-shell` wrapper around the live bidding/dungeon board. Most beats run a short shared opacity pulse here for `durationMs` (no horizontal `x` — translating this node shifted the whole in-match UI). Composited in parallel with kind-specific tweens via {@link createPresentationMotionTimeline}. Card-level motion uses `dungeonCardWrap` / flip axis / badges.
 * - **`dungeonCardWrap`** — `.dr-dungeon-card-motion-wrap` around the hero/dungeon card (HP chip stays outside this node). `DUNGEON_REVEAL` tweens `opacity` / `y` / `scale` here (parallel `rotationY` on `dungeonCardFlipAxis`); `DUNGEON_DAMAGE` / `DUNGEON_NEUTRALIZE` / `DUNGEON_CONTINUE` run combat / continue tweens here plus the parallel `boardShell` placeholder in {@link createPresentationMotionTimeline}. `DUNGEON_OUTCOME` runs only on the wrap (vertical + `rotationZ`, brief peak hold — no `x` shake/strike) **without** paralleling `boardShell`; teardown clears wrap **and** shell so idle / post-ack deferred beats start from a neutral baseline. All dungeon card beats are GSAP-only — no queue-driven `dr-dungeon-hit` / `dr-dungeon-strike` / `dr-dungeon-consume` CSS. `BOT_BIDDING_DRAW` / `BOT_BIDDING_SACRIFICE` run bidding emphasis tweens here.
 * - **`dungeonCardFlipAxis`** — inner flip pivot in `MonsterCardFace` (`transform-style: preserve-3d`). `DUNGEON_REVEAL` tweens `rotationY` 0→180 here; inline props cleared on teardown so settled rotation comes from the card’s CSS when `faceDown` is false.
 * - **`deckBadge`** — deck pile control; `BOT_BIDDING_ADD` tweens inset emphasis here.
 * - **`heroChangeInterstitialOverlay`** — full-screen `.dr-hero-interstitial` control. `HERO_CHANGE_INTERSTITIAL` runs entrance / hold / exit here only (the board shell is not tweened for this beat).
 * - **`presentationFlightLayer`** — absolutely positioned, `pointer-events: none` host for fixed-position equipment ghost clones (`DUNGEON_NEUTRALIZE`, `BOT_BIDDING_SACRIFICE`).
 * - **`equipment_<id>`** — in-play equipment token cell (`consumedEquipmentIds` from queue payload).
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
  if (kind === 'DUNGEON_NEUTRALIZE' || kind === 'BOT_BIDDING_SACRIFICE') {
    const ids = payload?.consumedEquipmentIds ?? []
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
  if (kind === 'DUNGEON_REVEAL') return ['dungeonCardWrap', 'dungeonCardFlipAxis', 'boardShell']
  if (kind === 'DUNGEON_DAMAGE' || kind === 'DUNGEON_CONTINUE') return ['dungeonCardWrap', 'boardShell']
  if (kind === 'DUNGEON_OUTCOME') return ['dungeonCardWrap', 'boardShell']
  if (kind === 'DUNGEON_NEUTRALIZE') {
    const keys = ['dungeonCardWrap', 'boardShell']
    for (const id of payload?.consumedEquipmentIds ?? []) {
      keys.push(`equipment_${id}`)
    }
    return keys
  }
  if (kind === 'HERO_CHANGE_INTERSTITIAL') return ['heroChangeInterstitialOverlay']
  if (kind === 'BOT_BIDDING_DRAW') return ['dungeonCardWrap', 'boardShell']
  if (kind === 'BOT_BIDDING_ADD') return ['deckBadge', 'boardShell']
  if (kind === 'BOT_BIDDING_SACRIFICE') {
    const keys = ['dungeonCardWrap', 'boardShell']
    for (const id of payload?.consumedEquipmentIds ?? []) {
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
 * Dungeon reveal: card wrapper opacity / translate / scale plus `rotationY` on `dungeonCardFlipAxis` (faces stay static in 3D).
 * View-model keeps species gated until after the beat; DOM may mount front art via `frontFaceSpecies` for the flip.
 *
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createDungeonRevealPresentationMotionTimeline(gsapApi, ctx) {
  const el = ctx.refs?.dungeonCardWrap
  const flip = ctx.refs?.dungeonCardFlipAxis
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  const hasWrap = isDomElement(el)
  const hasFlip = isDomElement(flip)
  if (!hasWrap && !hasFlip) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }
  if (hasWrap) {
    tl.fromTo(
      el,
      {
        opacity: 0.88,
        y: 12,
        scale: 0.94,
        transformOrigin: 'center center',
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: dur,
        ease: 'power2.out',
      },
      0,
    )
  }
  if (hasFlip) {
    tl.fromTo(
      flip,
      { rotationY: 0, transformOrigin: 'center center' },
      { rotationY: 180, duration: dur, ease: 'power2.inOut' },
      0,
    )
  }
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
  tl.fromTo(
    el,
    { x: 0, filter: 'saturate(1)', ...origin },
    { x: -7, filter: 'saturate(1.38)', duration: hit, ease: 'power2.out', ...origin },
    0,
  )
  tl.to(el, { x: 6, duration: swing1, ease: 'power1.inOut', ...origin }, hit)
  tl.to(el, { x: -4, duration: swing2, ease: 'power1.inOut', ...origin }, hit + swing1)
  tl.to(el, { x: 0, filter: 'saturate(1)', duration: settle, ease: 'power2.out', ...origin }, hit + swing1 + swing2)
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
  addConsumedEquipmentGhostFlights(gsapApi, tl, ctx, { flightTimeRatio: 0.55 })
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
 * Bot draw: cool rim glow + lift on the card wrap, then a short vertical bob (GSAP-only; no bidding-board CSS keyframes).
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createBotBiddingDrawPresentationMotionTimeline(gsapApi, ctx) {
  const el = ctx.refs?.dungeonCardWrap
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  if (!el || typeof el !== 'object' || el.nodeType !== 1 || dur <= 0) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }
  const origin = { transformOrigin: 'center center' }
  const glowIn = Math.min(0.2, dur * 0.26)
  const glowOut = Math.min(0.18, dur * 0.22)
  tl.fromTo(
    el,
    {
      y: 0,
      scale: 1,
      boxShadow: '0 0 0 0 rgba(33, 150, 243, 0)',
      ...origin,
    },
    {
      y: -5,
      scale: 1.045,
      boxShadow: '0 0 24px 2px rgba(33, 150, 243, 0.42)',
      duration: glowIn,
      ease: 'power2.out',
      ...origin,
    },
    0,
  )
  tl.to(
    el,
    {
      y: -2,
      scale: 1.02,
      boxShadow: '0 0 0 0 rgba(33, 150, 243, 0)',
      duration: glowOut,
      ease: 'power2.inOut',
      ...origin,
    },
    glowIn,
  )
  let placed = glowIn + glowOut
  const half = Math.min(0.22, Math.max(0.08, (dur - placed) / 6))
  while (placed + half * 2 <= dur + 0.001) {
    tl.to(el, { y: -3, scale: 1.03, duration: half, ease: 'sine.inOut', ...origin })
    tl.to(el, { y: 0, scale: 1, duration: half, ease: 'sine.inOut', ...origin })
    placed += half * 2
  }
  if (placed < dur) tl.to({}, { duration: dur - placed })
  return tl
}

/**
 * Bot add-to-dungeon: warm inset ring + slight scale on the deck pile badge (GSAP-only).
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createBotBiddingAddPresentationMotionTimeline(gsapApi, ctx) {
  const el = ctx.refs?.deckBadge
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  if (!el || typeof el !== 'object' || el.nodeType !== 1 || dur <= 0) {
    if (dur > 0) tl.to({}, { duration: dur })
    return tl
  }
  tl.fromTo(
    el,
    { boxShadow: 'inset 0 0 0 0px rgba(255, 213, 79, 0)', scale: 1, transformOrigin: 'center center' },
    {
      boxShadow: 'inset 0 0 0 2px rgba(255, 213, 79, 0.75)',
      scale: 1.04,
      duration: dur / 2,
      ease: 'power1.inOut',
      yoyo: true,
      repeat: 1,
      transformOrigin: 'center center',
    },
  )
  return tl
}

/**
 * Bot sacrifice: ghost flight from `payload.consumedEquipmentIds` equipment refs + card brightness dip (same ghost path as neutralize; GSAP-only).
 * @param {import('gsap').GSAP} gsapApi
 * @param {PresentationMotionContext} ctx
 */
export function createBotBiddingSacrificePresentationMotionTimeline(gsapApi, ctx) {
  const card = ctx.refs?.dungeonCardWrap
  const ms = Math.max(0, Number(ctx.durationMs) || 0)
  const dur = ms / 1000
  const tl = gsapApi.timeline({ paused: true })
  const consumedIds = ctx.payload?.consumedEquipmentIds ?? []
  const hasCard = isDomElement(card)

  addConsumedEquipmentGhostFlights(gsapApi, tl, ctx, { flightTimeRatio: 0.58 })

  if (!hasCard && consumedIds.length === 0) {
    if (dur > 0) {
      const played = typeof tl.duration === 'function' ? tl.duration() : 0
      if (played < dur) tl.to({}, { duration: dur - played })
    }
    return tl
  }

  const pulseDur = dur > 0 ? Math.max(0.08, dur / 5) : 0

  if (hasCard && dur > 0) {
    tl.fromTo(
      card,
      { filter: 'brightness(1)' },
      {
        filter: 'brightness(0.88)',
        duration: pulseDur,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 3,
      },
      0,
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
  if (kind === 'BOT_BIDDING_DRAW') return createBotBiddingDrawPresentationMotionTimeline
  if (kind === 'BOT_BIDDING_ADD') return createBotBiddingAddPresentationMotionTimeline
  if (kind === 'BOT_BIDDING_SACRIFICE') return createBotBiddingSacrificePresentationMotionTimeline
  return createBoardShellPresentationMotionTimeline
}

/** @type {Readonly<Record<OrchestratorPresentationKind, typeof createBoardShellPresentationMotionTimeline | typeof createDungeonRevealPresentationMotionTimeline | typeof createDungeonDamagePresentationMotionTimeline | typeof createDungeonNeutralizePresentationMotionTimeline | typeof createDungeonContinuePresentationMotionTimeline | typeof createHeroChangeInterstitialPresentationMotionTimeline | typeof createBotBiddingDrawPresentationMotionTimeline | typeof createBotBiddingAddPresentationMotionTimeline | typeof createBotBiddingSacrificePresentationMotionTimeline>>} */
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
