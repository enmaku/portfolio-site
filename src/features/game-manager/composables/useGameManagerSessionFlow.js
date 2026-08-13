import { computed, ref, shallowRef } from 'vue'
import {
  buildLaunchConfigFromPresentPlayers,
  buildLaunchConfigFromTimerExport,
} from '../domain/timerHandoff.js'

/**
 * Orchestrates Game detail + play session full-screen steps.
 * @param {{
 *   sessionsApi: ReturnType<typeof import('./useGameManagerSessions.js').useGameManagerSessions>,
 *   activeSurface: import('vue').Ref<string>,
 *   timerLink?: {
 *     enterLinkedTimer: (input: {
 *       playSessionId: string,
 *       launchConfig: object,
 *       forceApplySeats?: boolean,
 *     }) => Promise<unknown>,
 *   },
 * }} deps
 */
export function useGameManagerSessionFlow({ sessionsApi, activeSurface, timerLink }) {
  const {
    activeSession,
    sessions,
    people,
    savedPeople,
    collectionItems,
    createSessionFromShelf,
    selectSession,
    transition,
    saveScore,
    setAttendance,
    addAttendance,
    dropPlayer,
    suggestionsForName,
    peekNextColor,
    upsertPerson,
    reload,
  } = sessionsApi

  const gameDetailItem = shallowRef(null)
  const gameDetailOpen = ref(false)
  /** @type {import('vue').Ref<null | 'setup' | 'playing' | 'scoring' | 'sessionStats'>} */
  const flowPanel = ref(null)
  /** @type {import('vue').Ref<'collection' | 'sessions' | 'people'>} */
  const returnSurface = ref('collection')
  const busy = ref(false)
  const error = ref(null)

  const flowOpen = computed(() => flowPanel.value != null)

  /**
   * @param {object} item
   */
  function openGameDetail(item) {
    gameDetailItem.value = item
    gameDetailOpen.value = true
    returnSurface.value = 'collection'
    error.value = null
  }

  function closeGameDetail() {
    gameDetailOpen.value = false
    gameDetailItem.value = null
  }

  async function startNewSession() {
    if (!gameDetailItem.value || busy.value) return
    busy.value = true
    error.value = null
    try {
      await createSessionFromShelf(gameDetailItem.value)
      flowPanel.value = 'setup'
      gameDetailOpen.value = false
      gameDetailItem.value = null
    } catch (e) {
      error.value = e
      throw e
    } finally {
      busy.value = false
    }
  }

  /**
   * @param {object} session
   * @param {'collection' | 'sessions' | 'people'} [fromSurface]
   */
  async function resumeSession(session, fromSurface = 'sessions') {
    if (!session?.id || busy.value) return
    busy.value = true
    error.value = null
    returnSurface.value = fromSurface
    try {
      await selectSession(session.id)
      if (session.state === 'complete') {
        flowPanel.value = 'sessionStats'
        return
      }
      if (session.state === 'playing') {
        const current = activeSession.value || session
        if (timerLink?.enterLinkedTimer) {
          const launchConfig = buildLaunchConfigFromPresentPlayers(current.presentPlayers || [])
          await timerLink.enterLinkedTimer({
            playSessionId: current.id,
            launchConfig,
          })
          flowPanel.value = null
          return
        }
        flowPanel.value = 'playing'
        return
      }
      if (session.state === 'setup' || session.state === 'scoring') {
        flowPanel.value = session.state
        return
      }
      flowPanel.value = 'setup'
    } catch (e) {
      error.value = e
      throw e
    } finally {
      busy.value = false
    }
  }

  function leaveFlow() {
    flowPanel.value = null
    closeGameDetail()
    selectSession(null)
    if (activeSurface) {
      activeSurface.value = returnSurface.value
    }
  }

  async function startGame() {
    if (!activeSession.value || busy.value) return
    busy.value = true
    error.value = null
    try {
      await transition('playing')
      const session = activeSession.value
      if (timerLink?.enterLinkedTimer && session) {
        const launchConfig = buildLaunchConfigFromPresentPlayers(session.presentPlayers || [])
        await timerLink.enterLinkedTimer({
          playSessionId: session.id,
          launchConfig,
        })
        flowPanel.value = null
        return
      }
      flowPanel.value = 'playing'
    } catch (e) {
      error.value = e
      throw e
    } finally {
      busy.value = false
    }
  }

  async function finishGame() {
    if (!activeSession.value || busy.value) return
    busy.value = true
    error.value = null
    try {
      await transition('scoring')
      flowPanel.value = 'scoring'
    } catch (e) {
      error.value = e
      throw e
    } finally {
      busy.value = false
    }
  }

  /**
   * @param {object} score
   */
  async function saveAndComplete(score) {
    if (!activeSession.value || busy.value) return
    busy.value = true
    error.value = null
    try {
      const alreadyComplete = activeSession.value.state === 'complete'
      await saveScore(score)
      if (!alreadyComplete) {
        await transition('complete')
      }
      if (activeSurface) {
        activeSurface.value = 'sessions'
      }
      await reload()
      flowPanel.value = 'sessionStats'
    } catch (e) {
      error.value = e
      throw e
    } finally {
      busy.value = false
    }
  }

  /**
   * Return from score entry to the manager-linked timer, restoring the attached timer export.
   * Works for in-progress scoring and for editing a complete sitting.
   */
  async function returnToLinkedTimer() {
    const session = activeSession.value
    if (!session || busy.value) return
    if (session.state !== 'scoring' && session.state !== 'complete') return
    const launchConfig = buildLaunchConfigFromTimerExport(session.timerExport)
    if (!launchConfig) return
    busy.value = true
    error.value = null
    try {
      await transition('playing')
      if (timerLink?.enterLinkedTimer) {
        await timerLink.enterLinkedTimer({
          playSessionId: session.id,
          launchConfig,
          forceApplySeats: true,
        })
        flowPanel.value = null
        return
      }
      flowPanel.value = 'playing'
    } catch (e) {
      error.value = e
      throw e
    } finally {
      busy.value = false
    }
  }

  /**
   * Open score entry for a complete sitting without leaving durable complete state.
   */
  function editCompleteSessionScores() {
    if (!activeSession.value || activeSession.value.state !== 'complete') return
    flowPanel.value = 'scoring'
  }

  /**
   * Open scoring after Timer game-end continue cue.
   * @param {string} playSessionId
   */
  async function openScoringFromTimerContinue(playSessionId) {
    if (!playSessionId || busy.value) return
    busy.value = true
    error.value = null
    try {
      await selectSession(playSessionId)
      flowPanel.value = 'scoring'
      returnSurface.value = 'sessions'
    } catch (e) {
      error.value = e
      throw e
    } finally {
      busy.value = false
    }
  }

  return {
    gameDetailItem,
    gameDetailOpen,
    flowPanel,
    flowOpen,
    returnSurface,
    busy,
    error,
    activeSession,
    sessions,
    people,
    savedPeople,
    collectionItems,
    openGameDetail,
    closeGameDetail,
    startNewSession,
    resumeSession,
    leaveFlow,
    startGame,
    finishGame,
    returnToLinkedTimer,
    saveAndComplete,
    editCompleteSessionScores,
    openScoringFromTimerContinue,
    setAttendance,
    addAttendance,
    dropPlayer,
    suggestionsForName,
    peekNextColor,
    upsertPerson,
  }
}
