/**
 * @import './types.js'
 */

/**
 * Authoritative Game Timer snapshot slice for pure rule functions.
 *
 * @typedef {object} GameTimerRuleSession
 * @property {GameTimerPlayer[]} players
 * @property {string | null} activePlayerId
 * @property {number | null} turnStartedAt
 * @property {number | null} turnStartedRound
 * @property {number} round
 * @property {Record<string, string[]>} playerOrderByRound
 * @property {boolean} hardPassEnabled
 * @property {boolean} hardPassOrderNextRound
 * @property {Record<string, string[]>} hardPassOrderByRound
 * @property {number | null} totalGameStartedAt
 */

/**
 * @param {GameTimerPlayer} player
 * @returns {GameTimerPlayer}
 */
function clonePlayer(player) {
  return {
    ...player,
    bankedMsByRound:
      player.bankedMsByRound && typeof player.bankedMsByRound === 'object'
        ? { ...player.bankedMsByRound }
        : {},
  }
}

/**
 * @param {Record<string, string[]>} map
 * @returns {Record<string, string[]>}
 */
function cloneStringListMap(map) {
  const out = {}
  for (const k of Object.keys(map)) {
    const arr = map[k]
    out[k] = Array.isArray(arr) ? [...arr] : []
  }
  return out
}

/**
 * @param {GameTimerRuleSession} session
 * @returns {GameTimerRuleSession}
 */
export function cloneRuleSession(session) {
  return {
    ...session,
    players: session.players.map(clonePlayer),
    playerOrderByRound: cloneStringListMap(session.playerOrderByRound),
    hardPassOrderByRound: cloneStringListMap(session.hardPassOrderByRound),
  }
}

/**
 * Rebuild `players` to match `idOrder`, appending any players missing from that list.
 * @param {GameTimerPlayer[]} players
 * @param {string[]} idOrder
 * @returns {GameTimerPlayer[]}
 */
