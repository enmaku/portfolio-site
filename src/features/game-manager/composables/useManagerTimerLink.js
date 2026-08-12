/**
 * Vue-facing wiring for manager ↔ timer link orchestration.
 */
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { createManagerTimerLinkController } from '../domain/createManagerTimerLinkController.js'
import { useGameManagerTimerLinkStore } from '../../../stores/gameManagerTimerLink.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerP2P } from '../../game-timer/composables/useGameTimerP2P.js'
import { leaveSession, startAsHost } from '../../game-timer/p2p/session.js'

/**
 * @param {{
 *   router?: ReturnType<typeof useRouter>,
 *   leaveSessionFn?: typeof leaveSession,
 *   startAsHostFn?: typeof startAsHost,
 * }=} [options]
 */
export function useManagerTimerLink(options = {}) {
  const router = options.router ?? useRouter()
  const linkStore = useGameManagerTimerLinkStore()
  const timerStore = useGameTimerStore()
  const { isHosting } = useGameTimerP2P()
  const leaveSessionFn = options.leaveSessionFn ?? leaveSession
  const startAsHostFn = options.startAsHostFn ?? startAsHost

  const controller = createManagerTimerLinkController({
    getLinkState: () => ({
      active: linkStore.active,
      playSessionId: linkStore.playSessionId,
      launchConfig: linkStore.launchConfig,
      lastSyncPosture: linkStore.lastSyncPosture,
    }),
    beginLink: (input) => linkStore.beginLink(input),
    clearLink: () => linkStore.clearLink(),
    setLastSyncPosture: (posture) => linkStore.setLastSyncPosture(posture),
    applyLaunchConfig: (launchConfig) => timerStore.applyLaunchConfig(launchConfig),
    isHosting: () => Boolean(isHosting.value),
    leaveSession: () => leaveSessionFn(),
    startAsHost: () => startAsHostFn(),
    navigate: (route) => {
      void router.push(route)
    },
  })

  watch(isHosting, (hosting) => {
    if (hosting) {
      linkStore.setLastSyncPosture('host')
    }
  })

  const { isManagerLinked, playSessionId, lastSyncPosture } = storeToRefs(linkStore)

  return {
    isManagerLinked,
    playSessionId,
    lastSyncPosture,
    enterLinkedTimer: controller.enterLinkedTimer,
    clearAfterSuccessfulGameEnd: controller.clearAfterSuccessfulGameEnd,
    recordPostureFromSession: controller.recordPostureFromSession,
  }
}
