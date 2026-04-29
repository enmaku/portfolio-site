import { validateSetupConfig } from './config.js'

export function normalizeSetupState(input) {
  const rawTotalSeats = Number(input?.totalSeats ?? 2)
  const totalSeats = Math.min(4, Math.max(2, Number.isFinite(rawTotalSeats) ? rawTotalSeats : 2))
  const opponents = Array.isArray(input?.opponents) ? [...input.opponents] : []
  while (opponents.length < totalSeats - 1) {
    opponents.push({ type: 'randombot' })
  }
  while (opponents.length > totalSeats - 1) {
    opponents.pop()
  }
  return {
    totalSeats,
    opponents: opponents.map((opponent) => ({
      type: opponent.type === 'nn' ? 'nn' : 'randombot',
      ...(opponent.modelId ? { modelId: opponent.modelId } : {}),
    })),
  }
}

export function canStartMatchFromSetup(setup) {
  if (!Array.isArray(setup?.opponents) || setup.opponents.length === 0) return false
  return validateSetupConfig(normalizeSetupState(setup)).ok
}
