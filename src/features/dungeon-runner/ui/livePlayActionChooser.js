import { chooseRandombotAction } from '../bots/randombot.js'
import { createChooseNnActionWithRecovery } from '../nn/chooseWithRecovery.js'
import { chooseNnAction } from '../nn/runtime.js'
import { isNnAdventurerPickEnabled } from '../setup/nnAdventurerPick.js'
import { MATCH_PHASES } from '../engine/kernel.js'

/**
 * Mirrors live AI turn chooser semantics (Randombot, NN with recovery coordinator, adventurer pick flag).
 * @param {{
 *   nnRecovery: {
 *     isRecovering: (modelId: string) => boolean
 *     getTerminalOutcome: (modelId: string) => string
 *   }
 *   ensureNnModelsReady?: () => Promise<void>
 *   nnRuntimeOptions: (modelId: string) => object
 *   isNnAdventurerPickEnabled?: () => boolean
 *   chooseNnActionWithRecovery?: ReturnType<typeof createChooseNnActionWithRecovery>
 *   tryConsumePrefetch?: (ctx: { state: object, seatId: string, runToken?: string, modelId: string }) => Promise<{ type: string } | null> | { type: string } | null
 *   onRecoveryBegin?: (modelId: string) => void
 * }} deps
 */
export function createLivePlayActionChooser(deps) {
  const adventurerPickEnabled = deps.isNnAdventurerPickEnabled ?? isNnAdventurerPickEnabled
  const chooseNnWithRecovery = deps.chooseNnActionWithRecovery ?? createChooseNnActionWithRecovery({
    recovery: deps.nnRecovery,
    chooseNnAction,
    onRecoveryBegin: deps.onRecoveryBegin,
  })
  return async function chooseAction({ state, seatId, runToken }) {
    const seat = state.seats.find((candidate) => candidate.id === seatId)
    const roleType = seat?.role?.type
    if (roleType === 'nn') {
      const modelId = seat.role.modelId ?? 'latest'
      if (state.phase === MATCH_PHASES.PICK_ADVENTURER && !adventurerPickEnabled()) {
        return chooseRandombotAction(state, { seatId })
      }
      await deps.ensureNnModelsReady?.()
      let action = null
      if (!deps.nnRecovery.isRecovering(modelId) && deps.tryConsumePrefetch) {
        action = await deps.tryConsumePrefetch({ state, seatId, runToken, modelId })
      }
      if (!action) {
        action = await chooseNnWithRecovery(state, { seatId }, deps.nnRuntimeOptions(modelId))
      }
      return action
    }
    return chooseRandombotAction(state, { seatId })
  }
}
