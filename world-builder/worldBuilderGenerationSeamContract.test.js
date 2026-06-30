import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const worldBuilderDir = fileURLToPath(new URL('.', import.meta.url))

const orchestratorPath = join(worldBuilderDir, 'worldBuilderGenerationOrchestrator.js')
const pageModelPath = join(worldBuilderDir, 'worldBuilderPageModel.js')
const policyPath = join(worldBuilderDir, 'worldBuilderGenerationPolicy.js')

test('generation orchestrator does not import page presentation model', () => {
  const source = readFileSync(orchestratorPath, 'utf8')
  assert.ok(
    !source.includes('worldBuilderPageModel'),
    'orchestrator must own generation policy via worldBuilderGenerationPolicy, not page model',
  )
  assert.ok(source.includes('worldBuilderGenerationPolicy'))
})

test('page model does not host generation preview or progress policy', () => {
  const source = readFileSync(pageModelPath, 'utf8')
  for (const symbol of [
    'shouldApplyStepPreviewToMap',
    'generationProgressValue',
    'worldBuilderGenerationPolicy',
  ]) {
    assert.ok(!source.includes(symbol), `page model must not reference ${symbol}`)
  }
})

test('generation policy module stays free of page presentation imports', () => {
  const source = readFileSync(policyPath, 'utf8')
  assert.ok(!source.includes('worldBuilderPageModel'))
  assert.ok(!source.includes('quasar'))
  assert.ok(!source.includes('.vue'))
})
