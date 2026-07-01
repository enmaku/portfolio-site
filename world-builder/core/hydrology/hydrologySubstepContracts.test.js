import assert from 'node:assert/strict'
import test from 'node:test'
import { HYDROLOGY_SUBSTEP_CONTRACTS } from './hydrologySubstepContracts.js'
import {
  HYDROLOGY_SUBSTEP_MODULES,
  selectHydrologySubstepInput,
} from './substeps/index.js'
import { riverMaskContractKey } from './riverMaskLifecycle.js'
import { createInitialHydrologyWorld } from './hydrologyWorldTypes.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 32,
  height: 32,
}

test('substep contracts are derived from the substep modules as a single source of truth', () => {
  for (const module of HYDROLOGY_SUBSTEP_MODULES) {
    const contract = HYDROLOGY_SUBSTEP_CONTRACTS[module.id]
    assert.ok(contract, `missing contract for ${module.id}`)
    assert.strictEqual(contract.id, module.id)
    assert.strictEqual(contract.label, module.label)
    assert.deepStrictEqual(contract.inputKeys, Object.keys(module.inputs))
    assert.deepStrictEqual(contract.outputKeys, [...module.outputKeys])
  }
})

test('selectHydrologySubstepInput yields exactly the contract input keys', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  const world = createInitialHydrologyWorld(state)

  for (const module of HYDROLOGY_SUBSTEP_MODULES) {
    const input = selectHydrologySubstepInput(module, world)
    assert.deepStrictEqual(
      Object.keys(input).sort(),
      [...HYDROLOGY_SUBSTEP_CONTRACTS[module.id].inputKeys].sort(),
    )
  }
})

test('river mask lifecycle stages are produced across the substep contracts in order', () => {
  assert.ok(
    HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyRoute.outputKeys.includes(riverMaskContractKey('sketch')),
  )
  assert.ok(
    HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyIncise.outputKeys.includes(riverMaskContractKey('incised')),
  )
  assert.ok(
    HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyExtract.outputKeys.includes(
      riverMaskContractKey('settled'),
    ),
  )
  assert.ok(
    HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyRefine.outputKeys.includes(
      riverMaskContractKey('presentation'),
    ),
  )
  assert.ok(
    HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyPaint.outputKeys.includes(riverMaskContractKey('painted')),
  )
})

test('hydrology contracts omit orphaned waterway navigability fields', () => {
  const incise = HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyIncise
  const extract = HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyExtract

  assert.ok(!incise.outputKeys.includes('incisedRiverNetworkMask'))
  assert.ok(!extract.outputKeys.includes('coastNavigability'))
  assert.ok(!extract.inputKeys.includes('coastNavigability'))
})
