import assert from 'node:assert/strict'
import test from 'node:test'
import {
  runFullDerivedGeographyPipeline,
  runLandmassPipeline,
  runLandmassPipelineRun,
  shouldAttachLandmassStepPreview,
  cloneWorldDocument,
} from './derivedGeographyPipeline.js'
import { HYDROLOGY_SUBSTEP_CONTRACTS } from './hydrology/hydrologySubstepContracts.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 32,
  height: 32,
}

const forceValidationRejectionParams = {
  geographySeed: 999999,
  prevailingWindDegrees: 270,
  width: 16,
  height: 16,
  options: {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enforceCoastConnectedNavigablePath: true,
    minCoastConnectedNavigablePathCells: 99_999,
    maxValidationRetries: 0,
  },
}

test('shouldAttachLandmassStepPreview is false for intermediate steps by default', () => {
  assert.strictEqual(shouldAttachLandmassStepPreview('physicalTerrainBaseline', DEFAULT_WORLD_GENERATION_OPTIONS), false)
  assert.strictEqual(shouldAttachLandmassStepPreview('erosion', DEFAULT_WORLD_GENERATION_OPTIONS), false)
  assert.strictEqual(shouldAttachLandmassStepPreview('hydrology', DEFAULT_WORLD_GENERATION_OPTIONS), false)
  assert.strictEqual(shouldAttachLandmassStepPreview('validation', DEFAULT_WORLD_GENERATION_OPTIONS), true)
})

test('shouldAttachLandmassStepPreview honors enableIntermediateStepPreviews', () => {
  const options = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableIntermediateStepPreviews: true,
  }
  assert.strictEqual(shouldAttachLandmassStepPreview('erosion', options), true)
})

test('runLandmassPipeline completes with success status and world document', async () => {
  const result = await runLandmassPipeline(params)

  assert.strictEqual(result.status, 'success')
  assert.ok(result.worldDocument)
  assert.strictEqual(result.worldDocument.gridWidth, params.width)
  assert.ok(result.worldDocument.generationReport)
})

test('runLandmassPipeline matches runFullDerivedGeographyPipeline output', async () => {
  const fromRunner = await runLandmassPipeline(params)
  const fromSync = runFullDerivedGeographyPipeline(params)

  assert.strictEqual(fromRunner.status, 'success')
  assert.deepStrictEqual(fromRunner.worldDocument?.biomes, fromSync.biomes)
  assert.deepStrictEqual(fromRunner.worldDocument?.fields.elevation, fromSync.fields.elevation)
  assert.strictEqual(
    fromRunner.worldDocument?.geographySeed,
    fromSync.geographySeed,
  )
})

test('runLandmassPipeline omits world document on intermediate step-complete by default', async () => {
  /** @type {{ stepId: string, hasDoc: boolean }[]} */
  const completions = []
  const result = await runLandmassPipeline(params, {
    onStepComplete({ stepId, worldDocument }) {
      completions.push({ stepId, hasDoc: Boolean(worldDocument) })
    },
  })

  assert.strictEqual(result.status, 'success')
  assert.strictEqual(completions.length, 6)
  assert.deepStrictEqual(
    completions.map((row) => row.hasDoc),
    [false, false, false, false, false, true],
  )
})

test('runLandmassPipeline includes previews on every step when enabled', async () => {
  /** @type {boolean[]} */
  const hasDoc = []
  await runLandmassPipeline(
    {
      ...params,
      options: {
        ...DEFAULT_WORLD_GENERATION_OPTIONS,
        enableIntermediateStepPreviews: true,
      },
    },
    {
      onStepComplete({ worldDocument }) {
        hasDoc.push(Boolean(worldDocument))
      },
    },
  )

  assert.deepStrictEqual(hasDoc, [true, true, true, true, true, true])
})

