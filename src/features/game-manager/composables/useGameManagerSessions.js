import { computed, ref, shallowRef, watch } from 'vue'
import {
  deleteManagerPlaySession,
  listManagerCollection,
  listManagerPeople,
  listManagerPlaySessions,
  upsertManagerCollectionItem,
  upsertManagerPlaySession,
} from '../firebase/managerStore.js'
import { useGameManagerAuth } from './useGameManagerAuth.js'
import {
  dropPresentPlayer,
  maybeAddSessionGameToCollection,
  movePlaySession,
  startPlaySessionDraft,
  writePlaySessionScore,
} from '../sessions/sessionsViewModel.js'

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
    } finally {
      loading.value = false
    }
  }

  watch(uid, () => {
    reload().catch(() => {})
  }, { immediate: true })

  async function persist(session) {
    if (!uid.value) return
    await upsertManagerPlaySession(uid.value, session.id, session)
    await reload()
    activeSession.value = (await listManagerPlaySessions(uid.value)).find((x) => x.id === session.id) || session
  }

  /**
   * @param {{ game: object, presentPlayerIds: string[], addToCollection?: boolean }} input
   */
  async function createSession(input) {
    const presentPlayers = people.value
      .filter((p) => input.presentPlayerIds.includes(p.id))
      .map((p) => ({
        recordedPlayerId: p.id,
        name: p.name,
        color: p.color,
      }))
    let session = startPlaySessionDraft({
      id: newId('session'),
      game: input.game,
      presentPlayers,
      addToCollection: input.addToCollection !== false,
    })
    const shelf = maybeAddSessionGameToCollection(collectionItems.value, session)
    if (shelf.changed && uid.value) {
      for (const item of shelf.items) {
        await upsertManagerCollectionItem(uid.value, item.id, item)
      }
    }
    await persist(session)
    return session
  }

  async function selectSession(sessionId) {
    activeSession.value = sessions.value.find((s) => s.id === sessionId) || null
  }

  async function transition(nextState) {
    if (!activeSession.value) return
    const next = movePlaySession(activeSession.value, nextState)
    await persist(next)
  }

  async function saveScore(score) {
    if (!activeSession.value) return
    const next = writePlaySessionScore(activeSession.value, score)
    await persist(next)
  }

  async function dropPlayer(recordedPlayerId) {
    if (!activeSession.value) return
    const next = dropPresentPlayer(activeSession.value, recordedPlayerId)
    await persist(next)
  }

  async function removeSession(sessionId) {
    if (!uid.value) return
    await deleteManagerPlaySession(uid.value, sessionId)
    if (activeSession.value?.id === sessionId) activeSession.value = null
    await reload()
  }

  return {
    sessions,
    people,
    collectionItems,
    activeSession,
    loading,
    reload,
    createSession,
    selectSession,
    transition,
    saveScore,
    dropPlayer,
    removeSession,
  }
}
