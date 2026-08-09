import { onMounted, shallowRef, ref } from 'vue'
import { listManagerPeople, listManagerPlaySessions } from '../firebase/managerStore.js'
import { useGameManagerAuth } from './useGameManagerAuth.js'
import { buildStatsRows } from '../stats/statsViewModel.js'

export function useGameManagerStats() {
  const { user } = useGameManagerAuth()
  const rows = shallowRef([])
  const loading = ref(false)

  async function reload() {
    const uid = user.value?.uid
    if (!uid) {
      rows.value = []
      return
    }
    loading.value = true
    try {
      const [people, sessions] = await Promise.all([
        listManagerPeople(uid),
        listManagerPlaySessions(uid),
      ])
      rows.value = buildStatsRows(people, sessions)
    } finally {
      loading.value = false
    }
  }

  onMounted(reload)

  return { rows, loading, reload }
}