export function applyPlayerOrder(players, idOrder) {
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
export function stripPlayerFromHardPassMaps(hardPassOrderByRound, playerId) {
  for (const k of Object.keys(hardPassOrderByRound)) {
    const arr = hardPassOrderByRound[k]
    if (Array.isArray(arr)) {
      hardPassOrderByRound[k] = arr.filter((id) => id !== playerId)
    }
  }
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} nowMs
 */
function bankActiveSegment(session, nowMs) {
  if (session.activePlayerId == null || session.turnStartedAt == null) return
  const seg = Math.max(0, nowMs - session.turnStartedAt)
  const p = session.players.find((player) => player.id === session.activePlayerId)
  if (!p) return

  p.bankedMs += seg

  const r = session.turnStartedRound
  if (r != null) {
    if (!p.bankedMsByRound || typeof p.bankedMsByRound !== 'object') {
      p.bankedMsByRound = {}
    }
    const key = String(r)
    p.bankedMsByRound[key] = (p.bankedMsByRound[key] ?? 0) + seg
  }
}

/**
 * @param {GameTimerRuleSession} session
 */
function clearLiveTurn(session) {
  session.activePlayerId = null
  session.turnStartedAt = null
  session.turnStartedRound = null
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} nowMs
 */
function pauseLiveTurn(session, nowMs) {
  bankActiveSegment(session, nowMs)
  clearLiveTurn(session)
}

/**
 * @param {GameTimerRuleSession} session
 */
function saveOrderForRound(session) {
  session.playerOrderByRound[String(session.round)] = session.players.map((p) => p.id)
}

/**
 * @param {GameTimerRuleSession} session
 */
function applyOrderForActiveRound(session) {
  const k = String(session.round)
  let ids = session.playerOrderByRound[k]
  if (!Array.isArray(ids) || ids.length === 0) {
    ids = session.players.map((p) => p.id)
    session.playerOrderByRound[k] = [...ids]
  } else {
    const set = new Set(session.players.map((p) => p.id))
    ids = ids.filter((id) => set.has(id))
    for (const p of session.players) {
      if (!ids.includes(p.id)) ids.push(p.id)
    }
    session.playerOrderByRound[k] = ids
  }
  session.players = applyPlayerOrder(session.players, ids)
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} n
 */
function recomputeNextRoundOrderFromHardPasses(session, n) {
  if (!session.hardPassEnabled || !session.hardPassOrderNextRound) return
  if (session.players.length === 0) return
  const nk = String(Math.max(1, Math.floor(n)))
  const nextK = String(Math.max(1, Math.floor(n)) + 1)
  const raw = session.hardPassOrderByRound[nk]
  const passers = Array.isArray(raw)
    ? raw.filter((id) => session.players.some((p) => p.id === id))
    : []
  if (passers.length === 0) {
    session.playerOrderByRound[nextK] = session.players.map((p) => p.id)
    return
  }
  const passerSet = new Set(passers)
  const remaining = session.players.map((p) => p.id).filter((id) => !passerSet.has(id))
  session.playerOrderByRound[nextK] = [...passers, ...remaining]
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} fromIdx
 * @param {Set<string>} passed
 * @returns {number | null}
 */
function nextNonPassedPlayerIndex(session, fromIdx, passed) {
  const n = session.players.length
  if (n === 0) return null
  let nextIdx = (fromIdx + 1) % n
  for (let steps = 0; steps < n; steps++) {
    if (!passed.has(session.players[nextIdx].id)) return nextIdx
    nextIdx = (nextIdx + 1) % n
  }
  return null
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} nowMs
 * @returns {GameTimerRuleSession}
 */
export function pauseLiveTurnSnapshot(session, nowMs) {
  const next = cloneRuleSession(session)
  pauseLiveTurn(next, nowMs)
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {string} playerId
 * @param {number} nowMs
 * @returns {GameTimerRuleSession | null}
 */
export function selectPlayerSnapshot(session, playerId, nowMs) {
  if (!session.players.some((p) => p.id === playerId)) return null
  const next = cloneRuleSession(session)
  if (next.totalGameStartedAt == null) next.totalGameStartedAt = nowMs

  if (next.activePlayerId === playerId) {
    if (next.turnStartedAt != null) {
      bankActiveSegment(next, nowMs)
      next.turnStartedAt = null
      next.turnStartedRound = null
      return next
    }
    next.turnStartedAt = nowMs
    next.turnStartedRound = next.round
    return next
  }

  if (next.activePlayerId != null) {
    bankActiveSegment(next, nowMs)
  }
  next.activePlayerId = playerId
  next.turnStartedAt = nowMs
  next.turnStartedRound = next.round
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} nowMs
 * @returns {GameTimerRuleSession | null}
 */
export function endTurnNextSnapshot(session, nowMs) {
  if (session.players.length === 0 || session.activePlayerId == null) return null
  const next = cloneRuleSession(session)

  if (next.turnStartedAt != null) {
    bankActiveSegment(next, nowMs)
  }

  const idx = next.players.findIndex((p) => p.id === next.activePlayerId)
  if (idx === -1) {
    clearLiveTurn(next)
    return next
  }

  const passed = next.hardPassEnabled
    ? new Set(next.hardPassOrderByRound[String(next.round)] ?? [])
    : new Set()

  const nextIdx = nextNonPassedPlayerIndex(next, idx, passed)
  if (nextIdx == null) {
    clearLiveTurn(next)
    return next
  }
  const successor = next.players[nextIdx]
  next.activePlayerId = successor.id
  next.turnStartedAt = nowMs
  next.turnStartedRound = next.round
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {string} playerId
 * @param {number} nowMs
 * @returns {GameTimerRuleSession | null}
 */
export function registerHardPassSnapshot(session, playerId, nowMs) {
  if (!session.hardPassEnabled || !session.players.some((p) => p.id === playerId)) return null
  const next = cloneRuleSession(session)

  const rk = String(next.round)
  if (!next.hardPassOrderByRound[rk] || !Array.isArray(next.hardPassOrderByRound[rk])) {
    next.hardPassOrderByRound[rk] = []
  }
  if (next.hardPassOrderByRound[rk].includes(playerId)) return null

  const clockRunning = next.activePlayerId === playerId && next.turnStartedAt != null
  const turnHeldHere = next.activePlayerId === playerId

  if (clockRunning) {
    bankActiveSegment(next, nowMs)
  }

  next.hardPassOrderByRound[rk].push(playerId)
  recomputeNextRoundOrderFromHardPasses(next, next.round)

  if (turnHeldHere) {
    const passed = new Set(next.hardPassOrderByRound[rk] ?? [])
    const idx = next.players.findIndex((p) => p.id === playerId)
    const nextIdx = idx === -1 ? null : nextNonPassedPlayerIndex(next, idx, passed)
    if (nextIdx == null) {
      clearLiveTurn(next)
    } else {
      const successor = next.players[nextIdx]
      next.activePlayerId = successor.id
      next.turnStartedAt = nowMs
      next.turnStartedRound = next.round
    }
  }

  const list = next.hardPassOrderByRound[rk] ?? []
  const passedSet = new Set(list)
  const allHardPassed =
    next.players.length > 0 && next.players.every((p) => passedSet.has(p.id))
  if (allHardPassed) {
    return goToNextRoundSnapshot(next, nowMs)
  }
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {string} playerId
 * @returns {GameTimerRuleSession | null}
 */
export function undoHardPassSnapshot(session, playerId) {
  if (!session.hardPassEnabled || !session.players.some((p) => p.id === playerId)) return null
  const rk = String(session.round)
  const arr = session.hardPassOrderByRound[rk]
  if (!Array.isArray(arr) || !arr.includes(playerId)) return null
  const next = cloneRuleSession(session)
  next.hardPassOrderByRound[rk] = arr.filter((id) => id !== playerId)
  recomputeNextRoundOrderFromHardPasses(next, next.round)
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} nowMs
 * @returns {GameTimerRuleSession | null}
 */
export function goToNextRoundSnapshot(session, nowMs) {
  if (session.players.length === 0) return null
  const next = cloneRuleSession(session)
  saveOrderForRound(next)
  pauseLiveTurn(next, nowMs)
  next.round += 1
  applyOrderForActiveRound(next)
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} nowMs
 * @returns {GameTimerRuleSession | null}
 */
export function goToPreviousRoundSnapshot(session, nowMs) {
  if (session.players.length === 0 || session.round <= 1) return null
  const next = cloneRuleSession(session)
  saveOrderForRound(next)
  pauseLiveTurn(next, nowMs)
  next.round -= 1
  applyOrderForActiveRound(next)
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {number} nowMs
 * @returns {GameTimerRuleSession | null}
 */
export function startNewGameSamePlayersSnapshot(session, nowMs) {
  if (session.players.length === 0) return null
  const next = cloneRuleSession(session)
  pauseLiveTurn(next, nowMs)
  for (const p of next.players) {
    p.bankedMs = 0
    p.bankedMsByRound = {}
  }
  next.round = 1
  const order = next.players.map((p) => p.id)
  next.playerOrderByRound = { '1': [...order] }
  next.hardPassOrderByRound = {}
  next.totalGameStartedAt = null
  if (next.hardPassEnabled && next.hardPassOrderNextRound) {
    recomputeNextRoundOrderFromHardPasses(next, 1)
  }
  applyOrderForActiveRound(next)
  return next
}

/**
 * @param {GameTimerRuleSession} session
 * @param {string} playerId
 * @param {number} nowMs
 * @returns {GameTimerRuleSession | null}
 */
export function removePlayerSnapshot(session, playerId, nowMs) {
  const idx = session.players.findIndex((p) => p.id === playerId)
  if (idx === -1) return null
  const next = cloneRuleSession(session)

  const wasActive = next.activePlayerId === playerId
  if (wasActive) {
    bankActiveSegment(next, nowMs)
  }

  next.players.splice(idx, 1)

  if (wasActive) {
    clearLiveTurn(next)
  }

  for (const k of Object.keys(next.playerOrderByRound)) {
    const arr = next.playerOrderByRound[k]
    if (Array.isArray(arr)) {
      next.playerOrderByRound[k] = arr.filter((id) => id !== playerId)
    }
  }
  stripPlayerFromHardPassMaps(next.hardPassOrderByRound, playerId)
  if (next.hardPassEnabled && next.hardPassOrderNextRound && next.players.length > 0) {
    recomputeNextRoundOrderFromHardPasses(next, next.round)
  }
  return next
}

/**
 * Pick rule-relevant fields from Pinia store state for delegation.
 * @param {object} state
 * @returns {GameTimerRuleSession}
 */
export function ruleSessionFromStoreState(state) {
  return {
    players: state.players,
    activePlayerId: state.activePlayerId,
    turnStartedAt: state.turnStartedAt,
    turnStartedRound: state.turnStartedRound,
    round: state.round,
    playerOrderByRound: state.playerOrderByRound,
    hardPassEnabled: state.hardPassEnabled,
    hardPassOrderNextRound: state.hardPassOrderNextRound,
    hardPassOrderByRound: state.hardPassOrderByRound,
    totalGameStartedAt: state.totalGameStartedAt,
  }
}

/**
 * @param {GameTimerRuleSession} session
 * @returns {Partial<GameTimerRuleSession>}
 */
export function ruleSessionPatch(session) {
  return {
    players: session.players,
    activePlayerId: session.activePlayerId,
    turnStartedAt: session.turnStartedAt,
    turnStartedRound: session.turnStartedRound,
    round: session.round,
    playerOrderByRound: session.playerOrderByRound,
    hardPassOrderByRound: session.hardPassOrderByRound,
    totalGameStartedAt: session.totalGameStartedAt,
  }
}

/**
 * Apply authoritative rule output to Pinia store (full replace for map fields).
 * @param {object} store
 * @param {GameTimerRuleSession} session
 */
export function applyRuleSessionToStore(store, session) {
  store.players = session.players
  store.activePlayerId = session.activePlayerId
  store.turnStartedAt = session.turnStartedAt
  store.turnStartedRound = session.turnStartedRound
  store.round = session.round
  store.playerOrderByRound = session.playerOrderByRound
  store.hardPassOrderByRound = session.hardPassOrderByRound
  store.totalGameStartedAt = session.totalGameStartedAt
}
