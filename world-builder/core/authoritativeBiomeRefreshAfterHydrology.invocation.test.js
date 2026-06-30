import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 64,
  height: 64,
}

const biomeInvocationTests = { skip: !mock.module }

test(
  'non-seasonal full pipeline invokes classifyBiomesWithHydrology only during hydrology',
  biomeInvocationTests,
  async () => {
    mock.reset()

    let classifyBiomesWithHydrologyCallCount = 0
    const classifyBiomesModule = await import('./classifyBiomesFromFields.js')

    mock.module('./classifyBiomesFromFields.js', {
      namedExports: {
        ...classifyBiomesModule,
        classifyBiomesWithHydrology(...args) {
          classifyBiomesWithHydrologyCallCount += 1
          return classifyBiomesModule.classifyBiomesWithHydrology(...args)
        },
      },
    })

    const { createInitialPipelineState, runPipelineStep } = await import(
      './derivedGeographyPipeline.js'
    )
    const { resolveWorldGenerationOptions } = await import('./worldGenerationOptions.js')

    const nonSeasonalOptions = resolveWorldGenerationOptions({ enableSeasonalHydrology: false })
    let state = createInitialPipelineState({
      ...params,
      options: nonSeasonalOptions,
    })

    state = runPipelineStep(state, 'physicalTerrainBaseline')
    state = runPipelineStep(state, 'erosion')
    assert.strictEqual(classifyBiomesWithHydrologyCallCount, 0)

    state = runPipelineStep(state, 'hydrology')
    const callsAfterHydrology = classifyBiomesWithHydrologyCallCount
    assert.strictEqual(
      callsAfterHydrology,
      1,
      'expected hydrology exit to classify biomes exactly once with hydrology overlays',
    )

    for (const stepId of ['fieldRefresh', 'coastAndResources', 'validation']) {
      state = runPipelineStep(state, stepId)
      assert.strictEqual(
        classifyBiomesWithHydrologyCallCount,
        callsAfterHydrology,
        `expected no redundant classifyBiomesWithHydrology after ${stepId}`,
      )
    }
  },
)
