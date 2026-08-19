import { acceptHMRUpdate, defineStore } from 'pinia'

export const useTimeTrackerSettingsStore = defineStore('timeTrackerSettings', {
  state: () => ({
    fullscreenEnabled: false,
  }),

  persist: {
    key: 'portfolio-time-tracker',
    pick: ['fullscreenEnabled'],
    afterHydrate: ({ store }) => {
      store.fullscreenEnabled = store.fullscreenEnabled === true
    },
  },

  actions: {
    setFullscreenEnabled(value) {
      this.fullscreenEnabled = value === true
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTimeTrackerSettingsStore, import.meta.hot))
}
