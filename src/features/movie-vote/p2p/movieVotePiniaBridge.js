/**
 * @import '../types.js'
 * Pinia plugin: apply inbound Movie Vote public state over P2P without echoing outbound sync.
 */

import { useMovieVoteStore } from '../../../stores/movieVote.js'
import {
  bindMovieVoteP2PHandlers,
  isMovieVoteP2PSessionActive,
  sessionPhase,
} from './session.js'

let applyingRemote = false

/** @type {import('./session.js').MovieVoteP2POutboundSync | null} */
let outboundSync = null

/** @type {string[]} */
let syncProbe = []

/** @type {string[]} */
let hostSuggestOutboundProbe = []

/** @type {{ participantId: string, ranking: string[] }[]} */
let guestVoteWireProbe = []

/** @type {string[]} */
let hostAfterSubmitProbe = []

/** @type {string[]} */
let hostResetToSuggestProbe = []

const SYNC_ACTION_NAMES = new Set([
  'addDraftPick',
  'removeDraftPick',
  'clearAllDraftPicks',
  'reorderDraftPicks',
  'setReadyToVote',
  'setParticipants',
  'setUniqueSuggestedMovieCount',
  'setVotingMethod',
  'setVotingState',
  'submitMyVoteLocal',
  'markVoteSubmitted',
  'mergeGuestVote',
  'removeParticipantFromVote',
  'setElectionOutcome',
  'resetForRoomExit',
  'resetSessionSoft',
  'resetToSuggest',
])

const GUEST_DRAFT_DEBOUNCE_MS = 320

const GUEST_DRAFT_DEBOUNCE_ACTIONS = new Set([
  'addDraftPick',
  'removeDraftPick',
  'reorderDraftPicks',
  'clearAllDraftPicks',
  'setReadyToVote',
])

/** Host suggest-phase intents: compile-check + RTDB state (not host-derived participant rows). */
const HOST_SUGGEST_OUTBOUND_ACTIONS = new Set([
  'addDraftPick',
  'removeDraftPick',
  'clearAllDraftPicks',
  'reorderDraftPicks',
  'setReadyToVote',
])

let handlersBound = false

/** @type {ReturnType<typeof setTimeout> | undefined} */
let guestDraftTimer

/** @type {number} */
let guestDraftPushProbe = 0

/** @type {boolean} */
let guestDraftPushSuppress = false

/** @type {WeakSet<object>} */
const actionHookInstalled = new WeakSet()

/** @type {WeakSet<object>} */
const phaseSubscribeInstalled = new WeakSet()

/** @returns {import('./session.js').MovieVoteP2POutboundSync} */
function getOutboundSync() {
  if (!outboundSync) {
    throw new Error('movieVote P2P outbound sync not initialized')
  }
  return outboundSync
}

/** @returns {void} */
function cancelGuestDraftDebounce() {
  if (guestDraftTimer !== undefined) {
    globalThis.clearTimeout(guestDraftTimer)
    guestDraftTimer = undefined
  }
}

/** @returns {void} */
function pushGuestDraftPayload() {
  guestDraftPushProbe += 1
  if (!guestDraftPushSuppress) {
    getOutboundSync().guestPushDraft()
  }
}

/** @returns {void} */
function scheduleGuestDraftDebounce() {
  cancelGuestDraftDebounce()
  guestDraftTimer = globalThis.setTimeout(() => {
    guestDraftTimer = undefined
    pushGuestDraftPayload()
  }, GUEST_DRAFT_DEBOUNCE_MS)
}

/**
 * @param {ReturnType<typeof useMovieVoteStore>} store
 * @returns {boolean}
 */
function shouldGuestSyncDraft(store) {
  return (
    sessionPhase.value === 'guest_connected' &&
    store.phase === 'suggest' &&
    Boolean(store.myParticipantId)
  )
}

/** @returns {void} */
export function resetMovieVoteP2PSyncProbeForTests() {
  syncProbe = []
}

/** @returns {void} */
export function resetMovieVoteGuestDraftDebounceForTests() {
  cancelGuestDraftDebounce()
  guestDraftPushProbe = 0
  guestDraftPushSuppress = false
}

/** @param {boolean} suppress */
export function suppressGuestDraftPushForTests(suppress) {
  guestDraftPushSuppress = suppress
}

/** @returns {number} */
export function drainGuestDraftPushProbeForTests() {
  const n = guestDraftPushProbe
  guestDraftPushProbe = 0
  return n
}

/** @returns {string[]} */
export function drainMovieVoteP2PSyncProbeForTests() {
  const copy = [...syncProbe]
  syncProbe = []
  return copy
}

/** @returns {void} */
export function resetMovieVoteHostSuggestProbeForTests() {
  hostSuggestOutboundProbe = []
}

/** @returns {string[]} */
export function drainMovieVoteHostSuggestProbeForTests() {
  const copy = [...hostSuggestOutboundProbe]
  hostSuggestOutboundProbe = []
  return copy
}

