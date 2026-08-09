/**
 * @param {import('./types.js').GenerationReport} report
 * @returns {import('./types.js').GenerationReport}
 */
export function cloneGenerationReport(report) {
  return {
    ...report,
    validationRows: report.validationRows.map((row) => ({ ...row })),
    rejectionReasons: [...report.rejectionReasons],
    structuredRejectionReasons: report.structuredRejectionReasons.map((row) => ({ ...row })),
    validationSignals: {
      hydrology: { ...report.validationSignals.hydrology },
      coast: { ...report.validationSignals.coast },
      climate: { ...report.validationSignals.climate },
      resources: { ...report.validationSignals.resources },
      landmassPlausibility: { ...report.validationSignals.landmassPlausibility },
      movement: { ...report.validationSignals.movement },
    },
    hydrologySubstepTimings: report.hydrologySubstepTimings.map((row) => ({ ...row })),
    hydrology: { ...report.hydrology },
  }
}
