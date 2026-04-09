/**
 * @import '../features/game-timer/types.js'
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import { createPlayerId, nextDefaultColor } from '../features/game-timer/core.js'

/**
 * Rebuild `players` to match `idOrder`, appending any players missing from that list.
 * @param {GameTimerPlayer[]} players
 * @param {string[]} idOrder
 * @returns {GameTimerPlayer[]}
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

/** Pinia store: Game Timer session (players, turns, rounds, persisted). */
export const useGameTimerStore = defineStore('gameTimer', {
  state: () => ({
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  }),

  getters: {
    /**
     * True when the session has multi-round UI (round > 1 or stored data for round 2+).
     * @returns {boolean}
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

  /**
   * pinia-plugin-persistedstate: `pick` lists fields; `afterHydrate` normalizes players and order maps.
   */
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
    /** Persist the current `players` order under the active `round`. */
    _saveOrderForRound() {
      this.playerOrderByRound[String(this.round)] = this.players.map((p) => p.id)
    },

    /** Reorder `players` from `playerOrderByRound[round]`, merging in any new ids. */
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

    /**
     * Append a player and register them in the current round’s order.
     * @param {{ name?: string, color?: string }} [payload]
     * @returns {string} New player id.
     */
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

    /** Replace `players` and save order for the active round (e.g. drag-and-drop). */
    reorderPlayers(nextOrder) {
      if (!Array.isArray(nextOrder)) return
      this.players = nextOrder
      this.playerOrderByRound[String(this.round)] = nextOrder.map((p) => p.id)
    },

    /**
     * Add elapsed time since `turnStartedAt` to `bankedMs` and `bankedMsByRound`.
     * @param {number} [now]
     */
    _bankActiveSegment(now = Date.now()) {
      if (this.activePlayerId == null || this.turnStartedAt == null) return
      const seg = Math.max(0, now - this.turnStartedAt)
      const p = this.players.find((player) => player.id === this.activePlayerId)
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

    /** Clear active turn fields without banking (caller must bank first if needed). */
    _clearLiveTurn() {
      this.activePlayerId = null
      this.turnStartedAt = null
      this.turnStartedRound = null
    },

    /** Bank the live segment (if any) and clear active turn state. */
    _pauseLiveTurn(now = Date.now()) {
      this._bankActiveSegment(now)
      this._clearLiveTurn()
    },

    /** Increment round, pausing any live turn and applying saved order for the new round. */
    goToNextRound() {
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      this.round += 1
      this._applyOrderForActiveRound()
    },

    /** Decrement round (no-op on round 1); pauses any live turn. */
    goToPreviousRound() {
      if (this.round <= 1) return
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      this.round -= 1
      this._applyOrderForActiveRound()
    },

    /**
     * Clear per-round banked time, drop order keys for rounds above 1, set round to 1. Lifetime `bankedMs` unchanged.
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

    /**
     * Start this player’s turn, or stop if already active (banks in both cases when stopping).
     * @param {string} playerId
     */
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

    /** Remove a player from the list and from every round’s stored order. */
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

    /**
     * @param {string} playerId
     * @param {string} name
     */
    setPlayerName(playerId, name) {
      const p = this.players.find((player) => player.id === playerId)
      if (!p) return
      const t = String(name).trim()
      p.name = t || p.name
    },

    /**
     * @param {string} playerId
     * @param {string} color
     */
    setPlayerColor(playerId, color) {
      const p = this.players.find((player) => player.id === playerId)
      if (!p) return
      p.color = color
    },

    /** Bank any live turn, then clear all players and order; round becomes 1. */
    clearAllPlayers() {
      this._pauseLiveTurn()
      this.players = []
      this.playerOrderByRound = {}
      this.round = 1
    },

    /** Bank active segment and advance to the next player in list order (wraps). */
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
