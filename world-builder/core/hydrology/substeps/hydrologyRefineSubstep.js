import {
  applyPresentationStageCorridorAttraction,
  applyRefineStageMeanderPresentation,
  isCorridorAttractionEnabled,
} from '../riverNetworkLegacyMeanders.js'
import {
  applySkipRefineToPipeline,
  requireRiverMaskStage,
  riverMaskContractKey,
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  setRiverMaskStage,
} from '../riverMaskLifecycle.js'
import { unionCorridorMasks } from '../extractRiverNetworkFromIncisedChannels.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyRefineSubstep = {
  id: 'hydrologyRefine',
  label: 'Meander refine',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    geographySeed: (world) => world.state.geographySeed,
    settledElevation: (world) => world.settledElevation,
    settledOcean: (world) => world.settledOcean,
    settledFlowDirection: (world) => world.settledFlowDirection,
    settledFlowAccumulation: (world) => world.settledFlowAccumulation,
    lakeMask: (world) => world.lakeMask,
  },
  outputKeys: ['settledElevation', riverMaskContractKey('presentation')],
  skipTransition: RIVER_MASK_SKIP_REFINE_TRANSITION,
  shouldSkip: (world) =>
    !world.state.options.enableMeanderRefine &&
    !isCorridorAttractionEnabled(world.width, world.state.options.riverAttractionRadiusScale),
  run(input, { riverMaskPipeline }) {
    const {
      options,
      width,
      height,
      geographySeed,
      settledElevation,
      settledOcean,
      settledFlowDirection,
      settledFlowAccumulation,
      lakeMask,
    } = input
    const settledMask = requireRiverMaskStage(riverMaskPipeline, 'settled')
    const attractedMask = applyPresentationStageCorridorAttraction({
      baseRiverNetworkMask: settledMask,
      elevation: settledElevation,
      ocean: settledOcean,
      width,
      height,
      geographySeed,
      flowDirection: settledFlowDirection,
      riverAttractionRadiusScale: options.riverAttractionRadiusScale,
    })
    if (!options.enableMeanderRefine) {
      setRiverMaskStage(riverMaskPipeline, 'presentation', attractedMask)
      return {}
    }
    const refined = applyRefineStageMeanderPresentation({
      sketchMask: attractedMask,
      elevation: settledElevation,
      ocean: settledOcean,
      flowDirection: settledFlowDirection,
      flowAccumulation: settledFlowAccumulation,
      lakeMask,
      width,
      height,
      geographySeed,
      options,
    })
    setRiverMaskStage(
      riverMaskPipeline,
      'presentation',
      unionCorridorMasks(attractedMask, refined.riverNetworkMask),
    )
    return { settledElevation: refined.elevation }
  },
  runSkipped(_input, { riverMaskPipeline }) {
    applySkipRefineToPipeline(riverMaskPipeline)
    return {}
  },
}
