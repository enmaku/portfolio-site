import { computed, reactive, ref, triggerRef, unref, watch } from 'vue'
import { MATCH_PHASES } from '../../engine/kernel.js'
import {
  createPresentationOrchestrator,
  SPEED_PROFILES,
} from '../presentationOrchestrator.js'
import {
  viewerMaySeeAddToDungeonFlipDown,
  viewerMaySeeBiddingDrawFace,
} from '../biddingPresentationVisibility.js'
import { isDungeonPresentationTraceEnabled } from '../dungeonPresentationTrace.js'
import { dungeonStageClassForPresentation } from '../dungeonResolutionFlow.js'
import { usePresentationMotion } from '../usePresentationMotion.js'

/**
 * @param {HTMLElement | import('vue').ComponentPublicInstance | null | undefined} componentOrEl
 * @returns {HTMLElement | null}
 */
function domEl(componentOrEl) {
  if (!componentOrEl) return null
  if (componentOrEl.nodeType === 1) return componentOrEl
  const inner = componentOrEl.$el
  return inner?.nodeType === 1 ? inner : null
}

/**
 * @param {unknown} exposedMaybeRef
 * @returns {HTMLElement | null}
 */
function unwrapMotionDom(exposedMaybeRef) {
  if (exposedMaybeRef == null) return null
  const el = unref(exposedMaybeRef)
  return el?.nodeType === 1 ? el : null
}

/**
 * Presentation binding for live match shell: orchestrator beats, motion anchors,
 * animation classes, and gameplay-input lock state.
 *
 * @param {{
 *   presentationSpeedProfile: import('vue').WritableComputedRef<string> | import('vue').Ref<string>
 *   getHumanSeatId: () => string | null
 *   getIsHumanTurn?: () => boolean
 *   getMatch: () => object | null
 *   presentationTraceEnabled?: () => boolean
 *   onPersistPresentationSpeedProfile: (pace: string) => void
 *   onGameplayInputUnlocked: () => void
 *   getPresentationActiveTraceContext?: () => {
 *     showDungeonStage?: boolean
 *     dungeonStageView?: { monster?: { visibility?: string | null, species?: string | null } } | null
 *   }
 *   debugMode?: import('vue').Ref<boolean>
 *   aiTurnTrace?: (baseContext?: object) => (step: string, detail?: object) => void
 *   shouldDeferDungeonExitUntilOutcomeAck: (
 *     prevState: object,
 *     nextState: object,
 *   ) => boolean
 *   createPresentationOrchestrator?: typeof createPresentationOrchestrator
 *   usePresentationMotion?: typeof usePresentationMotion
 * }} deps
 */
