/**
 * @import '../types.js'
 * Pinia plugin: sync game timer store over PeerJS when a session is active.
 * Keeps `peerjs` and wire types out of `stores/gameTimer.js`.
 */

import { nextDefaultColor } from '../core.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import {
  bindGameTimerP2PHandlers,
  broadcastGameTimerSnapshot,
  isP2PSessionActive,
} from './session.js'

let applyingRemote = false

const SYNC_ACTION_NAMES = new Set([
  'selectPlayer',
  'endTurnNext',
  'goToNextRound',
  'goToPreviousRound',
  'resetRoundTimeData',
  'addPlayer',
  'removePlayer',
  'reorderPlayers',
  'setPlayerName',
  'setPlayerColor',
  'clearAllPlayers',
  'setHardPassEnabled',
  'setHardPassOrderNextRound',
  'registerHardPass',
  'undoHardPass',
])

/**
 * @param {import('pinia').Store} store `gameTimer` store instance.
 * @returns {GameTimerSyncPayload}
 */
function pickSnapshot(store) {
  const s = store.$state
  return {
    players: JSON.parse(JSON.stringify(s.players)),
    activePlayerId: s.activePlayerId,
    turnStartedAt: s.turnStartedAt,
    turnStartedRound: s.turnStartedRound,
    round: s.round,
    playerOrderByRound: JSON.parse(JSON.stringify(s.playerOrderByRound)),
    hardPassEnabled: s.hardPassEnabled,
    hardPassOrderNextRound: s.hardPassOrderNextRound,
    hardPassOrderByRound: JSON.parse(JSON.stringify(s.hardPassOrderByRound)),
  }
}

/**
 * Mirrors `persist.afterHydrate` normalization in the game timer store.
 * @param {import('pinia').Store} store `gameTimer` store instance.
 * @returns {void}
 */
function normalizeAfterRemotePatch(store) {
  for (const p of store.players) {
    if (typeof p.color !== 'string' || !p.color.trim()) {
      p.color = nextDefaultColor(store.players)
    }
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
}

let handlersBound = false

/** @type {WeakSet<object>} */
const actionHookInstalled = new WeakSet()

/**
 * Registers P2P snapshot handlers once and hooks `gameTimer` store actions for broadcast.
 * @param {import('pinia').PiniaPluginContext} ctx
 * @returns {void}
 */
export function gameTimerP2PPlugin(ctx) {
  const { store } = ctx
  if (store.$id !== 'gameTimer') return

  if (!handlersBound) {
    handlersBound = true
    bindGameTimerP2PHandlers({
      getSnapshot: () => pickSnapshot(useGameTimerStore()),
      applySnapshot: (snap) => {
        const s = useGameTimerStore()
        applyingRemote = true
        // Functional $patch: object $patch deep-merges nested maps, so keys removed on the host would linger for guests.
        s.$patch((state) => {
          state.players = JSON.parse(JSON.stringify(snap.players))
          state.activePlayerId = snap.activePlayerId
          state.turnStartedAt = snap.turnStartedAt
          state.turnStartedRound = snap.turnStartedRound
          state.round = snap.round
          state.playerOrderByRound = JSON.parse(JSON.stringify(snap.playerOrderByRound))
          state.hardPassEnabled = typeof snap.hardPassEnabled === 'boolean' ? snap.hardPassEnabled : false
          state.hardPassOrderNextRound =
            typeof snap.hardPassOrderNextRound === 'boolean' ? snap.hardPassOrderNextRound : false
          state.hardPassOrderByRound =
            snap.hardPassOrderByRound &&
            typeof snap.hardPassOrderByRound === 'object' &&
            !Array.isArray(snap.hardPassOrderByRound)
              ? JSON.parse(JSON.stringify(snap.hardPassOrderByRound))
              : {}
        })
        normalizeAfterRemotePatch(s)
        applyingRemote = false
      },
    })
  }

  if (actionHookInstalled.has(store)) return
  actionHookInstalled.add(store)

  store.$onAction(({ name, after }) => {
    after(() => {
      if (applyingRemote) return
      if (!SYNC_ACTION_NAMES.has(name)) return
      if (!isP2PSessionActive()) return
      try {
        broadcastGameTimerSnapshot(pickSnapshot(useGameTimerStore()))
      } catch (e) {
        console.error('[gameTimerP2P] broadcast failed', e)
      }
    })
  })
}
