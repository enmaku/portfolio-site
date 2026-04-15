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

/**
 * @param {Record<string, string[]>} hardPassOrderByRound
 * @param {string} playerId
 */
function stripPlayerFromHardPassMaps(hardPassOrderByRound, playerId) {
  for (const k of Object.keys(hardPassOrderByRound)) {
    const arr = hardPassOrderByRound[k]
    if (Array.isArray(arr)) {
      hardPassOrderByRound[k] = arr.filter((id) => id !== playerId)
    }
  }
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
    hardPassEnabled: false,
    hardPassOrderNextRound: false,
    hardPassOrderByRound: {},
  }),

  getters: {
    /**
     * True when the session has multi-round UI (round > 1 or stored data for round 2+).
     * Draft `playerOrderByRound` keys for rounds beyond `round` (e.g. next-round prep) do not count.
     * @returns {boolean}
     */
    hasMultipleRounds(state) {
      if (state.round > 1) return true
      const cur = state.round
      for (const k of Object.keys(state.playerOrderByRound)) {
        const nk = Number(k)
        if (nk > 1 && nk <= cur) return true
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
      'hardPassEnabled',
      'hardPassOrderNextRound',
      'hardPassOrderByRound',
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
      if (typeof store.hardPassEnabled !== 'boolean') store.hardPassEnabled = false
      if (typeof store.hardPassOrderNextRound !== 'boolean') store.hardPassOrderNextRound = false
      if (!store.hardPassOrderByRound || typeof store.hardPassOrderByRound !== 'object') {
        store.hardPassOrderByRound = {}
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
     * When hard pass affects next round, set `playerOrderByRound[n+1]` from pass order + remaining ids.
     * With an empty pass list, draft next-round order matches current display order.
     * @param {number} n
     */
    _recomputeNextRoundOrderFromHardPasses(n) {
      if (!this.hardPassEnabled || !this.hardPassOrderNextRound) return
      if (this.players.length === 0) return
      const nk = String(Math.max(1, Math.floor(n)))
      const nextK = String(Math.max(1, Math.floor(n)) + 1)
      const raw = this.hardPassOrderByRound[nk]
      const passers = Array.isArray(raw)
        ? raw.filter((id) => this.players.some((p) => p.id === id))
        : []
      if (passers.length === 0) {
        this.playerOrderByRound[nextK] = this.players.map((p) => p.id)
        return
      }
      const passerSet = new Set(passers)
      const remaining = this.players.map((p) => p.id).filter((id) => !passerSet.has(id))
      this.playerOrderByRound[nextK] = [...passers, ...remaining]
    },

    /**
     * @param {number} fromIdx Index in `this.players` to start after (exclusive step pattern like end turn).
     * @param {Set<string>} passed
     * @returns {number | null} Next player index or null if none eligible.
     */
    _nextNonPassedPlayerIndex(fromIdx, passed) {
      const n = this.players.length
      if (n === 0) return null
      let nextIdx = (fromIdx + 1) % n
      for (let steps = 0; steps < n; steps++) {
        if (!passed.has(this.players[nextIdx].id)) return nextIdx
        nextIdx = (nextIdx + 1) % n
      }
      return null
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
      const nextR = String(this.round + 1)
      const nextOrder = this.playerOrderByRound[nextR]
      if (Array.isArray(nextOrder) && nextOrder.length > 0 && !nextOrder.includes(player.id)) {
        this.playerOrderByRound[nextR] = [...nextOrder, player.id]
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
     * @param {boolean} value
     */
    setHardPassEnabled(value) {
      this.hardPassEnabled = Boolean(value)
      if (!this.hardPassEnabled) {
        this.hardPassOrderNextRound = false
      }
    },

    /**
     * @param {boolean} value
     */
    setHardPassOrderNextRound(value) {
      if (!this.hardPassEnabled) {
        this.hardPassOrderNextRound = false
        return
      }
      this.hardPassOrderNextRound = Boolean(value)
      if (this.hardPassOrderNextRound) {
        const arr = this.hardPassOrderByRound[String(this.round)]
        if (Array.isArray(arr) && arr.length > 0) {
          this._recomputeNextRoundOrderFromHardPasses(this.round)
        }
      }
    },

    /**
     * @param {string} playerId
     */
    registerHardPass(playerId) {
      if (!this.hardPassEnabled || !this.players.some((p) => p.id === playerId)) return

      const rk = String(this.round)
      if (!this.hardPassOrderByRound[rk] || !Array.isArray(this.hardPassOrderByRound[rk])) {
        this.hardPassOrderByRound[rk] = []
      }
      if (this.hardPassOrderByRound[rk].includes(playerId)) return

      const now = Date.now()
      const clockRunning = this.activePlayerId === playerId && this.turnStartedAt != null
      const turnHeldHere = this.activePlayerId === playerId

      if (clockRunning) {
        this._bankActiveSegment(now)
      }

      this.hardPassOrderByRound[rk].push(playerId)
      this._recomputeNextRoundOrderFromHardPasses(this.round)

      if (turnHeldHere) {
        const passed = new Set(this.hardPassOrderByRound[rk] ?? [])
        const idx = this.players.findIndex((p) => p.id === playerId)
        const nextIdx = idx === -1 ? null : this._nextNonPassedPlayerIndex(idx, passed)
        if (nextIdx == null) {
          this._clearLiveTurn()
        } else {
          const next = this.players[nextIdx]
          this.activePlayerId = next.id
          this.turnStartedAt = now
          this.turnStartedRound = this.round
        }
      }

      const list = this.hardPassOrderByRound[rk] ?? []
      const passedSet = new Set(list)
      const allHardPassed =
        this.players.length > 0 && this.players.every((p) => passedSet.has(p.id))
      if (allHardPassed) {
        this.goToNextRound()
      }
    },

    /**
     * Remove a hard pass for this round (mistake). Recomputes draft next-round order when enabled.
     * Does not restore banked time if they had passed while the clock was running.
     * @param {string} playerId
     */
    undoHardPass(playerId) {
      if (!this.hardPassEnabled || !this.players.some((p) => p.id === playerId)) return
      const rk = String(this.round)
      const arr = this.hardPassOrderByRound[rk]
      if (!Array.isArray(arr) || !arr.includes(playerId)) return
      this.hardPassOrderByRound[rk] = arr.filter((id) => id !== playerId)
      this._recomputeNextRoundOrderFromHardPasses(this.round)
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
      if (this.players.length === 0) return
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      this.round += 1
      this._applyOrderForActiveRound()
    },

    /** Decrement round (no-op on round 1); pauses any live turn. */
    goToPreviousRound() {
      if (this.players.length === 0 || this.round <= 1) return
      const now = Date.now()
      this._saveOrderForRound()
      this._pauseLiveTurn(now)
      this.round -= 1
      this._applyOrderForActiveRound()
    },

    /**
     * Start this player’s turn; tap same player again to pause (clock stops, turn stays); tap again to resume.
     * @param {string} playerId
     */
    selectPlayer(playerId) {
      const now = Date.now()
      if (!this.players.some((p) => p.id === playerId)) return

      if (this.activePlayerId === playerId) {
        if (this.turnStartedAt != null) {
          this._bankActiveSegment(now)
          this.turnStartedAt = null
          this.turnStartedRound = null
          return
        }
        this.turnStartedAt = now
        this.turnStartedRound = this.round
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
      stripPlayerFromHardPassMaps(this.hardPassOrderByRound, playerId)
      if (this.hardPassEnabled && this.hardPassOrderNextRound && this.players.length > 0) {
        this._recomputeNextRoundOrderFromHardPasses(this.round)
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
      this.hardPassEnabled = false
      this.hardPassOrderNextRound = false
      this.hardPassOrderByRound = {}
    },

    /** Bank active segment and advance to the next player in list order (wraps); skips hard-passed when enabled. */
    endTurnNext() {
      const now = Date.now()
      if (this.players.length === 0 || this.activePlayerId == null) {
        return
      }

      if (this.turnStartedAt != null) {
        this._bankActiveSegment(now)
      }

      const idx = this.players.findIndex((p) => p.id === this.activePlayerId)
      if (idx === -1) {
        this._clearLiveTurn()
        return
      }

      const passed = this.hardPassEnabled
        ? new Set(this.hardPassOrderByRound[String(this.round)] ?? [])
        : new Set()

      const nextIdx = this._nextNonPassedPlayerIndex(idx, passed)
      if (nextIdx == null) {
        this._clearLiveTurn()
        return
      }
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
