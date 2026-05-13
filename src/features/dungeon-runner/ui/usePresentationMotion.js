import { computed, onScopeDispose, unref, watch } from 'vue'

import { isDungeonPresentationTraceEnabled } from './dungeonPresentationTrace.js'
import { loadPresentationGsap } from './loadPresentationGsap.js'
import {
  createPresentationMotionTimeline,
  createPresentationResizeFallbackMotionTimeline,
  presentationMotionClearKeys,
  presentationMotionIsLayoutFragile,
  purgePresentationEquipmentGhostNodes,
} from './presentationMotionRegistry.js'

const PRESENTATION_MOTION_RESIZE_REG = Symbol.for('dungeonRunner.presentationMotionResize')

/** @type {Set<() => void>} */
const presentationMotionResizeSubscribers = new Set()

function dispatchPresentationMotionResize() {
  for (const fn of presentationMotionResizeSubscribers) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

function ensurePresentationMotionResizePlaceholder() {
  if (typeof window === 'undefined') return
  if (window[PRESENTATION_MOTION_RESIZE_REG]) return
  window[PRESENTATION_MOTION_RESIZE_REG] = true
  window.addEventListener('resize', function _dungeonRunnerPresentationMotionResize() {
    dispatchPresentationMotionResize()
  })
}

/**
 * GSAP `clearProps: 'all'` strips many inline CSS properties (incl. backgroundColor, width).
 * Equipment cells are layered `.dr-equip-token` roots — only clear what ghost-flight sets.
 *
 * @param {string} key — ref key from `getMotionRefs`
 */
function clearPropsForPresentationRefKey(key) {
  if (typeof key === 'string' && key.startsWith('equipment_')) {
    return 'opacity,filter,boxShadow,transform,transformOrigin'
  }
  return 'all'
}

/**
 * Clears inline GSAP-applied props on registry motion targets (DOM elements in `refs`).
 * @param {import('gsap').GSAP | { set?: Function }} gsapApi
 * @param {Record<string, unknown>|undefined|null} refs
 * @param {readonly string[]|undefined} keys — if set, only these ref keys are cleared (avoids clearProps on refs reserved for future tweens).
 * @param {{ dungeonContinueCardWrapNarrow?: boolean }} [opts] — when true, `dungeonCardWrap` only clears `filter` so slide-off `x`/`opacity` from the prior neutralize beat survive into the next `DUNGEON_REVEAL` only; any other next head (including idle) gets a full wrap clear.
 */
export function resetPresentationMotionTargets(gsapApi, refs, keys, opts = {}) {
  const set = gsapApi?.set
  if (typeof set !== 'function' || !refs || typeof refs !== 'object') return
  const narrowContinueWrap = opts.dungeonContinueCardWrapNarrow === true
  const pairs =
    keys != null && keys.length > 0
      ? keys.map((k) => [k, refs[k]])
      : Object.entries(refs)
  for (const [key, value] of pairs) {
    if (value != null && typeof value === 'object' && value.nodeType === 1) {
      let clearProps = clearPropsForPresentationRefKey(key)
      if (narrowContinueWrap && key === 'dungeonCardWrap') {
        clearProps = 'filter'
      }
      set(value, { clearProps })
    }
  }
}

/**
 * Watches the queue head (`id` + `kind` + `durationMs`); lazy-loads GSAP once; builds one timeline per head via `createPresentationMotionTimeline`.
 * Kills the prior timeline and clears motion targets when the signature changes, when the head becomes null (orchestrator `clear()`, drained queue after `skipActiveAnimation()`), or on scope dispose (unmount).
 *
 * @param {{
 *   activePresentation: import('vue').Ref<object|null|undefined>,
 *   loadPresentationGsap?: typeof loadPresentationGsap,
 *   getMotionRefs?: (head: object) => Record<string, unknown>,
 * }} options
 */
export function usePresentationMotion(options) {
  const activePresentation = options.activePresentation
  const loadGsap = options.loadPresentationGsap ?? loadPresentationGsap
  const getMotionRefs = options.getMotionRefs ?? (() => ({}))

  /** @type {number|null} */
  let currentPresentationId = null
  /** @type {boolean} */
  let teardownClearsShellAndCardToo = false
  /** @type {string|null} */
  let previousPresentationKind = null
  /** @type {Record<string, unknown>|undefined} */
  let previousPresentationPayload = undefined

  const headSig = computed(() => {
    const h = unref(activePresentation)
    if (!h) return ''
    return `${h.id}:${h.kind}:${h.durationMs}`
  })

  /** @type {{ kill: () => void } | null} */
  let currentTimeline = null
  /** @type {Record<string, unknown>|null} */
  let previousRefs = null
  /** @type {{ timeline: Function, set?: Function } | null} */
  let gsapApi = null

  /**
   * @param {string|null|undefined} nextPresentationKind — queue head kind after this teardown (`null` / `undefined` when idle or unmount).
   */
  function teardownCurrent(nextPresentationKind) {
    if (currentTimeline) {
      currentTimeline.kill()
      currentTimeline = null
    }
    purgePresentationEquipmentGhostNodes()
    if (gsapApi && previousRefs) {
      let clearKeys =
        previousPresentationKind != null
          ? presentationMotionClearKeys(previousPresentationKind, previousPresentationPayload)
          : undefined
      if (teardownClearsShellAndCardToo && clearKeys?.length) {
        clearKeys = [...new Set([...clearKeys, 'boardShell', 'dungeonCardWrap'])]
      } else if (teardownClearsShellAndCardToo) {
        clearKeys = ['boardShell', 'dungeonCardWrap']
      }
      const skipNeutralizeWrapClear =
        previousPresentationKind === 'DUNGEON_NEUTRALIZE' &&
        nextPresentationKind === 'DUNGEON_CONTINUE' &&
        previousPresentationPayload?.isFinalDungeonMonsterDefeat !== true
      if (skipNeutralizeWrapClear && clearKeys?.length) {
        clearKeys = clearKeys.filter((k) => k !== 'dungeonCardWrap')
      }
      const continueNarrowCardWrap =
        previousPresentationKind === 'DUNGEON_CONTINUE' && nextPresentationKind === 'DUNGEON_REVEAL'
      const logMotion = isDungeonPresentationTraceEnabled() && previousPresentationKind != null
      const wrapEl =
        logMotion && previousRefs.dungeonCardWrap != null && typeof previousRefs.dungeonCardWrap === 'object'
          ? previousRefs.dungeonCardWrap
          : null
      const wrapNode = wrapEl?.nodeType === 1 ? wrapEl : null
      const styleBefore = logMotion && wrapNode ? wrapNode.getAttribute('style') : null
      resetPresentationMotionTargets(gsapApi, previousRefs, clearKeys, {
        dungeonContinueCardWrapNarrow: continueNarrowCardWrap,
      })
      if (logMotion) {
        const styleAfter = wrapNode ? wrapNode.getAttribute('style') : null
        const p = previousPresentationPayload
        console.log('[dungeon-runner][presentation-motion] teardown', {
          kind: previousPresentationKind,
          clearKeys: clearKeys ? [...clearKeys] : null,
          payloadHint:
            p && typeof p === 'object'
              ? { isFinalDungeonMonsterDefeat: p.isFinalDungeonMonsterDefeat === true }
              : null,
          dungeonCardWrapInlineStyleBefore: styleBefore,
          dungeonCardWrapInlineStyleAfter: styleAfter,
        })
      }
      previousRefs = null
      previousPresentationKind = null
      previousPresentationPayload = undefined
      teardownClearsShellAndCardToo = false
    }
    currentPresentationId = null
  }

  /**
   * GitHub #71: drop ghost flight / flip-axis motion after resize; finish the beat with shell+card tweens only.
   * Fallback length follows queue head `remainingMs` when set (same clock as `advance()`); otherwise GSAP elapsed.
   * GitHub #68: orchestrator queue is not mutated here.
   */
  function reconcileFragileMotionAfterResize() {
    if (!gsapApi || !currentTimeline || previousPresentationKind == null) return
    if (!presentationMotionIsLayoutFragile(previousPresentationKind, previousPresentationPayload)) return

    const head = unref(activePresentation)
    if (!head || head.id !== currentPresentationId) return

    let remainingMs
    if (Number.isFinite(head.remainingMs) && head.remainingMs >= 0) {
      remainingMs = Math.max(0, head.remainingMs)
    } else {
      const durationMs = Math.max(0, Number(head.durationMs) || 0)
      let elapsedMs = 0
      const timeFn = currentTimeline.time
      if (typeof timeFn === 'function') {
        elapsedMs = Math.max(0, Number(timeFn.call(currentTimeline)) * 1000)
      }
      remainingMs = Math.max(0, durationMs - elapsedMs)
    }

    currentTimeline.kill()
    currentTimeline = null

    purgePresentationEquipmentGhostNodes()

    const clearKeys = [
      ...new Set([
        ...presentationMotionClearKeys(previousPresentationKind, previousPresentationPayload),
        'boardShell',
        'dungeonCardWrap',
      ]),
    ]
    resetPresentationMotionTargets(gsapApi, previousRefs, clearKeys)

    if (remainingMs <= 0) {
      teardownClearsShellAndCardToo = true
      return
    }

    previousRefs = getMotionRefs(head)
    const tl = createPresentationResizeFallbackMotionTimeline(gsapApi, {
      kind: head.kind,
      durationMs: remainingMs,
      payload: head.payload,
      refs: previousRefs,
    })
    currentTimeline = tl
    teardownClearsShellAndCardToo = true
    tl.play(0)
  }

  watch(
    headSig,
    async () => {
      if (isDungeonPresentationTraceEnabled()) {
        const nextHead = unref(activePresentation)
        console.log('[dungeon-runner][presentation-motion] watch', {
          headSig: headSig.value || '(idle)',
          tearingDownKind: previousPresentationKind,
          nextKind: nextHead?.kind ?? null,
          nextId: nextHead?.id ?? null,
        })
      }
      const nextKind = unref(activePresentation)?.kind ?? null
      teardownCurrent(nextKind)
      const sigAtStart = headSig.value
      if (!sigAtStart) return

      if (!gsapApi) {
        const loaded = await loadGsap()
        gsapApi = loaded.gsap
      }
      if (headSig.value !== sigAtStart) return

      const snap = unref(activePresentation)
      if (
        !snap ||
        `${snap.id}:${snap.kind}:${snap.durationMs}` !== sigAtStart
      ) {
        return
      }

      const refs = getMotionRefs(snap)
      previousRefs = refs
      previousPresentationKind = snap.kind
      previousPresentationPayload = snap.payload
      currentPresentationId = snap.id
      teardownClearsShellAndCardToo = false
      const tl = createPresentationMotionTimeline(gsapApi, {
        kind: snap.kind,
        durationMs: snap.durationMs,
        payload: snap.payload,
        refs,
      })
      currentTimeline = tl
      if (isDungeonPresentationTraceEnabled()) {
        console.log('[dungeon-runner][presentation-motion] play', {
          kind: snap.kind,
          id: snap.id,
          durationMs: snap.durationMs,
        })
      }
      tl.play(0)
    },
    { flush: 'post', immediate: true },
  )

  if (typeof window !== 'undefined') {
    ensurePresentationMotionResizePlaceholder()
    presentationMotionResizeSubscribers.add(reconcileFragileMotionAfterResize)
    onScopeDispose(() => {
      presentationMotionResizeSubscribers.delete(reconcileFragileMotionAfterResize)
      teardownCurrent(null)
    })
  } else {
    onScopeDispose(() => {
      teardownCurrent(null)
    })
  }
}
