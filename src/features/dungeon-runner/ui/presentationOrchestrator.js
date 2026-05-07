export const SPEED_PROFILES = {
  cinematic: {
    phaseTransitionMs: 900,
    turnAdvanceMs: 450,
    dungeonResultMs: 700,
    botStoryMs: 520,
    heroChangeInterstitialMs: 1800,
  },
  brisk: {
    phaseTransitionMs: 450,
    turnAdvanceMs: 200,
    dungeonResultMs: 325,
    botStoryMs: 260,
    heroChangeInterstitialMs: 900,
  },
}

export function mapEngineTransitionToAnimations(transition, speedProfile = 'cinematic') {
  const profile = SPEED_PROFILES[speedProfile] ?? SPEED_PROFILES.cinematic
  const queue = []
  const consumedEquipmentIds = findConsumedEquipmentIds(
    transition.centerEquipmentBefore,
    transition.centerEquipmentAfter,
  )

  if (transition.phaseBefore === 'bidding' && transition.phaseAfter === 'bidding' && transition.actorRoleType !== 'human') {
    if (transition.action?.type === 'DRAW') {
      queue.push({
        kind: 'BOT_BIDDING_DRAW',
        channel: 'gameplay',
        label: '',
        durationMs: profile.botStoryMs,
        payload: {},
      })
    } else if (transition.action?.type === 'ADD_TO_DUNGEON') {
      queue.push({
        kind: 'BOT_BIDDING_ADD',
        channel: 'gameplay',
        label: '',
        durationMs: profile.botStoryMs,
        payload: {},
      })
    } else if (transition.action?.type === 'SACRIFICE') {
      queue.push({
        kind: 'BOT_BIDDING_SACRIFICE',
        channel: 'gameplay',
        label: '',
        durationMs: profile.botStoryMs,
        payload: { consumedEquipmentIds },
      })
    }
  }

  if (transition.phaseBefore !== transition.phaseAfter) {
    if (transition.phaseAfter === 'dungeon') {
      queue.push({
        kind: 'PHASE_ENTER_DUNGEON',
        channel: 'gameplay',
        label: 'Entering dungeon...',
        durationMs: profile.phaseTransitionMs,
      })
    } else if (transition.phaseAfter === 'pick-adventurer') {
      queue.push({
        kind: 'PHASE_PICK_ADVENTURER',
        channel: 'gameplay',
        label: 'Choosing next adventurer...',
        durationMs: profile.phaseTransitionMs,
      })
    } else if (transition.phaseAfter === 'match-over') {
      queue.push({
        kind: 'PHASE_MATCH_OVER',
        channel: 'gameplay',
        label: 'Match complete.',
        durationMs: profile.phaseTransitionMs,
      })
    }
  }

  if (
    transition.phaseBefore === 'pick-adventurer' &&
    transition.phaseAfter === 'bidding' &&
    transition.heroBefore &&
    transition.heroAfter &&
    transition.heroBefore !== transition.heroAfter
  ) {
    queue.push({
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

  if (
    transition.turnBeforeSeatId &&
    transition.turnAfterSeatId &&
    transition.turnBeforeSeatId !== transition.turnAfterSeatId
  ) {
    queue.push({
      kind: 'TURN_ADVANCE',
      channel: 'gameplay',
      label: transition.actorRoleType === 'human' ? 'Advancing turn...' : '',
      durationMs: profile.turnAdvanceMs,
    })
  }

  if (transition.dungeonRunResult) {
    queue.push({
      kind: 'DUNGEON_RESULT',
      channel: 'gameplay',
      label: transition.dungeonRunResult === 'success' ? 'Dungeon cleared.' : 'Dungeon run failed.',
      durationMs: profile.dungeonResultMs,
    })
  }

  return queue
}

function findConsumedEquipmentIds(before = [], after = []) {
  const remaining = new Set(after ?? [])
  return (before ?? []).filter((equipmentId) => !remaining.has(equipmentId))
}

function speedKeyForAnimationKind(kind) {
  if (typeof kind !== 'string') return null
  if (kind.startsWith('BOT_BIDDING_')) return 'botStoryMs'
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
    enqueueEngineTransition(transition) {
      pushAnimations(mapEngineTransitionToAnimations(transition, selectedSpeedProfile))
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