export function createLiveMatchShellPresentationBinding(deps) {
  const presentationTraceEnabled =
    deps.presentationTraceEnabled ?? (() => isDungeonPresentationTraceEnabled())
  const debugMode = deps.debugMode ?? ref(false)
  const aiTurnTrace = deps.aiTurnTrace ?? (() => () => {})
  const getPresentationActiveTraceContext = deps.getPresentationActiveTraceContext ?? (() => ({}))
  const createOrchestrator = deps.createPresentationOrchestrator ?? createPresentationOrchestrator
  const bindPresentationMotion = deps.usePresentationMotion ?? usePresentationMotion

  const presentationSpeedProfile = deps.presentationSpeedProfile
  const presentationOrchestrator = createOrchestrator()
  const activePresentation = ref(null)
  const activePresentationLabel = ref('')
  const gameplayInputLocked = ref(false)

  const boardShellRef = ref(null)
  const heroCardSlotRef = ref(null)
  const dungeonCardMotionWrap = ref(null)
  const dungeonCardFaceRef = ref(null)
  const deckBadgeRef = ref(null)
  const dungeonPileMotionAnchorRef = ref(null)
  const heroChangeInterstitialOverlayRef = ref(null)
  const presentationFlightLayerRef = ref(null)
  const biddingEquipmentBadgeRefs = reactive({})

  let presentationInputWasLocked = false
  let lastPresentationTraceKey = null

  bindPresentationMotion({
    activePresentation,
    getMotionRefs: (head) => {
      if (head?.kind === 'HERO_CHANGE_INTERSTITIAL') {
        return {
          heroChangeInterstitialOverlay: heroChangeInterstitialOverlayRef.value,
          boardShell: boardShellRef.value,
        }
      }
      const base = {
        boardShell: boardShellRef.value,
        dungeonCardWrap: dungeonCardMotionWrap.value,
        dungeonCardFlipAxis: unwrapMotionDom(dungeonCardFaceRef.value?.dungeonCardFlipAxis),
        deckBadge: domEl(deckBadgeRef.value),
        dungeonPileBadge: dungeonPileMotionAnchorRef.value,
        presentationFlightLayer: presentationFlightLayerRef.value,
        presentationGhostTarget: heroCardSlotRef.value,
      }
      if (
        presentationTraceEnabled() &&
        (head?.kind === 'DUNGEON_REVEAL' || head?.kind === 'BIDDING_DRAW')
      ) {
        const snapEl = (el) => {
          if (!el || typeof el.getBoundingClientRect !== 'function') return { present: false }
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
        const deckNode = domEl(deckBadgeRef.value)
        console.log('[DungeonRunner][card-flight][refs]', {
          kind: head.kind,
          id: head.id,
          durationMs: head.durationMs,
          dungeonCardWrap: snapEl(base.dungeonCardWrap),
          dungeonPileAnchor: snapEl(base.dungeonPileBadge),
          deckBadgeResolved: snapEl(base.deckBadge),
          dungeonCardFlipAxis: snapEl(base.dungeonCardFlipAxis),
          deckBadgeRawDomEl: snapEl(deckNode),
          refsBound: {
            dungeonPileMotionAnchorRef: !!dungeonPileMotionAnchorRef.value,
            deckBadgeRef: !!deckBadgeRef.value,
            dungeonCardMotionWrap: !!dungeonCardMotionWrap.value,
            dungeonCardFaceRef: !!dungeonCardFaceRef.value,
          },
        })
      }
      if (head?.kind !== 'BIDDING_SACRIFICE' && head?.kind !== 'DUNGEON_NEUTRALIZE') return base
      const ids =
        head?.payload?.responsibleEquipmentIds ?? head?.payload?.consumedEquipmentIds ?? []
      const extra = {}
      for (const id of ids) {
        const node = biddingEquipmentBadgeRefs[id]
        if (node?.nodeType === 1) extra[`equipment_${id}`] = node
      }
      return { ...base, ...extra }
    },
  })

  const dungeonStageAnimationClass = computed(() =>
    dungeonStageClassForPresentation(activePresentation.value),
  )

  watch(presentationSpeedProfile, (next) => {
    presentationOrchestrator.setSpeedProfile(next)
    syncPresentationLabel()
    triggerRef(activePresentation)
    deps.onPersistPresentationSpeedProfile(next)
  })

  function bindBiddingEquipmentBadgeRef(equipmentId, componentOrEl) {
    const node = domEl(componentOrEl)
    if (node) biddingEquipmentBadgeRefs[equipmentId] = node
    else delete biddingEquipmentBadgeRefs[equipmentId]
  }

  function bindRefTarget(refTarget) {
    return (componentOrEl) => {
      refTarget.value = componentOrEl ?? null
    }
  }

  const bindBoardShellRef = bindRefTarget(boardShellRef)
  const bindHeroCardSlotRef = bindRefTarget(heroCardSlotRef)
  const bindDungeonCardMotionWrapRef = bindRefTarget(dungeonCardMotionWrap)
  const bindDungeonCardFaceRef = bindRefTarget(dungeonCardFaceRef)
  const bindDeckBadgeRef = bindRefTarget(deckBadgeRef)
  const bindDungeonPileMotionAnchorRef = bindRefTarget(dungeonPileMotionAnchorRef)
  const bindHeroChangeInterstitialOverlayRef = bindRefTarget(heroChangeInterstitialOverlayRef)
  const bindPresentationFlightLayerRef = bindRefTarget(presentationFlightLayerRef)

  function summarizeDungeonForPresentation(dungeonState) {
    if (!dungeonState) return null
    const discardedRunMonsterIds = Array.isArray(dungeonState.discardedRunMonsters)
      ? [...dungeonState.discardedRunMonsters]
      : []
    const rawDefeatRecord = dungeonState.lastDefeatRecord ?? null
    const lastDefeatRecord = rawDefeatRecord
      ? {
          monsterCard: rawDefeatRecord.monsterCard ?? null,
          byEquipmentIds: Array.isArray(rawDefeatRecord.byEquipmentIds)
            ? [...rawDefeatRecord.byEquipmentIds]
            : [],
          expendedEquipmentIds: Array.isArray(rawDefeatRecord.expendedEquipmentIds)
            ? [...rawDefeatRecord.expendedEquipmentIds]
            : [],
        }
      : null
    return {
      subphase: dungeonState.subphase ?? null,
      currentMonster: dungeonState.currentMonster ?? null,
      remainingMonsterCount: Array.isArray(dungeonState.remainingMonsters)
        ? dungeonState.remainingMonsters.length
        : 0,
      discardedMonsterCount: discardedRunMonsterIds.length,
      discardedRunMonsterIds,
      hp: Number.isFinite(dungeonState.hp) ? dungeonState.hp : null,
      lastDefeatRecord,
    }
  }

  function enrichPresentationForViewer(head) {
    if (!head) return null
    const kind = head.kind
    const basePayload = head.payload && typeof head.payload === 'object' ? { ...head.payload } : {}

    if (kind === 'BIDDING_DRAW') {
      const actorSeatId = basePayload.actorSeatId ?? null
      basePayload.shouldFlipFaceAfterArrival = viewerMaySeeBiddingDrawFace({
        viewerSeatId: deps.getHumanSeatId(),
        actorSeatId,
      })
      return { ...head, payload: basePayload }
    }
    if (kind === 'BIDDING_ADD') {
      basePayload.shouldFlipToBackBeforeDungeon = viewerMaySeeAddToDungeonFlipDown({
        viewerSeatId: deps.getHumanSeatId(),
        actorSeatId: basePayload.actorSeatId ?? null,
        actorRoleType: basePayload.actorRoleType ?? null,
      })
      return { ...head, payload: basePayload }
    }
    return head
  }

  function syncPresentationLabel() {
    activePresentation.value = enrichPresentationForViewer(
      presentationOrchestrator.getActiveAnimation(),
    )
    activePresentationLabel.value = activePresentation.value?.label ?? ''
    const locked = presentationOrchestrator.isGameplayInputLocked()
    gameplayInputLocked.value = locked
    if (presentationInputWasLocked && !locked) {
      if (debugMode.value) {
        const snap = presentationOrchestrator.getQueueSnapshot()
        aiTurnTrace()('presentation.unlock', {
          queuedKinds: snap.map((item) => item.kind),
          isHumanTurn: deps.getIsHumanTurn?.() ?? null,
          activeSeatId: deps.getMatch()?.state?.turn?.activeSeatId ?? null,
        })
      }
      deps.onGameplayInputUnlocked()
    }
    presentationInputWasLocked = locked
    if (presentationTraceEnabled()) {
      const a = activePresentation.value
      const key = a ? `${a.id}:${a.kind}` : 'idle'
      if (key !== lastPresentationTraceKey) {
        lastPresentationTraceKey = key
        const snap = presentationOrchestrator.getQueueSnapshot()
        const traceCtx = getPresentationActiveTraceContext()
        const d = deps.getMatch()?.state?.dungeon
        console.log('[DungeonRunner][presentation] active', a?.kind ?? 'idle', {
          ms: a?.remainingMs ?? null,
          queued: snap.map((x) => x.kind),
          inputLocked: gameplayInputLocked.value,
          engineDungeonCurrentMonster: d?.currentMonster ?? null,
          engineDungeonSubphase: d?.subphase ?? null,
          viewMonsterVisibility: traceCtx.showDungeonStage
            ? (traceCtx.dungeonStageView?.monster?.visibility ?? null)
            : null,
          viewMonsterSpecies: traceCtx.showDungeonStage
            ? (traceCtx.dungeonStageView?.monster?.species ?? null)
            : null,
        })
      }
    }
  }

  function enqueuePresentationTransition(prevState, nextState, action, actorSeatId, actorRoleType) {
    const deferPostDungeonOutcomeAck = deps.shouldDeferDungeonExitUntilOutcomeAck(
      prevState,
      nextState,
    )
    presentationOrchestrator.enqueueEngineTransition(
      {
        phaseBefore: prevState.phase,
        phaseAfter: nextState.phase,
        turnBeforeSeatId: prevState.turn.activeSeatId,
        turnAfterSeatId: nextState.turn.activeSeatId,
        dungeonRunResult:
          prevState.lastDungeonRun?.result === nextState.lastDungeonRun?.result
            ? null
            : (nextState.lastDungeonRun?.result ?? null),
        action,
        actorSeatId,
        actorRoleType,
        centerEquipmentBefore: prevState.centerEquipment ?? [],
        centerEquipmentAfter: nextState.centerEquipment ?? [],
        heroBefore: prevState.hero,
        heroAfter: nextState.hero,
        dungeonBefore: summarizeDungeonForPresentation(prevState.dungeon),
        dungeonAfter: summarizeDungeonForPresentation(nextState.dungeon),
        biddingBefore:
          prevState.phase === MATCH_PHASES.BIDDING
            ? {
                revealedMonsterCard: prevState.bidding?.revealedMonsterCard ?? null,
                revealedBySeatId: prevState.bidding?.revealedBySeatId ?? null,
              }
            : null,
      },
      { deferPostDungeonOutcomeAck },
    )
    if (presentationTraceEnabled()) {
      const snap = presentationOrchestrator.getQueueSnapshot()
      console.log('[DungeonRunner][presentation] enqueue', {
        phase: `${prevState.phase}→${nextState.phase}`,
        action: action?.type ?? null,
        actorRole: actorRoleType,
        queue: snap.map((x) => x.kind),
      })
    }
    syncPresentationLabel()
  }

  function skipActivePresentation() {
    presentationOrchestrator.skipActiveAnimation()
    syncPresentationLabel()
  }

  function humanDungeonAutoRevealGapMs() {
    const pace = presentationSpeedProfile.value
    const profile = SPEED_PROFILES[pace] ?? SPEED_PROFILES.cinematic
    return Math.max(0, profile.dungeonContinueMs)
  }

  function setPresentationInputWasLockedFalse() {
    presentationInputWasLocked = false
  }

  function clearPresentationOrchestrator() {
    presentationOrchestrator.clear()
  }

  function flushPostDungeonOutcomeAnimations() {
    presentationOrchestrator.flushPostDungeonOutcomeAnimations()
  }

  function preparePresentationOnMount() {
    presentationOrchestrator.setSpeedProfile(presentationSpeedProfile.value)
  }

  function resetPresentationForBootstrap(pace) {
    presentationOrchestrator.clear()
    presentationSpeedProfile.value = pace
    presentationOrchestrator.setSpeedProfile(pace)
    syncPresentationLabel()
  }

  function applyImportedPresentationPace(pace) {
    presentationSpeedProfile.value = pace
    presentationOrchestrator.setSpeedProfile(pace)
    presentationOrchestrator.clear()
    syncPresentationLabel()
  }

  return {
    presentationOrchestrator,
    activePresentation,
    activePresentationLabel,
    gameplayInputLocked,
    dungeonStageAnimationClass,
    boardShellRef,
    heroCardSlotRef,
    dungeonCardMotionWrap,
    dungeonCardFaceRef,
    deckBadgeRef,
    dungeonPileMotionAnchorRef,
    heroChangeInterstitialOverlayRef,
    presentationFlightLayerRef,
    bindBoardShellRef,
    bindHeroCardSlotRef,
    bindDungeonCardMotionWrapRef,
    bindDungeonCardFaceRef,
    bindDeckBadgeRef,
    bindDungeonPileMotionAnchorRef,
    bindHeroChangeInterstitialOverlayRef,
    bindPresentationFlightLayerRef,
    bindBiddingEquipmentBadgeRef,
    syncPresentationLabel,
    enqueuePresentationTransition,
    skipActivePresentation,
    humanDungeonAutoRevealGapMs,
    setPresentationInputWasLockedFalse,
    clearPresentationOrchestrator,
    flushPostDungeonOutcomeAnimations,
    preparePresentationOnMount,
    resetPresentationForBootstrap,
    applyImportedPresentationPace,
  }
}
