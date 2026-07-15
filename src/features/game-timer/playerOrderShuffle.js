export const PLAYER_ORDER_SHUFFLE_DURATION_MS = 3000

const VISUAL_SWAP_COUNT = 18
const UINT32_RANGE = 0x1_0000_0000

/**
 * @param {Pick<GameTimerSyncPayload, 'players' | 'activePlayerId' | 'turnStartedAt' | 'turnStartedRound' | 'totalGameStartedAt' | 'round'>} snapshot
 * @returns {boolean}
 */
export function canShufflePlayerOrder(snapshot) {
  if (!Array.isArray(snapshot.players) || snapshot.players.length < 2) return false
  if (snapshot.round !== 1) return false
  if (
    snapshot.activePlayerId != null ||
    snapshot.turnStartedAt != null ||
    snapshot.turnStartedRound != null ||
    snapshot.totalGameStartedAt != null
  ) {
    return false
  }
  return snapshot.players.every((player) => {
    if (typeof player.bankedMs === 'number' && player.bankedMs > 0) return false
    const byRound = player.bankedMsByRound
    if (!byRound || typeof byRound !== 'object') return true
    return Object.values(byRound).every((value) => typeof value !== 'number' || value <= 0)
  })
}

/**
 * @param {number} seed
 * @returns {() => number}
 */
function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
  }
}

/**
 * @param {string[]} playerIds
 * @param {number} seed
 * @returns {{ orders: string[][], targetOrder: string[] }}
 */
export function createPlayerOrderShuffle(playerIds, seed) {
  const random = createSeededRandom(seed)
  const targetOrder = [...playerIds]
  for (let index = targetOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[targetOrder[index], targetOrder[swapIndex]] = [targetOrder[swapIndex], targetOrder[index]]
  }

  const currentOrder = [...playerIds]
  const orders = []
  for (let step = 0; step < VISUAL_SWAP_COUNT; step += 1) {
    const firstIndex = Math.floor(random() * currentOrder.length)
    let secondIndex = Math.floor(random() * (currentOrder.length - 1))
    if (secondIndex >= firstIndex) secondIndex += 1
    ;[currentOrder[firstIndex], currentOrder[secondIndex]] = [
      currentOrder[secondIndex],
      currentOrder[firstIndex],
    ]
    orders.push([...currentOrder])
  }

  for (let index = 0; index < targetOrder.length; index += 1) {
    if (currentOrder[index] === targetOrder[index]) continue
    const swapIndex = currentOrder.indexOf(targetOrder[index], index + 1)
    ;[currentOrder[index], currentOrder[swapIndex]] = [currentOrder[swapIndex], currentOrder[index]]
    orders.push([...currentOrder])
  }

  return { orders, targetOrder }
}

export function createPlayerOrderShuffleSeed() {
  const values = new Uint32Array(1)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values)
    return values[0]
  }
  return Math.floor(Math.random() * UINT32_RANGE)
}
