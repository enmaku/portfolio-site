export const SPEED_PROFILES = {
  cinematic: {
    phaseTransitionMs: 2200,
    turnAdvanceMs: 1100,
    dungeonResultMs: 1650,
    dungeonOutcomeMs: 1650,
    botStoryMs: 1300,
    heroChangeInterstitialMs: 3600,
    dungeonRevealMs: 1050,
    dungeonNeutralizeMs: 920,
    dungeonDamageMs: 900,
    dungeonContinueMs: 650,
  },
  brisk: {
    phaseTransitionMs: 1200,
    turnAdvanceMs: 650,
    dungeonResultMs: 950,
    dungeonOutcomeMs: 950,
    botStoryMs: 750,
    heroChangeInterstitialMs: 2000,
    dungeonRevealMs: 600,
    dungeonNeutralizeMs: 520,
    dungeonDamageMs: 500,
    dungeonContinueMs: 360,
  },
}

export function mapEngineTransitionToAnimations(transition, speedProfile = 'cinematic') {
  const profile = SPEED_PROFILES[speedProfile] ?? SPEED_PROFILES.cinematic
  const queue = []
  const consumedEquipmentIds = findConsumedEquipmentIds(
    transition.centerEquipmentBefore,
    transition.centerEquipmentAfter,
  )

  if (transition.phaseBefore === 'bidding' && transition.phaseAfter === 'bidding') {
    const actorSeatId = transition.actorSeatId ?? null
    const actorRoleType = transition.actorRoleType ?? null
    const biddingPayloadBase = { actorSeatId, actorRoleType }

    const enqueueSacrifice = () => {
      if (transition.action?.type !== 'SACRIFICE') return
      let sacrificeConsumedIds = consumedEquipmentIds
      if (sacrificeConsumedIds.length === 0 && transition.action?.equipmentId) {
        sacrificeConsumedIds = [transition.action.equipmentId]
      }
      const bb = transition.biddingBefore ?? null
      queue.push({
        kind: 'BIDDING_SACRIFICE',
        channel: 'gameplay',
        label: '',
        durationMs: profile.botStoryMs,
        payload: {
          ...biddingPayloadBase,
          consumedEquipmentIds: sacrificeConsumedIds,
          responsibleEquipmentIds: [...sacrificeConsumedIds],
          expendedEquipmentIds: [...sacrificeConsumedIds],
          engineActionType: transition.action?.type ?? null,
          eliminatedMonsterCard: bb?.revealedMonsterCard ?? null,
          revealedToSeatId: bb?.revealedBySeatId ?? null,
        },
      })
    }

    if (transition.action?.type === 'DRAW') {
      queue.push({
        kind: 'BIDDING_DRAW',
        channel: 'gameplay',
        label: '',
        durationMs: profile.botStoryMs,
        payload: {
          ...biddingPayloadBase,
          engineActionType: 'DRAW',
        },
      })
    } else if (transition.action?.type === 'ADD_TO_DUNGEON') {
      queue.push({
        kind: 'BIDDING_ADD',
        channel: 'gameplay',
        label: '',
        durationMs: profile.botStoryMs,
        payload: {
          ...biddingPayloadBase,
          engineActionType: 'ADD_TO_DUNGEON',
        },
      })
    } else {
      enqueueSacrifice()
    }
  }

  const deferPhaseUntilAfterDungeonPlayback =
    transition.phaseBefore === 'dungeon' &&
    (transition.phaseAfter === 'pick-adventurer' || transition.phaseAfter === 'match-over')

  const phaseChangeAnimations = []
  if (transition.phaseBefore !== transition.phaseAfter) {
    if (transition.phaseAfter === 'dungeon') {
      phaseChangeAnimations.push({
        kind: 'PHASE_ENTER_DUNGEON',
        channel: 'gameplay',
        label: 'Entering dungeon...',
        durationMs: profile.phaseTransitionMs,
      })
    } else if (transition.phaseAfter === 'pick-adventurer') {
      phaseChangeAnimations.push({
        kind: 'PHASE_PICK_ADVENTURER',
        channel: 'gameplay',
        label: 'Choosing next adventurer...',
        durationMs: profile.phaseTransitionMs,
      })
    } else if (transition.phaseAfter === 'match-over') {
      phaseChangeAnimations.push({
        kind: 'PHASE_MATCH_OVER',
        channel: 'gameplay',
        label: 'Match complete.',
        durationMs: profile.phaseTransitionMs,
      })
    }
  }

  if (!deferPhaseUntilAfterDungeonPlayback) {
    for (const animation of phaseChangeAnimations) queue.push(animation)
  }

  const heroChangeAnimations = []
  if (
    transition.phaseBefore === 'pick-adventurer' &&
    transition.phaseAfter === 'bidding' &&
    transition.heroBefore &&
    transition.heroAfter &&
    transition.heroBefore !== transition.heroAfter
  ) {
    heroChangeAnimations.push({
      kind: 'HERO_CHANGE_INTERSTITIAL',
      channel: 'gameplay',
      label: '',
      durationMs: profile.heroChangeInterstitialMs,
      skippable: true,
      payload: {
        heroBefore: transition.heroBefore,
        heroAfter: transition.heroAfter,
      },
    })
  }

  const turnAdvanceAnimations = []
  if (
    transition.turnBeforeSeatId &&
    transition.turnAfterSeatId &&
    transition.turnBeforeSeatId !== transition.turnAfterSeatId
  ) {
    turnAdvanceAnimations.push({
      kind: 'TURN_ADVANCE',
      channel: 'gameplay',
      label: transition.actorRoleType === 'human' ? 'Advancing turn...' : '',
      durationMs: profile.turnAdvanceMs,
    })
  }

  if (!deferPhaseUntilAfterDungeonPlayback) {
    for (const animation of heroChangeAnimations) queue.push(animation)
    for (const animation of turnAdvanceAnimations) queue.push(animation)
  }

  const dungeonFacts = computeDungeonPresentationFacts(transition)
  const derivedDungeonKinds = deriveDungeonAnimationKinds(transition, dungeonFacts)
  const dungeonAnimations = []
  for (const kind of derivedDungeonKinds) {
    dungeonAnimations.push({
      kind,
      channel: 'gameplay',
      label: dungeonLabelForKind(kind, transition),
      durationMs: durationForDungeonKind(kind, profile),
      payload: dungeonPayloadForKind(kind, transition, dungeonFacts),
    })
  }

  if (deferPhaseUntilAfterDungeonPlayback) {
    for (const animation of dungeonAnimations) queue.push(animation)
    for (const animation of phaseChangeAnimations) queue.push(animation)
    for (const animation of heroChangeAnimations) queue.push(animation)
    for (const animation of turnAdvanceAnimations) queue.push(animation)
  } else {
    for (const animation of dungeonAnimations) queue.push(animation)
  }

  return queue
}