test('runLandmassPipeline returns cancelled when shouldCancel is true before start', async () => {
  const result = await runLandmassPipeline(params, {
    shouldCancel() {
      return true
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
})

test('runLandmassPipeline returns cancelled when shouldCancel fires mid-pipeline', async () => {
  let stepStarts = 0
  const result = await runLandmassPipeline(params, {
    onStepStart() {
      stepStarts += 1
    },
    shouldCancel() {
      return stepStarts >= 2
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.ok(result.state)
  assert.strictEqual(result.state?.lastCompletedStep, 'erosion')
})

test('runLandmassPipeline returns error status when a callback throws', async () => {
  const result = await runLandmassPipeline(params, {
    onStepStart() {
      throw new Error('pipeline callback failed')
    },
  })

  assert.strictEqual(result.status, 'error')
  assert.match(result.errorMessage ?? '', /pipeline callback failed/)
})

test('runLandmassPipeline distinguishes success, exhausted, cancelled, and error terminal statuses', async () => {
  const [success, exhausted, cancelled, error] = await Promise.all([
    runLandmassPipeline(params),
    runLandmassPipeline(forceValidationRejectionParams),
    runLandmassPipeline(params, {
      shouldCancel: () => true,
      onStepStart() {},
    }),
    runLandmassPipeline(params, {
      onStepStart() {
        throw new Error('pipeline callback failed')
      },
    }),
  ])

  assert.strictEqual(success.status, 'success')
  assert.strictEqual(exhausted.status, 'exhausted')
  assert.strictEqual(exhausted.worldDocument?.generationReport?.shouldReject, true)
  assert.strictEqual(cancelled.status, 'cancelled')
  assert.strictEqual(error.status, 'error')
  assert.strictEqual(new Set([success.status, exhausted.status, cancelled.status, error.status]).size, 4)
})

test('runLandmassPipelineRun distinguishes success, exhausted, cancelled, and error terminal statuses', () => {
  let cancelAfterStart = false
  const success = runLandmassPipelineRun(params)
  const exhausted = runLandmassPipelineRun(forceValidationRejectionParams)
  const cancelled = runLandmassPipelineRun(params, {
    onStepStart() {
      cancelAfterStart = true
    },
    shouldCancel: () => cancelAfterStart,
  })
  const error = runLandmassPipelineRun(params, {
    onStepStart() {
      throw new Error('sync pipeline callback failed')
    },
  })

  assert.strictEqual(success.status, 'success')
  assert.strictEqual(exhausted.status, 'exhausted')
  assert.strictEqual(exhausted.worldDocument?.generationReport?.shouldReject, true)
  assert.strictEqual(cancelled.status, 'cancelled')
  assert.strictEqual(error.status, 'error')
  assert.strictEqual(new Set([success.status, exhausted.status, cancelled.status, error.status]).size, 4)
})

test('runLandmassPipeline returns exhausted when validation retries are exhausted', async () => {
  const result = await runLandmassPipeline(forceValidationRejectionParams)

  assert.strictEqual(result.status, 'exhausted')
  assert.ok(result.worldDocument)
  assert.strictEqual(result.worldDocument.generationReport?.shouldReject, true)
  assert.notStrictEqual(result.worldDocument.fields.elevation, null)
})

test('runLandmassPipeline exhausted fixture pins structured coast path rejection', async () => {
  const result = await runLandmassPipeline(forceValidationRejectionParams)

  assert.strictEqual(result.status, 'exhausted')
  assert.strictEqual(result.worldDocument?.geographySeed, forceValidationRejectionParams.geographySeed)
  assert.strictEqual(result.worldDocument?.generationReport?.shouldReject, true)
  assert.strictEqual(result.worldDocument?.generationReport?.rejectionSamplingEnforced, true)
  assert.deepStrictEqual(result.worldDocument?.generationReport?.structuredRejectionReasons, [
    { checkId: 'coastConnectedNavigablePath', category: 'coast' },
  ])
  const failIds = (result.worldDocument?.generationReport?.validationRows ?? [])
    .filter((row) => row.status === 'fail')
    .map((row) => row.checkId)
  assert.deepStrictEqual(failIds, ['coastConnectedNavigablePath'])
  const failingRows = (result.worldDocument?.generationReport?.validationRows ?? []).filter(
    (row) => row.status === 'fail',
  )
  for (const row of failingRows) {
    assert.ok(row.mapFocus)
    assert.equal(typeof row.mapFocus.x, 'number')
    assert.equal(typeof row.mapFocus.y, 'number')
    assert.equal(typeof row.mapFocus.zoom, 'number')
  }
})

test('runLandmassPipelineRun exhausted fixture pins structured coast path rejection', () => {
  const result = runLandmassPipelineRun(forceValidationRejectionParams)

  assert.strictEqual(result.status, 'exhausted')
  assert.strictEqual(result.worldDocument?.geographySeed, forceValidationRejectionParams.geographySeed)
  assert.strictEqual(result.worldDocument?.generationReport?.shouldReject, true)
  assert.strictEqual(result.worldDocument?.generationReport?.rejectionSamplingEnforced, true)
  assert.deepStrictEqual(result.worldDocument?.generationReport?.structuredRejectionReasons, [
    { checkId: 'coastConnectedNavigablePath', category: 'coast' },
  ])
})

test('runLandmassPipeline exhausted world document is cloneable for map display', async () => {
  const result = await runLandmassPipeline(forceValidationRejectionParams)
  assert.strictEqual(result.status, 'exhausted')
  assert.ok(result.worldDocument)

  const cloned = cloneWorldDocument(result.worldDocument)
  cloned.fields.elevation[0] = -999
  assert.notStrictEqual(result.worldDocument.fields.elevation[0], -999)
  assert.ok(result.worldDocument.fields.elevation.length > 0)
  assert.ok(result.worldDocument.biomes.length > 0)
})

test('runLandmassPipeline retries validation with incremented seed', async () => {
  const result = await runLandmassPipeline({
    geographySeed: 999999,
    prevailingWindDegrees: 270,
    width: 16,
    height: 16,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastMouth: true,
      maxValidationRetries: 2,
    },
  })

  assert.ok(result.worldDocument)
  if (result.worldDocument.generationReport?.shouldReject) {
    assert.strictEqual(result.status, 'exhausted')
    assert.strictEqual(result.worldDocument.geographySeed, 999999 + 2)
  } else {
    assert.strictEqual(result.status, 'success')
  }
})

test('runLandmassPipeline returns cancelled when hydrology aborts due to shouldCancel', async () => {
  let completedSubsteps = 0
  const result = await runLandmassPipeline(params, {
    onSubstepComplete() {
      completedSubsteps += 1
    },
    shouldCancel() {
      return completedSubsteps >= 2
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
  assert.ok(result.state)
  assert.strictEqual(result.state?.lastCompletedStep, 'erosion')
})

test('runLandmassPipelineRun matches runLandmassPipeline output through shared runner', async () => {
  const fromWorker = await runLandmassPipeline(params)
  const fromSync = runLandmassPipelineRun(params)

  assert.strictEqual(fromWorker.status, 'success')
  assert.strictEqual(fromSync.status, 'success')
  assert.deepStrictEqual(fromSync.worldDocument?.biomes, fromWorker.worldDocument?.biomes)
  assert.deepStrictEqual(
    fromSync.worldDocument?.fields.elevation,
    fromWorker.worldDocument?.fields.elevation,
  )
})

test('runLandmassPipelineRun returns cancelled when shouldCancel fires mid-pipeline', () => {
  let stepStarts = 0
  const result = runLandmassPipelineRun(params, {
    onStepStart() {
      stepStarts += 1
    },
    shouldCancel() {
      return stepStarts >= 2
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.ok(result.state)
  assert.strictEqual(result.state?.lastCompletedStep, 'erosion')
})

test('runLandmassPipeline forwards onSubstepPrepare through hydrology step', async () => {
  /** @type {string[]} */
  const prepared = []
  await runLandmassPipeline(params, {
    onSubstepPrepare({ substepId, input }) {
      prepared.push(substepId)
      const contract =
        HYDROLOGY_SUBSTEP_CONTRACTS[
          /** @type {import('./hydrology/hydrologySubsteps.js').HydrologySubstepId} */ (substepId)
        ]
      assert.deepStrictEqual(Object.keys(input).sort(), [...contract.inputKeys].sort())
    },
  })

  assert.ok(prepared.length > 0)
  assert.strictEqual(prepared[0], 'hydrologyFill')
})

test('runLandmassPipelineRun forwards onSubstepPrepare through hydrology step', () => {
  /** @type {string[]} */
  const prepared = []
  runLandmassPipelineRun(params, {
    onSubstepPrepare({ substepId }) {
      prepared.push(substepId)
    },
  })

  assert.ok(prepared.length > 0)
  assert.strictEqual(prepared[0], 'hydrologyFill')
})

test('runLandmassPipelineRun returns cancelled when hydrology aborts due to shouldCancel', () => {
  let completedSubsteps = 0
  const result = runLandmassPipelineRun(params, {
    onSubstepComplete() {
      completedSubsteps += 1
    },
    shouldCancel() {
      return completedSubsteps >= 2
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
})

test('runLandmassPipelineRun returns exhausted when validation retries are exhausted', () => {
  const result = runLandmassPipelineRun(forceValidationRejectionParams)

  assert.strictEqual(result.status, 'exhausted')
  assert.ok(result.worldDocument)
  assert.strictEqual(result.worldDocument.generationReport?.shouldReject, true)
})

test('runLandmassPipelineRun retries validation with incremented seed', () => {
  const result = runLandmassPipelineRun({
    geographySeed: 999999,
    prevailingWindDegrees: 270,
    width: 16,
    height: 16,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastMouth: true,
      maxValidationRetries: 2,
    },
  })

  assert.ok(result.worldDocument)
  if (result.worldDocument.generationReport?.shouldReject) {
    assert.strictEqual(result.status, 'exhausted')
    assert.strictEqual(result.worldDocument.geographySeed, 999999 + 2)
  } else {
    assert.strictEqual(result.status, 'success')
  }
})

const validationRetryCancelParams = {
  geographySeed: 999999,
  prevailingWindDegrees: 270,
  width: 16,
  height: 16,
  options: {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enforceCoastMouth: true,
    maxValidationRetries: 5,
  },
}

test('runLandmassPipelineRun returns cancelled when shouldCancel fires between validation retries', () => {
  let validationAttempts = 0
  const result = runLandmassPipelineRun(validationRetryCancelParams, {
    onStepComplete({ stepId }) {
      if (stepId === 'validation') {
        validationAttempts += 1
      }
    },
    shouldCancel() {
      return validationAttempts >= 1
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
  assert.ok(result.state)
  assert.strictEqual(validationAttempts, 1)
})

test('runLandmassPipeline returns cancelled when shouldCancel fires between validation retries', async () => {
  let validationAttempts = 0
  const result = await runLandmassPipeline(validationRetryCancelParams, {
    onStepComplete({ stepId }) {
      if (stepId === 'validation') {
        validationAttempts += 1
      }
    },
    shouldCancel() {
      return validationAttempts >= 1
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
  assert.ok(result.state)
  assert.strictEqual(validationAttempts, 1)
})
