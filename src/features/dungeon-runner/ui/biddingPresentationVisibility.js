/**
 * Presentation-only visibility rules for bidding motion (engine truth stays in kernel views).
 */

/**
 * After a draw lands, may this viewer see a face-up flip for the drawn species?
 * Null/empty viewer (replay / no seat) => false.
 *
 * @param {{ viewerSeatId?: string|null, actorSeatId?: string|null }} args
 * @returns {boolean}
 */
export function viewerMaySeeBiddingDrawFace({ viewerSeatId, actorSeatId }) {
  if (viewerSeatId == null || viewerSeatId === '') return false
  if (actorSeatId == null || actorSeatId === '') return false
  return viewerSeatId === actorSeatId
}

/**
 * Before add-to-dungeon flight, may this viewer see a privileged flip-to-back?
 * Bots skip the flip in motion; only human actors who can see their own card need it.
 *
 * @param {{ viewerSeatId?: string|null, actorSeatId?: string|null, actorRoleType?: string|null }} args
 * @returns {boolean}
 */
export function viewerMaySeeAddToDungeonFlipDown({ viewerSeatId, actorSeatId, actorRoleType }) {
  if (actorRoleType !== 'human') return false
  return viewerMaySeeBiddingDrawFace({ viewerSeatId, actorSeatId })
}
