import assert from 'node:assert/strict'
import test from 'node:test'
import { applyClosedIslandRim } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import {
  createFlowFieldSession,
  deriveOceanMask,
  FLOW_RECOMPUTE_REASONS,
  FLOW_RECOMPUTE_STAGES,
  recomputeFullFlow,
} from './flowField.js'

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [value]
 */
function uniformRainfall(width, height, value = 0.5) {
  return new Float32Array(width * height).fill(value)
}

test('deriveOceanMask matches ocean from full flow accumulation', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(0.9)
  applyClosedIslandRim(elevation, width, height)
  for (let y = 8; y < 24; y += 1) {
    for (let x = 8; x < 24; x += 1) {
      elevation[y * width + x] = 0.3
    }
  }
  const rainfall = uniformRainfall(width, height)

  const fromMask = deriveOceanMask({ elevation, width, height })
  const { ocean: fromFlow } = computeFlowAccumulation({ elevation, width, height, rainfall })

  assert.deepStrictEqual(fromMask, fromFlow)
})

test('recomputeFullFlow matches computeFlowAccumulation and attaches stage metadata', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(0.85)
  applyClosedIslandRim(elevation, width, height)
  const rainfall = uniformRainfall(width, height)

  const baseline = computeFlowAccumulation({ elevation, width, height, rainfall })
  const solved = recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
    elevation,
    width,
    height,
    rainfall,
  })

  assert.deepStrictEqual(solved.flowDirection, baseline.flowDirection)
  assert.deepStrictEqual(solved.flowAccumulation, baseline.flowAccumulation)
  assert.deepStrictEqual(solved.ocean, baseline.ocean)
  assert.strictEqual(solved.reason, FLOW_RECOMPUTE_REASONS.hydrologyRoute)
  assert.strictEqual(solved.stage, FLOW_RECOMPUTE_STAGES.hydrologyRoute)
  assert.strictEqual(solved.cached, false)
})

test('createFlowFieldSession caches full flow when elevation is unchanged', () => {
  const width = 8
  const height = 8
  const elevation = new Float32Array(width * height).fill(0.85)
  applyClosedIslandRim(elevation, width, height)
  const rainfall = uniformRainfall(width, height)
  const session = createFlowFieldSession()

  const first = session.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
    elevation,
    width,
    height,
    rainfall,
  })
  const second = session.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
    elevation,
    width,
    height,
    rainfall,
  })

  assert.strictEqual(first.cached, false)
  assert.strictEqual(second.cached, true)
  assert.strictEqual(session.fullFlowSolveCount, 1)
  assert.deepStrictEqual(second.flowDirection, first.flowDirection)
  assert.deepStrictEqual(second.flowAccumulation, first.flowAccumulation)
})

test('createFlowFieldSession invalidates cache when elevation changes', () => {
  const width = 8
  const height = 8
  const elevationA = new Float32Array(width * height).fill(0.85)
  const elevationB = new Float32Array(width * height).fill(0.85)
  elevationB[10] = 0.2
  applyClosedIslandRim(elevationA, width, height)
  applyClosedIslandRim(elevationB, width, height)
  const rainfall = uniformRainfall(width, height)
  const session = createFlowFieldSession()

  session.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
    elevation: elevationA,
    width,
    height,
    rainfall,
  })
  session.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyExtract,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyExtract,
    elevation: elevationB,
    width,
    height,
    rainfall,
  })

  assert.strictEqual(session.fullFlowSolveCount, 2)
})

test('deriveOceanMask does not increment full flow solve count', () => {
  const width = 8
  const height = 8
  const elevation = new Float32Array(width * height).fill(0.85)
  applyClosedIslandRim(elevation, width, height)
  const session = createFlowFieldSession()

  session.deriveOceanMask({ elevation, width, height })
  session.deriveOceanMask({ elevation, width, height })

  assert.strictEqual(session.fullFlowSolveCount, 0)
})

test('FLOW_RECOMPUTE_REASONS pairs each hydrology stage with a stable reason id', () => {
  assert.strictEqual(FLOW_RECOMPUTE_REASONS.hydrologyRoute, 'route-filled-dem')
  assert.strictEqual(FLOW_RECOMPUTE_REASONS.hydrologyExtract, 'extract-post-incision')
  assert.strictEqual(FLOW_RECOMPUTE_REASONS.hydrologySettle, 'settle-post-lake-equilibrium')
})

test('createFlowFieldSession solveLog records reason and stage for each uncached recompute', () => {
  const width = 8
  const height = 8
  const elevationA = new Float32Array(width * height).fill(0.85)
  const elevationB = new Float32Array(width * height).fill(0.85)
  const elevationC = new Float32Array(width * height).fill(0.85)
  elevationB[10] = 0.2
  elevationC[20] = 0.15
  applyClosedIslandRim(elevationA, width, height)
  applyClosedIslandRim(elevationB, width, height)
  applyClosedIslandRim(elevationC, width, height)
  const rainfall = uniformRainfall(width, height)
  const session = createFlowFieldSession()

  session.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
    elevation: elevationA,
    width,
    height,
    rainfall,
  })
  session.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyExtract,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyExtract,
    elevation: elevationB,
    width,
    height,
    rainfall,
  })
  session.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologySettle,
    stage: FLOW_RECOMPUTE_STAGES.hydrologySettle,
    elevation: elevationC,
    width,
    height,
    rainfall,
  })

  assert.deepStrictEqual(
    session.solveLog.filter((entry) => !entry.cached),
    [
      {
        stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
        reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
        cached: false,
      },
      {
        stage: FLOW_RECOMPUTE_STAGES.hydrologyExtract,
        reason: FLOW_RECOMPUTE_REASONS.hydrologyExtract,
        cached: false,
      },
      {
        stage: FLOW_RECOMPUTE_STAGES.hydrologySettle,
        reason: FLOW_RECOMPUTE_REASONS.hydrologySettle,
        cached: false,
      },
    ],
  )
})
