import { defineStore, acceptHMRUpdate } from 'pinia'
import { createPlayerId, nextDefaultColor } from '../features/game-timer/core.js'

export const useGameTimerStore = defineStore('gameTimer', {
  state: () => ({
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
  }),

  persist: {
    key: 'portfolio-game-timer',
    pick: ['players', 'activePlayerId', 'turnStartedAt'],
  },

  actions: {
    addPlayer({ name, color } = {}) {
      const player = {
        id: createPlayerId(),
        name: (name ?? `Player ${this.players.length + 1}`).trim() || `Player ${this.players.length + 1}`,
        color: color ?? nextDefaultColor(this.players),
        bankedMs: 0,
      }
      this.players.push(player)
      return player.id
    },

    /** Bank current segment for the active player (if any). */
    _bankActiveSegment(now = Date.now()) {
      if (this.activePlayerId == null || this.turnStartedAt == null) return
      const p = this.players.find((x) => x.id === this.activePlayerId)
      if (p) {
        p.bankedMs += Math.max(0, now - this.turnStartedAt)
      }
    },

    selectPlayer(playerId) {
      const now = Date.now()
      if (!this.players.some((p) => p.id === playerId)) return

      if (this.activePlayerId === playerId) {
        this._bankActiveSegment(now)
        this.activePlayerId = null
        this.turnStartedAt = null
        return
      }

      if (this.activePlayerId != null) {
        this._bankActiveSegment(now)
      }
      this.activePlayerId = playerId
      this.turnStartedAt = now
    },

    removePlayer(playerId) {
      const now = Date.now()
      const idx = this.players.findIndex((p) => p.id === playerId)
      if (idx === -1) return

      const wasActive = this.activePlayerId === playerId
      if (wasActive) {
        this._bankActiveSegment(now)
      }

      this.players.splice(idx, 1)

      if (wasActive) {
        this.activePlayerId = null
        this.turnStartedAt = null
      }
    },

    setPlayerName(playerId, name) {
      const p = this.players.find((x) => x.id === playerId)
      if (!p) return
      const t = String(name).trim()
      p.name = t || p.name
    },

    setPlayerColor(playerId, color) {
      const p = this.players.find((x) => x.id === playerId)
      if (!p) return
      p.color = color
    },

    clearAllPlayers() {
      this.players = []
      this.activePlayerId = null
      this.turnStartedAt = null
    },

    /** Bank active segment and start the next player's turn (list order, wraps). */
    endTurnNext() {
      const now = Date.now()
      if (this.players.length === 0 || this.activePlayerId == null || this.turnStartedAt == null) {
        return
      }

      this._bankActiveSegment(now)

      const idx = this.players.findIndex((p) => p.id === this.activePlayerId)
      if (idx === -1) {
        this.activePlayerId = null
        this.turnStartedAt = null
        return
      }

      const nextIdx = (idx + 1) % this.players.length
      const next = this.players[nextIdx]
      this.activePlayerId = next.id
      this.turnStartedAt = now
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameTimerStore, import.meta.hot))
}
