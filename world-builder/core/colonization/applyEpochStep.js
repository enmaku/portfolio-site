import { applyColonizationEpoch } from './applyColonizationEpoch.js'

/**
 * Advance epochBatch annual ticks. Retains committed tips at post-step present day
 * and history-log event years (abandonment). Quiet intra-batch years are omitted.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{ saltSpoilageMultiplierForSettlement?: Function }} [options]
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function applyEpochStep(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return slice
  }

  const batch = Math.max(1, Math.floor(slice.colonistSettings.epochBatch || 1))
  let current = slice
  /** @type {object[]} */
  const eventTips = []

  for (let i = 0; i < batch; i += 1) {
    const { slice: next, events } = applyColonizationEpoch(current, worldDocument, options)
    current = next
    for (const event of events) {
      if (event?.retainTip) {
        eventTips.push(createCommittedTip(current, event))
      }
    }
  }

  const presentDayTip = createCommittedTip(current)
  const committedTips = [...current.committedTips, ...eventTips, presentDayTip]

  return {
    ...current,
    committedTips,
  }
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {object} [event]
 */
function createCommittedTip(slice, event) {
  const claimMap = event?.claimMap
    ? Object.fromEntries(
        Object.entries(event.claimMap).map(([settlementId, cells]) => [
          settlementId,
          cells.map((cell) => ({ x: cell.x, y: cell.y })),
        ]),
      )
    : Object.fromEntries(
        Object.entries(slice.primaryClaim).map(([settlementId, cells]) => [
          settlementId,
          cells.map((cell) => ({ x: cell.x, y: cell.y })),
        ]),
      )

  return {
    epoch: slice.epoch,
    settlements: slice.settlements.map((row) => ({ ...row })),
    foundingLanding: slice.foundingLanding ? { ...slice.foundingLanding } : null,
    colonistSettings: { ...slice.colonistSettings },
    historyLog: slice.historyLog.map((row) => ({ ...row })),
    claimMap,
    ...(event?.kind ? { eventKind: event.kind } : {}),
  }
}