/**
 * Splits presentation so dungeon outcome plays first; phase transitions (e.g. pick-adventurer) can run after user ack.
 * @param {ReturnType<typeof mapEngineTransitionToAnimations>} animations
 * @returns {{ immediate: typeof animations, deferred: typeof animations }}
 */
export function splitPresentationAfterDungeonOutcome(animations) {
  const idx = animations.findIndex((a) => a.kind === 'DUNGEON_OUTCOME')
  if (idx < 0) {
    return { immediate: animations, deferred: [] }
  }
  return {
    immediate: animations.slice(0, idx + 1),
    deferred: animations.slice(idx + 1),
  }
}

function findConsumedEquipmentIds(before = [], after = []) {
  const remaining = new Set(after ?? [])
  return (before ?? []).filter((equipmentId) => !remaining.has(equipmentId))
}

/**
 * @param {object|null|undefined} before
 * @param {object|null|undefined} after
 * @returns {string[]}
 */
function newlyDiscardedMonsterIdsFromSummaries(before, after) {
  const b = before?.discardedRunMonsterIds
  const a = after?.discardedRunMonsterIds
  if (Array.isArray(b) && Array.isArray(a) && a.length >= b.length) {
    let prefixOk = true
    for (let i = 0; i < b.length; i += 1) {
      if (b[i] !== a[i]) {
        prefixOk = false
        break
      }
    }
    if (prefixOk) return a.slice(b.length)
  }
  if (Array.isArray(b) && Array.isArray(a)) {
    const setB = new Set(b)
    return a.filter((id) => !setB.has(id))
  }
  const db = numericOrNull(before?.discardedMonsterCount) ?? 0
  const da = numericOrNull(after?.discardedMonsterCount) ?? 0
  if (da > db && before?.currentMonster != null) {
    return [before.currentMonster]
  }
  return []
}

