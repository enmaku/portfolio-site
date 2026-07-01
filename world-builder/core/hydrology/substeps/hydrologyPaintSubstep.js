import {
  buildPhysicalRiverCorridorMask,
  smoothRiverCorridorMaskForDisplay,
} from '../riverCorridorDisplay.js'
import { assembleRiverNetwork } from '../riverNetwork.js'
import {
  resolveDisplayRiverNetworkMaskFromPipeline,
  resolveSimulationRiverNetworkMaskFromPipeline,
  riverMaskContractKey,
  setRiverMaskStage,
} from '../riverMaskLifecycle.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyPaintSubstep = {
  id: 'hydrologyPaint',
  label: 'Paint river corridors',
  inputs: {
    width: (world) => world.width,
    height: (world) => world.height,
    settledElevation: (world) => world.settledElevation,
    settledFlowDirection: (world) => world.settledFlowDirection,
    settledFlowAccumulation: (world) => world.settledFlowAccumulation,
    channelWidth: (world) => world.channelWidth,
    settledOcean: (world) => world.settledOcean,
    lakeMask: (world) => world.lakeMask,
    settledRiverGraph: (world) => world.settledRiverGraph,
  },
  outputKeys: [riverMaskContractKey('painted'), 'riverNetwork'],
  run(input, { riverMaskPipeline, onProgress }) {
    const {
      width,
      height,
      settledElevation,
      settledFlowDirection,
      settledFlowAccumulation,
      channelWidth,
      settledOcean,
      lakeMask,
      settledRiverGraph,
    } = input
    const riverNetworkMask = resolveDisplayRiverNetworkMaskFromPipeline(riverMaskPipeline)
    const rawMask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
      elevation: settledElevation,
      flowDirection: settledFlowDirection,
      channelWidth,
      ocean: settledOcean ?? undefined,
      lakeMask: lakeMask ?? undefined,
      onProgress: (progress) => onProgress(progress * 0.92),
    })
    const paintedCorridorMask = smoothRiverCorridorMaskForDisplay(rawMask, width, height, 1)
    setRiverMaskStage(riverMaskPipeline, 'painted', paintedCorridorMask)
    const riverNetwork = assembleRiverNetwork({
      simulationCenterline: resolveSimulationRiverNetworkMaskFromPipeline(riverMaskPipeline),
      centerline: riverNetworkMask,
      corridor: paintedCorridorMask,
      flowDirection: settledFlowDirection,
      flowAccumulation: settledFlowAccumulation,
      channelWidth,
      graph: settledRiverGraph,
      width,
      height,
    })
    onProgress(1)
    return { riverNetwork }
  },
}
