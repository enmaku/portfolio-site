import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGenerationReport } from './buildGenerationReport.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'

function makeReportParams(overrides = {}) {
  return {
    erosionStepCount: 24,
    riverGraph: {
      nodes: [
        { id: 'a', x: 1, y: 1, kind: 'source' },
        { id: 'b', x: 1, y: 2, kind: 'mouth' },
      ],
      edges: [
        { fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [5, 9] },
      ],
    },
    coastalNodes: [{ id: 'c1', x: 1, y: 2, kind: 'mouth' }],
    fields: {
      elevation: new Float32Array(16).fill(0.5),
      temperature: new Float32Array(16).fill(0.5),
      rainfall: new Float32Array(16).fill(0.5),
      drainage: new Float32Array(16).fill(0.5),
      salidity: new Float32Array(16).fill(0.1),
    },
    biomes: new Uint8Array(16).fill(1),
    gridWidth: 4,
    gridHeight: 4,
    hydrologySubstepTimings: [{ substepId: 'hydrologyFill', label: 'Fill lakes', durationMs: 1.2 }],
    hydrologyStats: {
      breachCount: 2,
      endorheicCount: 1,
      lakeCount: 4,
    },
    validationOptions: undefined,
    ...overrides,
  }
}

test('buildGenerationReport includes hydrology breach and endorheic stats', () => {
  const report = buildGenerationReport(makeReportParams())

  assert.strictEqual(report.hydrology.breachCount, 2)
  assert.strictEqual(report.hydrology.endorheicCount, 1)
  assert.strictEqual(report.hydrology.endorheicFraction, 0.25)
})

test('buildGenerationReport lists hydrology validation metrics', () => {
  const report = buildGenerationReport(makeReportParams())

  assert.strictEqual(typeof report.hydrology.riverCellCount, 'number')
  assert.strictEqual(typeof report.hydrology.navigableEdgeCount, 'number')
  assert.strictEqual(typeof report.hydrology.navigableKmEstimate, 'number')
  assert.strictEqual(typeof report.hydrology.mouthCount, 'number')
  assert.ok('hacksLawExponent' in report.hydrology)
  assert.ok(Array.isArray(report.hydrology.slopeAreaConcavitySamples))
  assert.strictEqual(typeof report.hydrology.parallelStrandRatio, 'number')
  assert.strictEqual(typeof report.hydrology.coastConnectedNavigablePathLength, 'number')
  assert.strictEqual(report.hydrologySubstepTimings.length, 1)
})

test('buildGenerationReport includes hydrology validation rows', () => {
  const report = buildGenerationReport(makeReportParams())
  const ids = report.validationRows.map((row) => row.checkId)
  assert.ok(ids.includes('hacksLawExponent'))
  assert.ok(ids.includes('parallelStrandRatio'))
  assert.ok(ids.includes('endorheicFractionCap'))
  assert.strictEqual(report.shouldReject, false)
  assert.deepStrictEqual(report.rejectionReasons, [])
})

test('buildGenerationReport surfaces rejection reasons for enforced failures', () => {
  const report = buildGenerationReport(
    makeReportParams({
      coastalNodes: [],
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceCoastMouth: true,
      },
    }),
  )
  assert.strictEqual(report.shouldReject, true)
  assert.ok(report.rejectionReasons.some((reason) => reason.startsWith('coastMouth:')))
})

test('buildGenerationReport passes precomputed hydrology metrics into validation', () => {
  const report = buildGenerationReport(
    makeReportParams({
      riverGraph: { nodes: [], edges: [] },
      validationOptions: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enforceHacksLawExponent: true,
      },
    }),
  )
  const hacksRow = report.validationRows.find((row) => row.checkId === 'hacksLawExponent')
  assert.strictEqual(hacksRow?.status, 'fail')
  assert.strictEqual(report.hydrology.hacksLawExponent, null)
})
