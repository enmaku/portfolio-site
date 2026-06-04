import { pickDefaultModelId, validateSelectedModels } from '../models/discovery.js'
import { validateSetupConfig } from '../setup/config.js'
import { canStartMatchFromSetup, normalizeSetupState } from '../setup/state.js'

export const PLAY_SETUP_SHELL_TEST_IDS = {
  root: 'play-setup-shell',
  neuralLoadGateTerminal: 'neural-load-gate-terminal',
  neuralLoadGateTerminalDismiss: 'neural-load-gate-terminal-dismiss',
  startMatch: 'play-setup-start-match',
}

/**
 * @param {{ setup: { totalSeats: number, opponents: Array<{ type: string, modelId?: string }> }, modelOptions: Array<string | { value?: string }> }} inputs
 * @returns {{ ok: true } | { ok: false, errorCode: string }}
 */
export function evaluatePlaySetupStart({ setup, modelOptions }) {
  const normalized = normalizeSetupState(setup)
  const configResult = validateSetupConfig(normalized)
  if (!configResult.ok) {
    return { ok: false, errorCode: configResult.errorCode }
  }
  if (!canStartMatchFromSetup(setup)) {
    return { ok: false, errorCode: 'INVALID_SETUP' }
  }
  const modelResult = validateSelectedModels(setup.opponents, modelOptions)
  if (!modelResult.ok) {
    return { ok: false, errorCode: modelResult.errorCode }
  }
  return { ok: true }
}

/**
 * @param {{ opponents: Array<{ type: string, modelId?: string }> }} setup
 * @param {Array<string | { value?: string }>} modelOptions
 */
export function applyNnDefaultModelIds(setup, modelOptions) {
  const defaultModel = pickDefaultModelId(modelOptions)
  if (!defaultModel) return
  for (const opponent of setup.opponents ?? []) {
    if (opponent.type === 'nn' && !opponent.modelId) {
      opponent.modelId = defaultModel
    }
  }
}