/**
 * @param {object} transition
 * @returns {{
 *   revealedMonsterId: string|null,
 *   flashRevealFromPile: boolean,
 *   neutralizedMonsterIds: string[],
 *   hpDelta: number,
 *   dungeonSubphaseAfter: string|null,
 *   consumedEquipmentIds: string[],
 *   responsibleEquipmentIds: string[],
 *   expendedEquipmentIds: string[],
 *   isFinalDungeonMonsterDefeat: boolean,
 * }}
 */
function computeDungeonPresentationFacts(transition) {
  const consumedEquipmentIds = findConsumedEquipmentIds(
    transition.centerEquipmentBefore,
    transition.centerEquipmentAfter,
  )
  const before = transition.dungeonBefore ?? null
  const after = transition.dungeonAfter ?? null
  const hpBefore = numericOrNull(before?.hp)
  const hpAfter = numericOrNull(after?.hp)
  const hpDelta = hpBefore != null && hpAfter != null ? hpAfter - hpBefore : 0
  const discardedBefore = numericOrNull(before?.discardedMonsterCount) ?? 0
  const discardedAfter = numericOrNull(after?.discardedMonsterCount) ?? 0
  const discardedDelta = discardedAfter - discardedBefore
  const remainingBefore = numericOrNull(before?.remainingMonsterCount)
  const remainingAfterForReveal = numericOrNull(after?.remainingMonsterCount)
  const consumedTopMonsterFromRemaining =
    remainingBefore != null &&
    remainingAfterForReveal != null &&
    remainingAfterForReveal < remainingBefore
  const revealedChanged =
    before?.currentMonster !== after?.currentMonster && after?.currentMonster != null

  let neutralizedMonsterIds = newlyDiscardedMonsterIdsFromSummaries(before, after)
  if (
    neutralizedMonsterIds.length === 0 &&
    before?.currentMonster != null &&
    (discardedDelta > 0 || transition.action?.type === 'USE_FIRE_AXE')
  ) {
    neutralizedMonsterIds = [before.currentMonster]
  }

  const defeatRecord = after?.lastDefeatRecord ?? null
  const responsibleEquipmentIds = defeatRecord?.byEquipmentIds
    ? [...defeatRecord.byEquipmentIds]
    : []
  const expendedEquipmentIds = defeatRecord?.expendedEquipmentIds
    ? [...defeatRecord.expendedEquipmentIds]
    : []

  const remainingAfter = numericOrNull(after?.remainingMonsterCount) ?? 0
  const isFinalDungeonMonsterDefeat =
    discardedDelta > 0 && remainingAfter === 0 && after?.currentMonster == null

  /** Engine can reveal from pile and auto-defeat in one step (`currentMonster` stays null). */
  const flashRevealFromPile =
    !revealedChanged &&
    (before?.currentMonster ?? null) == null &&
    (discardedDelta > 0 || consumedTopMonsterFromRemaining) &&
    transition.action?.type === 'REVEAL_OR_CONTINUE' &&
    transition.phaseAfter === 'dungeon'

  const revealedMonsterId = revealedChanged
    ? (after?.currentMonster ?? null)
    : flashRevealFromPile
      ? (neutralizedMonsterIds[0] ?? defeatRecord?.monsterCard ?? null)
      : null

  return {
    revealedMonsterId,
    flashRevealFromPile,
    neutralizedMonsterIds,
    hpDelta,
    dungeonSubphaseAfter: after?.subphase ?? null,
    consumedEquipmentIds,
    responsibleEquipmentIds,
    expendedEquipmentIds,
    isFinalDungeonMonsterDefeat,
  }
}

/**
 * @param {string} kind
 * @param {object} transition
 * @param {ReturnType<typeof computeDungeonPresentationFacts>} facts
 */
