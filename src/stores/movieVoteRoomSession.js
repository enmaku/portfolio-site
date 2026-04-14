/**
 * Persisted P2P room intent for Movie Vote (refresh resume).
 */
import { defineStore, acceptHMRUpdate } from 'pinia'

export const useMovieVoteRoomSessionStore = defineStore('movieVoteRoomSession', {
  state: () => ({
    /** @type {null | 'host' | 'guest'} */
    role: null,
    /** @type {null | string} */
    suffix: null,
  }),

  actions: {
    /** @param {string} suffix */
    setHost(suffix) {
      this.role = 'host'
      this.suffix = suffix
    },

    /** @param {string} suffix */
    setGuest(suffix) {
      this.role = 'guest'
      this.suffix = suffix
    },

    clear() {
      this.role = null
      this.suffix = null
    },
  },

  persist: {
    key: 'portfolio-movie-vote-room',
    pick: ['role', 'suffix'],
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMovieVoteRoomSessionStore, import.meta.hot))
}
