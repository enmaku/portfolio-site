/**
 * Persisted manager ↔ timer link binding and last sync posture.
 */
import { defineStore, acceptHMRUpdate } from 'pinia'

export const useGameManagerTimerLinkStore = defineStore('gameManagerTimerLink', {
  state: () => ({
    /** @type {string | null} */
    playSessionId: null,
    /** @type {{ seats: Array<{ recordedPlayerId?: string, name: string, color: string }> } | null} */
    launchConfig: null,
    active: false,
    /** @type {'local' | 'host'} */
    lastSyncPosture: 'local',
  }),

  getters: {
    isManagerLinked: (state) => Boolean(state.active && state.playSessionId),
  },

  actions: {
    /**
     * @param {{ playSessionId: string, launchConfig: object }} input
     */
    beginLink({ playSessionId, launchConfig }) {
      this.playSessionId = playSessionId
      this.launchConfig = launchConfig
      this.active = true
    },

    clearLink() {
      this.playSessionId = null
      this.launchConfig = null
      this.active = false
    },

    /**
     * @param {'local' | 'host'} posture
     */
    setLastSyncPosture(posture) {
      this.lastSyncPosture = posture === 'host' ? 'host' : 'local'
    },
  },

  persist: {
    key: 'portfolio-game-manager-timer-link',
    pick: ['playSessionId', 'launchConfig', 'active', 'lastSyncPosture'],
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameManagerTimerLinkStore, import.meta.hot))
}
