import { defineStore, acceptHMRUpdate } from 'pinia'
import { createPlayerId, nextDefaultColor } from '../features/game-timer/core.js'

/**
 * Rebuild `players` so it follows `idOrder`, then append any players missing from the list.
 * @param {{ id: string }[]} players
 * @param {string[]} idOrder
 */
function applyPlayerOrder(players, idOrder) {
  const map = new Map(players.map((p) => [p.id, p]))
  const out = []
  const seen = new Set()
  for (const id of idOrder) {
    const p = map.get(id)
    if (p) {
      out.push(p)
      seen.add(id)
    }
  }
  for (const p of players) {
    if (!seen.has(p.id)) out.push(p)
  }
  return out
}

export const useGameTimerStore = defineStore('gameTimer', {
  state: () => ({
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    /** Round index when the current live segment started (for splitting banked time by round). */
    turnStartedRound: null,
    /** 1-based; changing rounds pauses any live turn. */
    round: 1,
    /** Per-round turn order: round key → player id sequence (overwritten when user drags in that round). */
    playerOrderByRound: {},
  }),

  getters: {
    /**
     * True once the session has touched more than one round (viewing round 2+,
     * or any stored data for round 2+). Used to show per-round UI and enable reset.
     */
    hasMultipleRounds(state) {
      if (state.round > 1) return true
      for (const k of Object.keys(state.playerOrderByRound)) {
        if (Number(k) > 1) return true
      }
      for (const p of state.players) {
        const m = p.bankedMsByRound
        if (!m || typeof m !== 'object') continue
        for (const bk of Object.keys(m)) {
          if (Number(bk) > 1) return true
        }
      }
      return false
    },
  },

  persist: {
    key: 'portfolio-game-timer',
    pick: [
      'players',
      'activePlayerId',
      'turnStartedAt',
      'turnStartedRound',
      'round',
      'playerOrderByRound',
    ],
    afterHydrate: (ctx) => {
      const store = ctx.store
      for (const p of store.players) {
        if (!p.bankedMsByRound || typeof p.bankedMsByRound !== 'object') {
          p.bankedMsByRound = {}
        }
        const keys = Object.keys(p.bankedMsByRound)
        if (keys.length === 0 && p.bankedMs > 0) {
          p.bankedMsByRound[String(Math.max(1, store.round))] = p.bankedMs
        }
      }
      if (!store.playerOrderByRound || typeof store.playerOrderByRound !== 'object') {
        store.playerOrderByRound = {}
      }
      store._applyOrderForActiveRound()
    },
  },

  actions: {
    /** Persist current `players` sequence for {@link round}. */
    _saveOrderForRound() {
      this.playerOrderByRound[String(this.round)] = this.players.map((p) => p.id)
    },

    /**
     * Reorder `this.players` to match {@link playerOrderByRound} for {@link round}, merging in new ids.
     */
    _applyOrderForActiveRound() {
      const k = String(this.round)
      let ids = this.playerOrderByRound[k]
      if (!Array.isArray(ids) || ids.length === 0) {
        ids = this.players.map((p) => p.id)
        this.playerOrderByRound[k] = [...ids]
      } else {
        const set = new Set(this.players.map((p) => p.id))
        ids = ids.filter((id) => set.has(id))
        for (const p of this.players) {
          if (!ids.includes(p.id)) ids.push(p.id)
        }
        this.playerOrderByRound[k] = ids
      }
      this.players = applyPlayerOrder(this.players, ids)
    },

    addPlayer({ name, color } = {}) {
      const player = {
        id: createPlayerId(),
        name: (name ?? `Player ${this.players.length + 1}`).trim() || `Player ${this.players.length + 1}`,
        color: color ?? nextDefaultColor(this.players),
        bankedMs: 0,
        bankedMsByRound: {},
      }
      this.players.push(player)
      const k = String(this.round)
      const cur = this.playerOrderByRound[k]
      if (Array.isArray(cur) && cur.length > 0) {
        if (!cur.includes(player.id)) {
          this.playerOrderByRound[k] = [...cur, player.id]
        }
      } else {
        this.playerOrderByRound[k] = this.players.map((p) => p.id)
      }
      return player.id
    },

    /** Replace list order for the current round (drag-and-drop). */
    reorderPlayers(nextOrder) {
      if (!Array.isArray(nextOrder)) return
      this.players = nextOrder
      this.playerOrderByRound[String(this.round)] = nextOrder.map((p) => p.id)
    },

    /** Bank current segment: adds to global `bankedMs` and `bankedMsByRound[turnStartedRound]`. */
    _bankActiveSegment(now = Date.now()) {
      if (this.activePlayerId == null || this.turnStartedAt == null) return
      const seg = Math.max(0, now - this.turnStartedAt)
      const p = this.players.find((x) => x.id === this.activePlayerId)
      if (!p) return

      p.bankedMs += seg

      const r = this.turnStartedRound
      if (r != null) {
        if (!p.bankedMsByRound || typeof p.bankedMsByRound !== 'object') {
          p.bankedMsByRound = {}
        }
        const key = String(r)
        p.bankedMsByRound[key] = (p.bankedMsByRound[key] ?? 0) + seg
      }
    },

    _clearLiveTurn() {
      this.activePlayerId = null
      this.turnStartedAt = null
      this.turnStartedRound = null
    },

    /** Stop the live clock (used before round changes). */
    _pauseLiveTurn(now = Date.now()) {
      this._bankActiveSegment(now)
      this._clearLiveTurn()
    },

    /**
     * Set the current round (1-based). Stops any running timer if the value changes.
     * @param {number} nextRound
     */
    setRound(nextRound) {
      const r = Math.max(1, Math.floor(Number(nextRound)) || 1)
      if (r === this.round) return
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      this.round = r
      this._applyOrderForActiveRound()
    },

    goToNextRound() {
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      this.round += 1
      this._applyOrderForActiveRound()
    },

    goToPreviousRound() {
      if (this.round <= 1) return
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      this.round -= 1
      this._applyOrderForActiveRound()
    },

    /**
     * Clear every player's `bankedMsByRound` and reset `round` to 1. Pauses any live turn first.
     * Drops stored turn order for rounds above 1 so the session matches a single-round game again.
     * Does not change `bankedMs` (lifetime totals).
     */
    resetRoundTimeData() {
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      for (const p of this.players) {
        p.bankedMsByRound = {}
      }
      this.round = 1
      const orderKept = {}
      for (const k of Object.keys(this.playerOrderByRound)) {
        if (Number(k) <= 1) {
          orderKept[k] = this.playerOrderByRound[k]
        }
      }
      this.playerOrderByRound = orderKept
      this._applyOrderForActiveRound()
    },

    selectPlayer(playerId) {
      const now = Date.now()
      if (!this.players.some((p) => p.id === playerId)) return

      if (this.activePlayerId === playerId) {
        this._bankActiveSegment(now)
        this._clearLiveTurn()
        return
      }

      if (this.activePlayerId != null) {
        this._bankActiveSegment(now)
      }
      this.activePlayerId = playerId
      this.turnStartedAt = now
      this.turnStartedRound = this.round
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
        this._clearLiveTurn()
      }

      for (const k of Object.keys(this.playerOrderByRound)) {
        const arr = this.playerOrderByRound[k]
        if (Array.isArray(arr)) {
          this.playerOrderByRound[k] = arr.filter((id) => id !== playerId)
        }
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
      this.resetRoundTimeData()
      this.players = []
      this.playerOrderByRound = {}
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
        this._clearLiveTurn()
        return
      }

      const nextIdx = (idx + 1) % this.players.length
      const next = this.players[nextIdx]
      this.activePlayerId = next.id
      this.turnStartedAt = now
      this.turnStartedRound = this.round
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameTimerStore, import.meta.hot))
}
