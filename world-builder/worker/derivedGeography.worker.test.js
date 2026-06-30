import assert from 'node:assert/strict'
import test from 'node:test'
import { runLandmassPipeline } from '../core/derivedGeographyPipeline.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../core/worldGenerationOptions.js'

const workerParams = {
  geographySeed: 42,
  prevailingWindDegrees: 90,
  width: 8,
  height: 8,
  options: DEFAULT_WORLD_GENERATION_OPTIONS,
}

test('worker job completes successfully through shared landmass pipeline runner', async () => {
  /** @type {string[]} */
  const messages = []
  const result = await runLandmassPipeline(workerParams, {
    onStepStart({ stepId }) {
      messages.push(`start:${stepId}`)
    },
    onStepComplete({ stepId, worldDocument }) {
      messages.push(`complete:${stepId}:${Boolean(worldDocument)}`)
    },
  })

  assert.strictEqual(result.status, 'success')
  assert.ok(result.worldDocument)
  assert.ok(messages.includes('start:physicalTerrainBaseline'))
  assert.ok(messages.includes('complete:validation:true'))
  assert.ok(messages.includes('complete:erosion:false'))
})

test('worker job reports cancelled when shouldCancel is set mid-run', async () => {
  let stepStarts = 0
  const result = await runLandmassPipeline(workerParams, {
    onStepStart() {
      stepStarts += 1
    },
    shouldCancel() {
      return stepStarts >= 2
    },
  })

  assert.strictEqual(result.status, 'cancelled')
  assert.strictEqual(result.worldDocument, null)
})

test('worker job reports cancelled when hydrology substep cancellation is requested', async () => {
  let completedSubsteps = 0
  const result = await runLandmassPipeline(workerParams, {
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

test('worker job reports error when pipeline callback throws', async () => {
  const result = await runLandmassPipeline(workerParams, {
    onStepStart() {
      throw new Error('worker callback failed')
    },
  })

  assert.strictEqual(result.status, 'error')
  assert.match(result.errorMessage ?? '', /worker callback failed/)
})

test('worker job omits intermediate previews unless explicitly enabled', async () => {
  /** @type {boolean[]} */
  const hasDoc = []
  await runLandmassPipeline(workerParams, {
    onStepComplete({ worldDocument }) {
      hasDoc.push(Boolean(worldDocument))
    },
  })

  assert.deepStrictEqual(hasDoc, [false, false, false, false, false, true])
})
