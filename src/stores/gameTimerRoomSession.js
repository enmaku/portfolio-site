/**
 * Persisted P2P room intent so refresh can reconnect (same hub id for host, re-join for guest).
 */
import { defineStore, acceptHMRUpdate } from 'pinia'

export const useGameTimerRoomSessionStore = defineStore('gameTimerRoomSession', {
  state: () => ({
    /** @type {null | 'host' | 'guest'} */
    role: null,
    /** @type {null | string} */
    suffix: null,
  }),

  actions: {
    /**
     * @param {string} suffix
     */
    setHost(suffix) {
      this.role = 'host'
      this.suffix = suffix
    },

    /**
     * @param {string} suffix
     */
    setGuest(suffix) {
      this.role = 'guest'
      this.suffix = suffix
    },

    /**
     * Clears persisted role and room suffix (user left or session invalidated).
     * @returns {void}
     */
    clear() {
      this.role = null
      this.suffix = null
    },
  },

  persist: {
    key: 'portfolio-game-timer-room',
    pick: ['role', 'suffix'],
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameTimerRoomSessionStore, import.meta.hot))
}
