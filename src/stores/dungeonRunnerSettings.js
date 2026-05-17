import { acceptHMRUpdate, defineStore } from 'pinia'

const VALID_PACES = new Set(['cinematic', 'brisk'])

export const useDungeonRunnerSettingsStore = defineStore('dungeonRunnerSettings', {
  state: () => ({
    animationPace: 'cinematic',
    memoryAidEnabled: false,
  }),

  persist: {
    key: 'portfolio-dungeon-runner-settings',
    pick: ['animationPace', 'memoryAidEnabled'],
    afterHydrate: ({ store }) => {
      store.animationPace = VALID_PACES.has(store.animationPace) ? store.animationPace : 'cinematic'
      store.memoryAidEnabled = store.memoryAidEnabled === true
    },
  },

  actions: {
    setAnimationPace(value) {
      this.animationPace = VALID_PACES.has(value) ? value : 'cinematic'
    },
    setMemoryAidEnabled(value) {
      this.memoryAidEnabled = value === true
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDungeonRunnerSettingsStore, import.meta.hot))
}
