/**
 * Download filename for a campaign kit PDF snapshot.
 */

/**
 * @param {{ geographySeed: unknown, epoch: unknown }} params
 * @returns {string}
 */
export function campaignKitFilename({ geographySeed, epoch }) {
  const seed =
    typeof geographySeed === 'number' && Number.isFinite(geographySeed)
      ? String(Math.trunc(geographySeed))
      : typeof geographySeed === 'string' && geographySeed.length > 0
        ? geographySeed
        : 'unknown'
  const epochValue =
    typeof epoch === 'number' && Number.isFinite(epoch) ? Math.trunc(epoch) : 0
  return `campaign-kit-seed-${seed}-epoch-${epochValue}.pdf`
}
