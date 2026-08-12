import { computed, ref, shallowRef, watch } from 'vue'
import {
  deleteManagerPlaySession,
  listManagerCollection,
  listManagerPeople,
  listManagerPlaySessions,
  upsertManagerPerson,
  upsertManagerPlaySession,
} from '../firebase/managerStore.js'
import { useGameManagerAuth } from './useGameManagerAuth.js'
import {
  dropPresentPlayer,
  gameRefFromCollectionItem,
  includePresentPlayer,
  applyTimerExport,
  movePlaySession,
  replacePresentPlayers,
  startPlaySessionDraft,
  writePlaySessionScore,
} from '../sessions/sessionsViewModel.js'
import { reopenPlaySessionForScoring } from '../domain/playSession.js'
import {
  buildNewPersonDraft,
  nextPersonDefaultColor,
  personMatchSuggestionsForTypedName,
  withPersonIdentity,
} from '../people/peopleViewModel.js'

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function useGameManagerSessions() {
  const { user } = useGameManagerAuth()
  const sessions = shallowRef([])
  const people = shallowRef([])
  const collectionItems = shallowRef([])
  const activeSession = shallowRef(null)
  const loading = ref(false)

  const uid = computed(() => user.value?.uid || null)

  const savedPeople = computed(() => people.value.filter((p) => p.saved))

  async function reload() {
    if (!uid.value) {
      sessions.value = []
      people.value = []
      collectionItems.value = []
      return
    }
    loading.value = true
    try {
      const [s, p, c] = await Promise.all([
        listManagerPlaySessions(uid.value),
        listManagerPeople(uid.value),
        listManagerCollection(uid.value),
      ])
      sessions.value = s
      people.value = p
      collectionItems.value = c
      if (activeSession.value?.id) {
        activeSession.value = s.find((x) => x.id === activeSession.value.id) || activeSession.value
      }
    } finally {
      loading.value = false
    }
  }

  watch(
    uid,
    () => {
      reload().catch(() => {})
    },
    { immediate: true },
  )

  async function persist(session) {
    if (!uid.value) return session
    await upsertManagerPlaySession(uid.value, session.id, session)
    await reload()
    return sessions.value.find((x) => x.id === session.id) || session
  }

  /**
   * @param {object} collectionItem
   */
  async function createSessionFromShelf(collectionItem) {
    const game = gameRefFromCollectionItem(collectionItem)
    if (!game) throw new Error('Invalid collection item for play session')
    const session = startPlaySessionDraft({
      id: newId('session'),
      game,
      presentPlayers: [],
    })
    const saved = await persist(session)
    activeSession.value = saved
    return saved
  }

  async function selectSession(sessionId) {
    if (!sessionId) {
      activeSession.value = null
      return null
    }
    const found = sessions.value.find((s) => s.id === sessionId) || null
    activeSession.value = found
    return found
  }

  async function transition(nextState) {
    if (!activeSession.value) return null
    const next = movePlaySession(activeSession.value, nextState)
    const saved = await persist(next)
    activeSession.value = saved
    return saved
  }

  /**
   * @param {unknown} timerExport
   */
  async function attachExport(timerExport) {
    if (!activeSession.value) return null
    const next = applyTimerExport(activeSession.value, timerExport, {
      newId: () => newId('rp'),
    })
    const saved = await persist(next)
    activeSession.value = saved
    return saved
  }

  async function saveScore(score) {
    if (!activeSession.value) return null
    const next = writePlaySessionScore(activeSession.value, score)
    const saved = await persist(next)
    activeSession.value = saved
    return saved
  }

  /**
   * @param {object[]} presentPlayers
   */
  async function setAttendance(presentPlayers) {
    if (!activeSession.value) return null
    const next = replacePresentPlayers(activeSession.value, presentPlayers)
    const saved = await persist(next)
    activeSession.value = saved
    return saved
  }

  /**
   * @param {{ recordedPlayerId: string, name: string, color: string }} player
   */
  async function addAttendance(player) {
    if (!activeSession.value) return null
    const next = includePresentPlayer(activeSession.value, player)
    const saved = await persist(next)
    activeSession.value = saved
    return saved
  }

  async function dropPlayer(recordedPlayerId) {
    if (!activeSession.value) return null
    const next = dropPresentPlayer(activeSession.value, recordedPlayerId)
    const saved = await persist(next)
    activeSession.value = saved
    return saved
  }

  async function reopenActiveForScoring() {
    if (!activeSession.value) return null
    const next = reopenPlaySessionForScoring(activeSession.value)
    const saved = await persist(next)
    activeSession.value = saved
    return saved
  }

  async function removeSession(sessionId) {
    if (!uid.value) return
    await deleteManagerPlaySession(uid.value, sessionId)
    if (activeSession.value?.id === sessionId) activeSession.value = null
    await reload()
  }

  function suggestionsForName(name) {
    return personMatchSuggestionsForTypedName(people.value, name)
  }

  function peekNextColor() {
    return nextPersonDefaultColor(people.value)
  }

  /**
   * @param {{ name: string, color?: string, existingId?: string, persistToRoster?: boolean }} input
   */
  async function upsertPerson(input) {
    if (!uid.value) return null
    const persistToRoster = input.persistToRoster !== false
    const person = input.existingId
      ? withPersonIdentity(
          people.value.find((p) => p.id === input.existingId) ||
            buildNewPersonDraft({
              name: input.name,
              color: input.color,
              id: input.existingId,
              persistToRoster,
            }),
          { name: input.name, color: input.color },
        )
      : buildNewPersonDraft({
          name: input.name,
          color: input.color || nextPersonDefaultColor(people.value),
          persistToRoster,
        })
    const saved = persistToRoster ? { ...person, saved: true } : { ...person, saved: false }
    await upsertManagerPerson(uid.value, saved.id, saved)
    await reload()
    return people.value.find((p) => p.id === saved.id) || saved
  }

  return {
    sessions,
    people,
    savedPeople,
    collectionItems,
    activeSession,
    loading,
    reload,
    createSessionFromShelf,
    selectSession,
    transition,
    attachExport,
    saveScore,
    setAttendance,
    addAttendance,
    dropPlayer,
    reopenActiveForScoring,
    removeSession,
    suggestionsForName,
    peekNextColor,
    upsertPerson,
  }
}
