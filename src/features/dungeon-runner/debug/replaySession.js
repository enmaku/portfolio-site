import { applyAction } from '../engine/kernel.js'
import { bootstrapMatchStateForReplay } from './replayBootstrap.js'

export function buildStateFromReplayEnvelope(replay) {
  let state = bootstrapMatchStateForReplay(replay.setup, replay.seed)
  for (const entry of replay.history ?? []) {
    const result = applyAction(state, entry.action, { seatId: entry.actorSeatId })
    if (!result.ok) {
      return { ok: false, errorCode: 'INVALID_REPLAY_ACTION' }
    }
    state = result.state
  }
  return { ok: true, state }
}
