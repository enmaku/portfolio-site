/**
 * @import '../features/game-timer/types.js'
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import { createPlayerId, nextDefaultColor } from '../features/game-timer/core.js'
import {
  applyPlayerOrder,
  applyRuleSessionToStore,
  endTurnNextSnapshot,
  goToNextRoundSnapshot,
  goToPreviousRoundSnapshot,
  pauseLiveTurnSnapshot,
  registerHardPassSnapshot,
  removePlayerSnapshot,
  ruleSessionFromStoreState,
  selectPlayerSnapshot,
  startNewGameSamePlayersSnapshot,
  undoHardPassSnapshot,
} from '../features/game-timer/timerRules.js'

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
    fullscreenEnabled: false,
    totalGameStartedAt: null,
    timingStripMode: 'total',
  }),

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
      'fullscreenEnabled',
      'totalGameStartedAt',
      'timingStripMode',
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
      if (typeof store.totalGameStartedAt !== 'number') store.totalGameStartedAt = null
      if (store.timingStripMode !== 'total' && store.timingStripMode !== 'non-player') {
        store.timingStripMode = 'total'
      }
      store.fullscreenEnabled = store.fullscreenEnabled === true
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
     * @param {boolean} value
     */
    setFullscreenEnabled(value) {
      this.fullscreenEnabled = Boolean(value)
    },

    /**
     * @param {'total' | 'non-player'} mode
     */
    setTimingStripMode(mode) {
      this.timingStripMode = mode === 'non-player' ? 'non-player' : 'total'
    },

    toggleTimingStripMode() {
      this.timingStripMode = this.timingStripMode === 'total' ? 'non-player' : 'total'
    },

    /**
     * @param {string} playerId
     */
    registerHardPass(playerId) {
      const next = registerHardPassSnapshot(ruleSessionFromStoreState(this), playerId, Date.now())
      if (next) applyRuleSessionToStore(this, next)
    },

    /**
     * @param {string} playerId
     */
    undoHardPass(playerId) {
      const next = undoHardPassSnapshot(ruleSessionFromStoreState(this), playerId)
      if (next) applyRuleSessionToStore(this, next)
    },

    /** Increment round, pausing any live turn and applying saved order for the new round. */
    goToNextRound() {
      const next = goToNextRoundSnapshot(ruleSessionFromStoreState(this), Date.now())
      if (next) applyRuleSessionToStore(this, next)
    },

    /** Decrement round (no-op on round 1); pauses any live turn. */
    goToPreviousRound() {
      const next = goToPreviousRoundSnapshot(ruleSessionFromStoreState(this), Date.now())
      if (next) applyRuleSessionToStore(this, next)
    },

    /**
     * Start this player’s turn; tap same player again to pause; tap again to resume.
     * @param {string} playerId
     */
    selectPlayer(playerId) {
      const next = selectPlayerSnapshot(ruleSessionFromStoreState(this), playerId, Date.now())
      if (next) applyRuleSessionToStore(this, next)
    },

    /** Remove a player from the list and from every round’s stored order. */
    removePlayer(playerId) {
      const next = removePlayerSnapshot(ruleSessionFromStoreState(this), playerId, Date.now())
      if (next) applyRuleSessionToStore(this, next)
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

    /**
     * Bank live turn, clear clocks and round progression, keep roster and session rule toggles.
     */
    startNewGameSamePlayers() {
      const next = startNewGameSamePlayersSnapshot(ruleSessionFromStoreState(this), Date.now())
      if (next) applyRuleSessionToStore(this, next)
    },

    /** Bank any live turn, then clear all players and order; round becomes 1. */
    clearAllPlayers() {
      const paused = pauseLiveTurnSnapshot(ruleSessionFromStoreState(this), Date.now())
      applyRuleSessionToStore(this, paused)
      this.players = []
      this.playerOrderByRound = {}
      this.round = 1
      this.hardPassEnabled = false
      this.hardPassOrderNextRound = false
      this.hardPassOrderByRound = {}
      this.totalGameStartedAt = null
      this.timingStripMode = 'total'
    },

    /** Bank active segment and advance to the next player in list order (wraps); skips hard-passed when enabled. */
    endTurnNext() {
      const next = endTurnNextSnapshot(ruleSessionFromStoreState(this), Date.now())
      if (next) applyRuleSessionToStore(this, next)
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameTimerStore, import.meta.hot))
}
