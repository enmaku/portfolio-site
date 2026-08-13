/**
 * Live wiring for manager-linked Timer game end → scoring.
 */
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useGameManagerAuth } from './useGameManagerAuth.js'
import { useManagerTimerLink } from './useManagerTimerLink.js'
import { attachExportAndTransitionToScoring } from '../domain/attachExportAndTransitionToScoring.js'
import { buildGameManagerScoringRoute } from '../domain/timerLinkOrchestration.js'
import { runLinkedGameEnd } from '../domain/runLinkedGameEnd.js'
import { deriveTimerExportFromSnapshot } from '../../game-timer/deriveTimerExportFromSnapshot.js'
import { leaveSession } from '../../game-timer/p2p/session.js'
import { useGameTimerP2P } from '../../game-timer/composables/useGameTimerP2P.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameManagerTimerLinkStore } from '../../../stores/gameManagerTimerLink.js'
import {
  getManagerPlaySession,
  upsertManagerPlaySession,
} from '../firebase/managerStore.js'

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * @param {{
 *   router?: ReturnType<typeof useRouter>,
 *   notify?: (opts: object) => void,
 * }=} [options]
 */
export function useManagerLinkedGameEnd(options = {}) {
  const router = options.router ?? useRouter()
  const $q = useQuasar()
  const notify = options.notify ?? ((opts) => $q.notify(opts))
  const { user, isAccountOwner } = useGameManagerAuth()
  const timerStore = useGameTimerStore()
  const linkStore = useGameManagerTimerLinkStore()
  const { isHosting } = useGameTimerP2P()
  const timerLink = useManagerTimerLink({ router })
  const { playSessionId, isManagerLinked } = storeToRefs(linkStore)

  async function confirmGameEnd() {
    const result = await runLinkedGameEnd({
      canPersist: () => Boolean(isAccountOwner.value && user.value?.uid),
      playSessionId: () => playSessionId.value,
      isHosting: () => Boolean(isHosting.value),
      deriveExport: () =>
        deriveTimerExportFromSnapshot(
          {
            totalGameStartedAt: timerStore.totalGameStartedAt,
            players: timerStore.players,
            activePlayerId: timerStore.activePlayerId,
            turnStartedAt: timerStore.turnStartedAt,
          },
          Date.now(),
        ),
      attachExport: async (timerExport) => {
        const uid = user.value.uid
        const sessionId = playSessionId.value
        return attachExportAndTransitionToScoring({
          uid,
          playSessionId: sessionId,
          timerExport,
          getSession: getManagerPlaySession,
          upsertSession: upsertManagerPlaySession,
          newId: () => newId('rp'),
        })
      },
      transitionToScoring: async () => {
        // attachExportAndTransitionToScoring already moved to scoring.
      },
      leaveSession: () => leaveSession(),
      clearLink: () => timerLink.clearAfterSuccessfulGameEnd(),
      recordPosture: (input) => timerLink.recordPostureFromSession(input),
      navigateToManagerScoring: (sessionId) => {
        void router.push(buildGameManagerScoringRoute({ playSessionId: sessionId }))
      },
    })

    if (!result.ok) {
      notify({
        type: 'negative',
        message:
          result.reason === 'auth'
            ? 'Sign in again to continue to scoring.'
            : 'Could not save timer results. Stay on this game and retry.',
        timeout: 3500,
        position: 'top',
        classes: 'gt-notify',
      })
    }
    return result
  }

  return {
    isManagerLinked,
    playSessionId,
    confirmGameEnd,
  }
}