/** @returns {void} */
export function resetMovieVoteGuestVoteWireForTests() {
  guestVoteWireProbe = []
}

/** @returns {{ participantId: string, ranking: string[] }[]} */
export function drainMovieVoteGuestVoteWireForTests() {
  const copy = [...guestVoteWireProbe]
  guestVoteWireProbe = []
  return copy
}

/** @returns {void} */
export function resetMovieVoteHostAfterSubmitProbeForTests() {
  hostAfterSubmitProbe = []
}

/** @returns {string[]} */
export function drainMovieVoteHostAfterSubmitProbeForTests() {
  const copy = [...hostAfterSubmitProbe]
  hostAfterSubmitProbe = []
  return copy
}

/** @returns {void} */
export function resetMovieVoteHostResetToSuggestProbeForTests() {
  hostResetToSuggestProbe = []
}

/** @returns {string[]} */
export function drainMovieVoteHostResetToSuggestProbeForTests() {
  const copy = [...hostResetToSuggestProbe]
  hostResetToSuggestProbe = []
  return copy
}

/**
 * @param {import('../types.js').MovieVotePublicPayload} payload
 * @returns {void}
 */
function applyInboundPublicPayload(payload) {
  const s = useMovieVoteStore()
  applyingRemote = true
  try {
    s.applyPublicPayload(payload)
  } finally {
    applyingRemote = false
  }
}

/**
 * Applies host/guest inbound public state the same way the P2P session handlers do (tests only).
 * @param {import('../types.js').MovieVotePublicPayload} payload
 * @returns {void}
 */
export function applyInboundMovieVotePayloadForTests(payload) {
  applyInboundPublicPayload(payload)
}

/**
 * Registers P2P public-payload handlers once and hooks `movieVote` store actions for future outbound sync.
 * @param {import('pinia').PiniaPluginContext} ctx
 * @returns {void}
 */
export function movieVoteP2PPlugin(ctx) {
  const { store } = ctx
  if (store.$id !== 'movieVote') return

  if (!handlersBound) {
    handlersBound = true
    outboundSync = bindMovieVoteP2PHandlers({
      applyPublicPayload: applyInboundPublicPayload,
      onWireTeardown: () => {
        cancelGuestDraftDebounce()
      },
    })
  }

  if (!phaseSubscribeInstalled.has(store)) {
    phaseSubscribeInstalled.add(store)
    store.$subscribe((_mutation, state) => {
      if (sessionPhase.value === 'guest_connected' && state.phase !== 'suggest') {
        cancelGuestDraftDebounce()
      }
    })
  }

  if (actionHookInstalled.has(store)) return
  actionHookInstalled.add(store)

  store.$onAction(({ name, after, args }) => {
    after(() => {
      if (applyingRemote) return

      const s = useMovieVoteStore()
      const wire = getOutboundSync()

      if (sessionPhase.value === 'guest_connected' && s.phase !== 'suggest') {
        cancelGuestDraftDebounce()
      }

      if (name === 'submitVote') {
        if (!s.myVoteSubmitted) return
        cancelGuestDraftDebounce()
        if (!isMovieVoteP2PSessionActive()) return
        const ranking = args[0]
        if (!Array.isArray(ranking)) return
        if (sessionPhase.value === 'guest_connected') {
          guestVoteWireProbe.push({
            participantId: s.myParticipantId ?? '',
            ranking: [...ranking],
          })
          wire.guestSubmitVote(ranking)
        } else if (sessionPhase.value === 'hosting') {
          hostAfterSubmitProbe.push('afterVoteSubmit')
          wire.hostAfterVoteSubmit()
        }
        return
      }

      if (!isMovieVoteP2PSessionActive()) return

      if (name === 'markVoteSubmitted') {
        cancelGuestDraftDebounce()
      }

      if (name === 'setMyParticipantId') {
        if (shouldGuestSyncDraft(s)) {
          cancelGuestDraftDebounce()
          pushGuestDraftPayload()
        }
        return
      }

      if (GUEST_DRAFT_DEBOUNCE_ACTIONS.has(name) && shouldGuestSyncDraft(s)) {
        scheduleGuestDraftDebounce()
      }

      if (!SYNC_ACTION_NAMES.has(name)) return

      if (sessionPhase.value === 'hosting') {
        if (name === 'resetToSuggest') {
          hostResetToSuggestProbe.push('resetToSuggest')
          wire.hostResetToSuggest()
          return
        }
        if (s.phase !== 'suggest') return
        syncProbe.push(name)
        if (name === 'setVotingMethod') {
          hostSuggestOutboundProbe.push('votingMethodChanged')
          wire.hostVotingMethodChanged()
        } else if (HOST_SUGGEST_OUTBOUND_ACTIONS.has(name)) {
          hostSuggestOutboundProbe.push('localChanged')
          wire.hostLocalChanged()
        }
        return
      }

      syncProbe.push(name)
    })
  })
}
