import { buildPipelineStateForHydrologySubsteps } from '../landmassPipelineStageContracts.js'
import { runHydrologySubsteps } from '../hydrology/hydrologySubsteps.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const hydrologyStage = {
  id: 'hydrology',
  label: 'Hydrology',
  inputs: {
    geographySeed: (state) => state.geographySeed,
    prevailingWindDegrees: (state) => state.prevailingWindDegrees,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
    baselineDoc: (state) => {
      if (state.lastCompletedStep !== 'erosion') {
        throw new Error('erosion required before hydrology')
      }
      if (!state.baselineDoc) {
        throw new Error('physicalTerrainBaseline baselineDoc required before hydrology')
      }
      return state.baselineDoc
    },
    erodedElevation: (state) => {
      if (!state.erodedElevation) {
        throw new Error('erosion erodedElevation required before hydrology')
      }
      return state.erodedElevation
    },
    fields: (state) => state.fields,
  },
  outputKeys: [
    'lakeMask',
    'lakes',
    'lakeMeta',
    'lakeIdByCell',
    'hydrologyStats',
    'workingElevation',
    'riverGraph',
    'simulationRiverMask',
    'riverNetworkMask',
    'riverCorridorMask',
    'channelWidth',
    'flowDirection',
    'fields',
    'biomes',
    'hydrologySubstepTimings',
    'lastCompletedStep',
  ],
  run(input, options = {}) {
    const hydrologyState = buildPipelineStateForHydrologySubsteps(input)
    const { state: nextState, timings } = runHydrologySubsteps(hydrologyState, {
      onSubstepStart: options.onSubstepStart,
      onSubstepProgress: options.onSubstepProgress,
      onSubstepComplete: options.onSubstepComplete,
      onSubstepPrepare: options.onSubstepPrepare,
      shouldCancel: options.shouldCancel,
    })
    return {
      lakeMask: nextState.lakeMask,
      lakes: nextState.lakes,
      lakeMeta: nextState.lakeMeta,
      lakeIdByCell: nextState.lakeIdByCell,
      hydrologyStats: nextState.hydrologyStats,
      workingElevation: nextState.workingElevation,
      riverGraph: nextState.riverGraph,
      simulationRiverMask: nextState.simulationRiverMask,
      riverNetworkMask: nextState.riverNetworkMask,
      riverCorridorMask: nextState.riverCorridorMask,
      channelWidth: nextState.channelWidth,
      flowDirection: nextState.flowDirection,
      fields: nextState.fields,
      biomes: nextState.biomes,
      hydrologySubstepTimings: timings,
      lastCompletedStep: /** @type {const} */ ('hydrology'),
    }
  },
}
