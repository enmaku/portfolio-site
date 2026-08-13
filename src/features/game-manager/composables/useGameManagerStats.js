import { shallowRef, ref, watch } from 'vue'
import {
  listManagerCollection,
  listManagerPeople,
  listManagerPlaySessions,
} from '../firebase/managerStore.js'
import { useGameManagerAuth } from './useGameManagerAuth.js'
import { buildAggregateStatisticsViewModel } from '../stats/aggregateStatisticsViewModel.js'

export function useGameManagerStats() {
  const { user } = useGameManagerAuth()
  const model = shallowRef(
    buildAggregateStatisticsViewModel({ people: [], sessions: [], gamesInCollection: 0 }),
  )
  const loading = ref(false)

  async function reload() {
    const uid = user.value?.uid
    if (!uid) {
      model.value = buildAggregateStatisticsViewModel({
        people: [],
        sessions: [],
        gamesInCollection: 0,
      })
      return
    }
    loading.value = true
    try {
      const [people, sessions, collection] = await Promise.all([
        listManagerPeople(uid),
        listManagerPlaySessions(uid),
        listManagerCollection(uid),
      ])
      model.value = buildAggregateStatisticsViewModel({
        people,
        sessions,
        gamesInCollection: collection.length,
      })
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

  return { model, loading, reload }
}
