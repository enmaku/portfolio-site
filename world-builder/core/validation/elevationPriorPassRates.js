import { generateDerivedGeography } from '../generateDerivedGeography.js'

/** Fixed seeds used to compare pre-priors vs river-friendly elevation defaults. */
export const ELEVATION_PRIOR_VALIDATION_SEED_BATCH = Array.from({ length: 50 }, (_, index) => index + 1)

/**
 * @param {ReadonlyArray<number>} seeds
 * @param {{ width: number, height: number, prevailingWindDegrees: number }} gridParams
 * @param {import('../types.js').WorldGenerationOptions} options
 * @returns {{
 *   navigableRiverPassCount: number,
 *   coastMouthPassCount: number,
 *   compositePassScore: number,
 *   seedCount: number,
 * }}
 */
export function countRiverValidationPasses(seeds, gridParams, options) {
  let navigableRiverPassCount = 0
  let coastMouthPassCount = 0

  for (const geographySeed of seeds) {
    const doc = generateDerivedGeography({
      ...gridParams,
      geographySeed,
      options,
    })
    const rows = doc.generationReport.validationRows
    const navigablePass =
      rows.find((row) => row.checkId === 'navigableRiverQuota')?.status === 'pass'
    const coastPass = rows.find((row) => row.checkId === 'coastMouth')?.status === 'pass'
    if (navigablePass) navigableRiverPassCount += 1
    if (coastPass) coastMouthPassCount += 1
  }

  return {
    navigableRiverPassCount,
    coastMouthPassCount,
    compositePassScore: navigableRiverPassCount + coastMouthPassCount,
    seedCount: seeds.length,
  }
}
