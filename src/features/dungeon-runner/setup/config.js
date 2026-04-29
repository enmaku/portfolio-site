const ROLE_MARKERS = {
  human: { symbol: 'H', color: 'primary' },
  nn: { symbol: 'N', color: 'deep-purple' },
  randombot: { symbol: 'R', color: 'teal' },
}

export function createDefaultSetupConfig() {
  return {
    totalSeats: 2,
    opponents: [{ type: 'randombot' }],
  }
}

export function validateSetupConfig(setup) {
  if (!Number.isInteger(setup.totalSeats) || setup.totalSeats < 2 || setup.totalSeats > 4) {
    return { ok: false, errorCode: 'INVALID_TABLE_SIZE' }
  }
  if (!Array.isArray(setup.opponents) || setup.opponents.length !== setup.totalSeats - 1) {
    return { ok: false, errorCode: 'INVALID_OPPONENT_COUNT' }
  }
  if (setup.opponents.length === 0) {
    return { ok: false, errorCode: 'NO_OPPONENTS' }
  }
  for (const opponent of setup.opponents) {
    if (opponent.type !== 'nn' && opponent.type !== 'randombot') {
      return { ok: false, errorCode: 'INVALID_OPPONENT_TYPE' }
    }
  }
  return { ok: true }
}

export function randomizeSeatsFromSetup(setup, options) {
  const validation = validateSetupConfig(setup)
  if (!validation.ok) {
    throw new Error(validation.errorCode)
  }
  const seed = Number(options?.seed ?? 0) >>> 0
  const rolePool = [{ type: 'human' }, ...setup.opponents.map((opponent) => ({ ...opponent }))]
  const seats = shuffle(rolePool, seed).map((role, index) => ({
    id: `seat-${index + 1}`,
    label: `Player ${index + 1}`,
    role,
    roleMarker: ROLE_MARKERS[role.type],
  }))
  return { seats }
}

function shuffle(values, seed) {
  const out = [...values]
  let state = seed || 1
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = next(state)
    const j = Math.floor((state / 0x100000000) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function next(state) {
  let x = state >>> 0
  x ^= (x << 13) >>> 0
  x ^= x >>> 17
  x ^= (x << 5) >>> 0
  return x >>> 0
}
