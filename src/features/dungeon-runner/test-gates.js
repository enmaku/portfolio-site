export const TEST_GATE_THRESHOLDS = Object.freeze({
  determinismSeedCount: 24,
  minimumInvariantChecks: 6,
})

export const ACCEPTANCE_TEST_CONTRACT = Object.freeze({
  requiredBeforeImplementation: true,
  requiredSections: ['Behavior', 'Public Interface', 'Determinism Evidence'],
})

export function getDeterminismGateSeeds() {
  return Array.from({ length: TEST_GATE_THRESHOLDS.determinismSeedCount }, (_, index) => 10_000 + index * 37)
}
