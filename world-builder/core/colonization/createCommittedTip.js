/**
 * Immutable snapshot of colonization state at a tip epoch.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {object} [event]
 * @returns {object}
 */
export function createCommittedTip(slice, event) {
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
