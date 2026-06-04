import { createMatchSeed } from './setup/seed.js'

/**
 * @param {Array<{ role?: { type?: string }, label?: string }>} seats
 * @returns {string[]}
 */
export function collectPreservedBotLabelsFromMatchState(seats) {
  return seats
    .filter((seat) => seat.role?.type !== 'human' && seat.label)
    .map((seat) => seat.label)
}

/**
 * Shared page flow: neural load gate → setup terminal or fresh match envelope → kick automation.
 *
 * @param {{
 *   setupSnapshot: object
 *   preservedBotLabels?: string[]
 *   presentationSpeedProfile: string
 *   clearPersistedMatch?: boolean
 *   storage?: Storage
 *   runMatchEntryGate: (setupSnapshot: object) => Promise<{ kind: 'success' } | { kind: 'setup-terminal' }>
 *   resetForSetupTerminal: () => void
 *   resetForFreshMatchEntry: () => void
 *   buildNewMatchEnvelope: (options: object) => object
 *   kickMatchAutomation: () => void
 *   setMatchNeuralLoadGateInFlight: (inFlight: boolean) => void
 *   clearCurrentMatch?: (storage: Storage) => void
 *   createMatchId?: () => string
 *   createSeed?: () => number
 * }} options
 * @returns {Promise<{ kind: 'setup-terminal' } | { kind: 'entered', match: object }>}
 */
export async function enterMatchFromSetupSnapshot(options) {
  const createMatchId = options.createMatchId ?? (() => `match-${Date.now()}`)
  const createSeed = options.createSeed ?? createMatchSeed

  options.setMatchNeuralLoadGateInFlight(true)
  try {
    const gateResult = await options.runMatchEntryGate(options.setupSnapshot)
    if (gateResult.kind === 'setup-terminal') {
      options.resetForSetupTerminal()
      return { kind: 'setup-terminal' }
    }

    if (options.clearPersistedMatch) {
      options.clearCurrentMatch?.(options.storage)
    }

    const envelopeOptions = {
      setupSnapshot: options.setupSnapshot,
      seed: createSeed(),
      id: createMatchId(),
      presentationSpeedProfile: options.presentationSpeedProfile,
    }
    if (options.preservedBotLabels?.length) {
      envelopeOptions.preservedBotLabels = options.preservedBotLabels
    }

    options.resetForFreshMatchEntry()
    const match = options.buildNewMatchEnvelope(envelopeOptions)
    return { kind: 'entered', match }
  } finally {
    options.setMatchNeuralLoadGateInFlight(false)
    options.kickMatchAutomation()
  }
}
