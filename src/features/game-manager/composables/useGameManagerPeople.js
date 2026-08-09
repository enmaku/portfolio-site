import { ref, shallowRef, watch } from 'vue'
import {
  applyPersonDeletionToSessions,
} from '../domain/people.js'
import {
  deleteManagerPerson,
  listManagerPeople,
  listManagerPlaySessions,
  upsertManagerPerson,
  upsertManagerPlaySession,
} from '../firebase/managerStore.js'
import { useGameManagerAuth } from '../composables/useGameManagerAuth.js'
import {
  buildNewPersonDraft,
  personMatchSuggestionsForTypedName,
  withSavedFlag,
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

  /**
   * @param {{ name: string, color?: string, persistToRoster?: boolean, existingId?: string }} input
   */
  async function addOrSelectPerson(input) {
    const uid = user.value?.uid
    if (!uid) return null
    const person = input.existingId
      ? withSavedFlag(
          people.value.find((p) => p.id === input.existingId) ||
            buildNewPersonDraft({ ...input, id: input.existingId }),
          Boolean(input.persistToRoster) ||
            Boolean(people.value.find((p) => p.id === input.existingId)?.saved),
        )
      : buildNewPersonDraft(input)
    error.value = null
    try {
      await upsertManagerPerson(uid, person.id, person)
      await reload()
      return person
    } catch (e) {
      error.value = e
      throw e
    }
  }

  async function setSaved(personId, saved) {
    const uid = user.value?.uid
    if (!uid) return
    const current = people.value.find((p) => p.id === personId)
    if (!current) return
    const next = withSavedFlag(current, saved)
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
    addOrSelectPerson,
    setSaved,
    deletePerson,
  }
}