function dungeonPayloadForKind(kind, transition, facts) {
  if (kind === 'DUNGEON_REVEAL') {
    return {
      revealedMonsterId: facts.revealedMonsterId,
    }
  }
  if (kind === 'DUNGEON_NEUTRALIZE') {
    const responsibleEquipmentIds = facts.responsibleEquipmentIds.length > 0
      ? [...facts.responsibleEquipmentIds]
      : [...facts.consumedEquipmentIds]
    const expendedEquipmentIds = facts.responsibleEquipmentIds.length > 0
      ? [...facts.expendedEquipmentIds]
      : [...facts.consumedEquipmentIds]
    return {
      neutralizedMonsterIds: [...facts.neutralizedMonsterIds],
      consumedEquipmentIds: [...expendedEquipmentIds],
      responsibleEquipmentIds,
      expendedEquipmentIds,
      engineActionType: transition.action?.type ?? null,
      isFinalDungeonMonsterDefeat: facts.isFinalDungeonMonsterDefeat,
    }
  }
  if (kind === 'DUNGEON_DAMAGE') {
    return {
      hpDelta: facts.hpDelta,
    }
  }
  if (kind === 'DUNGEON_CONTINUE') {
    return {
      dungeonSubphaseAfter: facts.dungeonSubphaseAfter,
    }
  }
  if (kind === 'DUNGEON_OUTCOME') {
    return {
      dungeonRunResult: transition.dungeonRunResult ?? null,
    }
  }
  return {}
}

function deriveDungeonAnimationKinds(transition, dungeonFacts) {
  const facts = dungeonFacts ?? computeDungeonPresentationFacts(transition)
  const kinds = []
  const actionType = transition.action?.type ?? null
  const inDungeonStep = transition.phaseBefore === 'dungeon'
  const before = transition.dungeonBefore ?? null
  const after = transition.dungeonAfter ?? null
  const hpBefore = numericOrNull(before?.hp)
  const hpAfter = numericOrNull(after?.hp)
  const discardedBefore = numericOrNull(before?.discardedMonsterCount) ?? 0
  const discardedAfter = numericOrNull(after?.discardedMonsterCount) ?? 0
  const hpDelta = hpBefore != null && hpAfter != null ? hpAfter - hpBefore : null
  const discardedDelta = discardedAfter - discardedBefore
  const tookDamage = hpDelta != null && hpDelta < 0
  const neutralized = discardedDelta > 0
  const resolvedStep = discardedDelta > 0 || tookDamage
  const shouldContinue = transition.phaseAfter === 'dungeon' && after?.subphase === 'reveal' && resolvedStep
  const hasKnownDungeonOutcome = transition.dungeonRunResult === 'success' || transition.dungeonRunResult === 'failure'
  const concludedFromDungeon = inDungeonStep && transition.phaseAfter !== 'dungeon'

  if (facts.revealedMonsterId != null || facts.flashRevealFromPile) kinds.push('DUNGEON_REVEAL')
  if (neutralized) kinds.push('DUNGEON_NEUTRALIZE')
  if (tookDamage) kinds.push('DUNGEON_DAMAGE')
  if (shouldContinue) kinds.push('DUNGEON_CONTINUE')

  if (hasKnownDungeonOutcome || concludedFromDungeon) {
    kinds.push('DUNGEON_OUTCOME')
  }

  if (
    kinds.length === 0 &&
    inDungeonStep &&
    transition.phaseAfter === 'dungeon' &&
    actionType === 'USE_FIRE_AXE'
  ) {
    kinds.push('DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE')
  }

  if (
    kinds.length === 0 &&
    inDungeonStep &&
    transition.phaseAfter === 'dungeon' &&
    actionType === 'REVEAL_OR_CONTINUE' &&
    facts.revealedMonsterId != null
  ) {
    kinds.push('DUNGEON_REVEAL')
  }

  return kinds
}

function dungeonLabelForKind(kind, transition) {
  if (kind !== 'DUNGEON_OUTCOME') return ''
  if (transition.dungeonRunResult === 'success') return 'Dungeon cleared.'
  if (transition.dungeonRunResult === 'failure') return 'Dungeon run failed.'
  return 'Dungeon run resolved.'
}

function durationForDungeonKind(kind, profile) {
  if (kind === 'DUNGEON_REVEAL') return profile.dungeonRevealMs
  if (kind === 'DUNGEON_NEUTRALIZE') return profile.dungeonNeutralizeMs
  if (kind === 'DUNGEON_DAMAGE') return profile.dungeonDamageMs
  if (kind === 'DUNGEON_CONTINUE') return profile.dungeonContinueMs
  return profile.dungeonOutcomeMs
}

function numericOrNull(value) {
  return Number.isFinite(value) ? value : null
}

