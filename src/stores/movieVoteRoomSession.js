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
    /** Sticky participant name for this room (resume without re-prompt). */
    participantName: '',
  }),

  actions: {
    /**
     * @param {string} suffix
     * @param {string} [participantName]
     */
    setHost(suffix, participantName = '') {
      this.role = 'host'
      this.suffix = suffix
      if (participantName) this.participantName = participantName
    },

    /**
     * @param {string} suffix
     * @param {string} [participantName]
     */
    setGuest(suffix, participantName = '') {
      this.role = 'guest'
      this.suffix = suffix
      if (participantName) this.participantName = participantName
    },

    clear() {
      this.role = null
      this.suffix = null
      this.participantName = ''
    },
  },

  persist: {
    key: 'portfolio-movie-vote-room',
    pick: ['role', 'suffix', 'participantName'],
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMovieVoteRoomSessionStore, import.meta.hot))
}
