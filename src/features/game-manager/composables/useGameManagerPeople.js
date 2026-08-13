import { ref, shallowRef, watch } from 'vue'
import { applyPersonDeletionToSessions } from '../domain/people.js'
import {
  deleteManagerPerson,
  listManagerPeople,
  listManagerPlaySessions,
  upsertManagerPerson,
  upsertManagerPlaySession,
} from '../firebase/managerStore.js'
import { useGameManagerAuth } from './useGameManagerAuth.js'
import {
  buildNewPersonDraft,
  nextPersonDefaultColor,
  personMatchSuggestionsForTypedName,
  withPersonIdentity,
} from '../people/peopleViewModel.js'

export function useGameManagerPeople() {
  const { user } = useGameManagerAuth()
  const people = shallowRef([])
  const loading = ref(false)
  const error = ref(null)

  async function reload() {
    const uid = user.value?.uid
    if (!uid) {
      people.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      people.value = await listManagerPeople(uid)
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  watch(
    () => user.value?.uid || null,
    () => {
      reload().catch(() => {})
    },
    { immediate: true },
  )

  function suggestionsForName(name) {
    return personMatchSuggestionsForTypedName(people.value, name)
  }

  function peekNextColor() {
    return nextPersonDefaultColor(people.value)
  }

  /**
   * @param {{ name: string, color?: string, existingId?: string }} input
   */
  async function addOrSelectPerson(input) {
    const uid = user.value?.uid
    if (!uid) return null
    const person = input.existingId
      ? withPersonIdentity(
          people.value.find((p) => p.id === input.existingId) ||
            buildNewPersonDraft({
              name: input.name,
              color: input.color,
              id: input.existingId,
              persistToRoster: true,
            }),
          { name: input.name, color: input.color },
        )
      : buildNewPersonDraft({
          name: input.name,
          color: input.color || nextPersonDefaultColor(people.value),
          persistToRoster: true,
        })
    const saved = { ...person, saved: true }
    error.value = null
    try {
      await upsertManagerPerson(uid, saved.id, saved)
      await reload()
      return saved
    } catch (e) {
      error.value = e
      throw e
    }
  }

  /**
   * @param {string} personId
   * @param {{ name?: string, color?: string }} patch
   */
  async function updatePerson(personId, patch) {
    const uid = user.value?.uid
    if (!uid) return
    const current = people.value.find((p) => p.id === personId)
    if (!current) return
    const next = { ...withPersonIdentity(current, patch), saved: true }
    error.value = null
    try {
      await upsertManagerPerson(uid, personId, next)
      await reload()
    } catch (e) {
      error.value = e
      throw e
    }
  }

  async function deletePerson(personId) {
    const uid = user.value?.uid
    if (!uid) return
    error.value = null
    try {
      const sessions = await listManagerPlaySessions(uid)
      const scrubbed = applyPersonDeletionToSessions(sessions, personId)
      for (const session of scrubbed) {
        await upsertManagerPlaySession(uid, session.id, session)
      }
      await deleteManagerPerson(uid, personId)
      await reload()
    } catch (e) {
      error.value = e
      throw e
    }
  }

  return {
    people,
    loading,
    error,
    reload,
    suggestionsForName,
    peekNextColor,
    addOrSelectPerson,
    updatePerson,
    deletePerson,
  }
}