function speedKeyForAnimationKind(kind) {
  if (typeof kind !== 'string') return null
  if (kind.startsWith('BIDDING_')) return 'botStoryMs'
  if (
    kind === 'PHASE_ENTER_DUNGEON' ||
    kind === 'PHASE_PICK_ADVENTURER' ||
    kind === 'PHASE_MATCH_OVER'
  ) {
    return 'phaseTransitionMs'
  }
  if (kind === 'HERO_CHANGE_INTERSTITIAL') return 'heroChangeInterstitialMs'
  if (kind === 'TURN_ADVANCE') return 'turnAdvanceMs'
  if (kind === 'DUNGEON_RESULT') return 'dungeonResultMs'
  if (kind === 'DUNGEON_OUTCOME') return 'dungeonOutcomeMs'
  if (kind === 'DUNGEON_REVEAL') return 'dungeonRevealMs'
  if (kind === 'DUNGEON_NEUTRALIZE') return 'dungeonNeutralizeMs'
  if (kind === 'DUNGEON_DAMAGE') return 'dungeonDamageMs'
  if (kind === 'DUNGEON_CONTINUE') return 'dungeonContinueMs'
  return null
}

function rescaleQueuedAnimationsForProfile(queue, fromProfileKey, toProfileKey) {
  const oldP = SPEED_PROFILES[fromProfileKey]
  const newP = SPEED_PROFILES[toProfileKey]
  for (const item of queue) {
    const key = speedKeyForAnimationKind(item.kind)
    if (!key) continue
    const oldMs = oldP[key]
    const newMs = newP[key]
    if (!oldMs || oldMs <= 0) continue
    const ratio = newMs / oldMs
    item.remainingMs = Math.max(0, Math.round(item.remainingMs * ratio))
    item.durationMs = newMs
  }
}

export function createPresentationOrchestrator({ speedProfile = 'cinematic' } = {}) {
  let selectedSpeedProfile = SPEED_PROFILES[speedProfile] ? speedProfile : 'cinematic'
  let nextAnimationId = 1
  const queue = []
  /** @type {Array<ReturnType<typeof mapEngineTransitionToAnimations>[number]>} */
  let deferredPostDungeonOutcomeAnimations = []

  function pushAnimations(animations) {
    for (const animation of animations) {
      queue.push({
        id: nextAnimationId++,
        ...animation,
        remainingMs: animation.durationMs,
      })
    }
  }

  return {
    setSpeedProfile(next) {
      if (!SPEED_PROFILES[next] || next === selectedSpeedProfile) return
      const prev = selectedSpeedProfile
      selectedSpeedProfile = next
      rescaleQueuedAnimationsForProfile(queue, prev, next)
    },
    enqueueEngineTransition(transition, options = {}) {
      const animations = mapEngineTransitionToAnimations(transition, selectedSpeedProfile)
      deferredPostDungeonOutcomeAnimations = []
      let toEnqueue = animations
      if (options.deferPostDungeonOutcomeAck) {
        const split = splitPresentationAfterDungeonOutcome(animations)
        toEnqueue = split.immediate
        deferredPostDungeonOutcomeAnimations = split.deferred
      }
      pushAnimations(toEnqueue)
    },
    flushPostDungeonOutcomeAnimations() {
      if (deferredPostDungeonOutcomeAnimations.length === 0) return
      const tail = deferredPostDungeonOutcomeAnimations
      deferredPostDungeonOutcomeAnimations = []
      pushAnimations(tail)
    },
    advance(ms) {
      let budget = Math.max(0, Number(ms) || 0)
      while (queue.length > 0 && budget > 0) {
        const head = queue[0]
        if (head.remainingMs > budget) {
          head.remainingMs -= budget
          budget = 0
          continue
        }
        budget -= head.remainingMs
        queue.shift()
      }
    },
    getActiveAnimation() {
      return queue[0] ?? null
    },
    getQueueSnapshot() {
      return queue.map((item) => ({ ...item }))
    },
    clear() {
      queue.splice(0, queue.length)
      deferredPostDungeonOutcomeAnimations = []
    },
    skipActiveAnimation() {
      if (queue.length === 0) return
      const head = queue[0]
      if (!head.skippable) return
      queue.shift()
    },
    isGameplayInputLocked() {
      return queue.some((item) => item.channel === 'gameplay')
    },
    isUtilityUiAccessible() {
      return true
    },
  }
}
