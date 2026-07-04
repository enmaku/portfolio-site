/**
 * Convert zero-population living settlements to ruins and release their claims.
 *
 * @param {{
 *   settlements: object[],
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 *   historyLog: object[],
 *   epoch: number,
 * }} state
 * @returns {{
 *   settlements: object[],
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 *   historyLog: object[],
 *   events: object[],
 * }}
 */
export function applyRuinTransitions(state) {
  const primaryClaim = { ...state.primaryClaim }
  /** @type {object[]} */
  const events = []
  /** @type {object[]} */
  const historyLog = [...state.historyLog]
  /** @type {object[]} */
  const settlements = []

  for (const settlement of state.settlements) {
    if (settlement.status === 'ruin') {
      settlements.push({ ...settlement })
      continue
    }

    if (settlement.population > 0) {
      settlements.push({ ...settlement })
      continue
    }

    const claimSnapshot = (primaryClaim[settlement.id] ?? []).map((cell) => ({
      x: cell.x,
      y: cell.y,
    }))
    delete primaryClaim[settlement.id]

    const abandoned = {
      ...settlement,
      population: 0,
      tier: null,
      status: 'ruin',
    }
    settlements.push(abandoned)

    const historyEntry = {
      kind: 'settlement_abandoned',
      epoch: state.epoch,
      settlementId: settlement.id,
    }
    historyLog.push(historyEntry)
    events.push({
      kind: 'settlement_abandoned',
      retainTip: true,
      settlementId: settlement.id,
      claimMap: { [settlement.id]: claimSnapshot },
      historyEntry,
    })
  }

  return { settlements, primaryClaim, historyLog, events }
}
