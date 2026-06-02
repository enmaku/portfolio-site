import { exportReplayEnvelope } from '../debug/replay.js'
import { MATCH_PHASES } from '../engine/kernel.js'
import { maybeCreateCompletedMatchOutcome } from './completedMatchOutcomeUpload.js'
import {
  dungeonRunnerCompletedMatchRef,
  isDungeonRunnerFirebaseConfigured,
  setRtdb,
} from './rtdb.js'

export const UPLOADED_MATCH_IDS_STORAGE_KEY = 'dungeonRunner:uploadedMatchIds'

/**
 * @typedef {object} CompletedMatchReplayUploadDeps
 * @property {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} storage
 * @property {Set<string>} uploadedIds
 * @property {() => boolean} [isConfigured]
 * @property {typeof exportReplayEnvelope} [exportEnvelope]
 * @property {(matchId: string, envelope: unknown) => Promise<void>} [setCompletedMatch]
 * @property {(match: import('../engine/kernel.js').Match, createdAt: string) => Promise<void>} [createOutcome]
 */

/**
 * @param {string} matchId
 * @param {CompletedMatchReplayUploadDeps['storage']} storage
 * @param {Set<string>} uploadedIds
 */
function isMatchIdAlreadyUploaded(matchId, storage, uploadedIds) {
  if (uploadedIds.has(matchId)) return true
  const raw = storage.getItem(UPLOADED_MATCH_IDS_STORAGE_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.includes(matchId)) return false
    uploadedIds.add(matchId)
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} matchId
 * @param {CompletedMatchReplayUploadDeps['storage']} storage
 * @param {Set<string>} uploadedIds
 */
function markMatchIdUploaded(matchId, storage, uploadedIds) {
  uploadedIds.add(matchId)
  const raw = storage.getItem(UPLOADED_MATCH_IDS_STORAGE_KEY)
  /** @type {string[]} */
  let ids = []
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) ids = parsed.filter((id) => typeof id === 'string')
    } catch {
      ids = []
    }
  }
  if (!ids.includes(matchId)) ids.push(matchId)
  storage.setItem(UPLOADED_MATCH_IDS_STORAGE_KEY, JSON.stringify(ids))
}

/**
 * Persists a v1 replay envelope at `dungeonRunnerCompletedMatches/{matchId}`.
 * @param {string} matchId
 * @param {unknown} envelope — [Replay envelope contract (v1)](../CONTRACT.md#replay-envelope-contract-v1)
 */
async function defaultSetCompletedMatch(matchId, envelope) {
  const matchRef = dungeonRunnerCompletedMatchRef(matchId)
  if (!matchRef) return
  await setRtdb(matchRef, envelope)
}

/**
 * @param {CompletedMatchReplayUploadDeps['storage']} storage
 */
export function createCompletedMatchReplayUploadTracker(storage) {
  const uploadedIds = new Set()
  return {
    maybeUpload(match) {
      maybeUploadCompletedMatchReplay(match, { storage, uploadedIds })
    },
  }
}

export function shouldUploadCompletedMatchReplayForPhase(phase) {
  return phase === MATCH_PHASES.MATCH_OVER
}

/**
 * On **match over**, builds payload via `exportReplayEnvelope` (integer `version: 1`)
 * per [Replay envelope contract (v1)](../CONTRACT.md#replay-envelope-contract-v1).
 * @param {import('../engine/kernel.js').Match | { id?: string, setup?: unknown, state?: { phase?: string, rng?: { seed?: number }, history?: unknown[] }, history?: unknown[], presentationSpeedProfile?: string } | null | undefined} match
 * @param {CompletedMatchReplayUploadDeps} deps
 */
export function maybeUploadCompletedMatchReplay(match, deps) {
  try {
    if (!match?.id || match.state?.phase !== MATCH_PHASES.MATCH_OVER) return

    const { storage, uploadedIds } = deps
    const matchId = match.id
    if (isMatchIdAlreadyUploaded(matchId, storage, uploadedIds)) return

    const isConfigured = deps.isConfigured ?? isDungeonRunnerFirebaseConfigured
    if (!isConfigured()) return

    const exportEnvelope = deps.exportEnvelope ?? exportReplayEnvelope
    const envelope = exportEnvelope({
      seed: match.state?.rng?.seed,
      setup: match.setup,
      history: match.state?.history,
      presentationSpeedProfile: match.presentationSpeedProfile,
    })

    markMatchIdUploaded(matchId, storage, uploadedIds)

    const createdAt = envelope.createdAt
    const setCompletedMatch = deps.setCompletedMatch ?? defaultSetCompletedMatch
    void setCompletedMatch(matchId, envelope).catch(() => {})

    const createOutcome =
      deps.createOutcome ??
      ((uploadMatch, uploadCreatedAt) =>
        maybeCreateCompletedMatchOutcome(uploadMatch, uploadCreatedAt, deps))
    void createOutcome(match, createdAt).catch(() => {})
  } catch {
    // Never throw to caller.
  }
}
