import { extractRiverNetworkFromIncisedChannels } from '../extractRiverNetworkFromIncisedChannels.js'
import {
  requireRiverMaskStage,
  riverMaskContractKey,
  setRiverMaskStage,
} from '../riverMaskLifecycle.js'
import { baselineDrainageFromState } from '../baselineDrainageFromState.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyExtractSubstep = {
  id: 'hydrologyExtract',
  label: 'Extract river graph',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    settledElevation: (world) => world.settledElevation,
    lakeMask: (world) => world.lakeMask,
    rainfall: (world) => world.rainfall,
    effectiveRunoff: (world) => world.effectiveRunoff,
    meltContribution: (world) => world.meltContribution,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
  },
  outputKeys: [
    'settledFlowDirection',
    'settledFlowAccumulation',
    'settledOcean',
    riverMaskContractKey('settled'),
    'channelWidth',
    'settledRiverGraph',
    'simulationRiverGraph',
  ],
  run(input, { flowFieldSession, riverMaskPipeline }) {
    const {
      options,
      width,
      height,
      settledElevation,
      lakeMask,
      rainfall,
      effectiveRunoff,
      meltContribution,
      baselineDrainage,
    } = input
    const extracted = extractRiverNetworkFromIncisedChannels({
      elevation: settledElevation,
      incisedCorridorMask: requireRiverMaskStage(riverMaskPipeline, 'incised'),
      rainfall,
      meltContribution,
      cellRunoff: effectiveRunoff,
      soilDrainage: baselineDrainage,
      soilDrainageScale: options.soilDrainageScale,
      seaLevel: options.seaLevel,
      width,
      height,
      navigableFlowCutoffScale: options.navigableFlowCutoffScale,
      lakeMask,
      flowFieldSession,
    })
    setRiverMaskStage(riverMaskPipeline, 'settled', extracted.channelMask)
    return {
      settledFlowDirection: extracted.flowDirection,
      settledFlowAccumulation: extracted.flowAccumulation,
      settledOcean: extracted.ocean,
      channelWidth: extracted.channelWidth,
      settledRiverGraph: extracted.riverGraph,
      simulationRiverGraph: extracted.riverGraph,
    }
  },
}
