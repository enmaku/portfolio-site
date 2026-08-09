import {
  deriveIncisedCorridorMask,
  unionCorridorMasks,
} from '../extractRiverNetworkFromIncisedChannels.js'
import { carveTemporaryRivers } from '../seededTemporaryRiverCarve.js'
import {
  requireRiverMaskStage,
  riverMaskContractKey,
  setRiverMaskStage,
} from '../riverMaskLifecycle.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyInciseSubstep = {
  id: 'hydrologyIncise',
  label: 'Incise channels',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    geographySeed: (world) => world.state.geographySeed,
    filledElevation: (world) => world.filledElevation,
    lakeMask: (world) => world.lakeMask,
    lakeOcean: (world) => world.lakeOcean,
    flowDirection: (world) => world.flowDirection,
    flowAccumulation: (world) => world.flowAccumulation,
  },
  outputKeys: ['settledElevation', riverMaskContractKey('incised')],
  run(input, { riverMaskPipeline, onProgress }) {
    const {
      options,
      width,
      height,
      geographySeed,
      filledElevation,
      lakeMask,
      lakeOcean,
      flowDirection,
      flowAccumulation,
    } = input
    const carved = carveTemporaryRivers({
      elevation: filledElevation,
      ocean: lakeOcean,
      flowDirection,
      flowAccumulation,
      lakeMask,
      width,
      height,
      geographySeed,
      seaLevel: options.seaLevel,
      channelSeedMask: requireRiverMaskStage(riverMaskPipeline, 'sketch'),
      incisionDepth: options.erosionChannelWear * 1.5,
      inciseIterations: options.inciseIterations,
      streamPowerK: options.streamPowerK,
      streamPowerM: options.streamPowerM,
      streamPowerN: options.streamPowerN,
      channelInitiationThreshold: options.channelInitiationThreshold,
      onProgress,
    })
    setRiverMaskStage(
      riverMaskPipeline,
      'incised',
      unionCorridorMasks(
        carved.corridorMask,
        deriveIncisedCorridorMask(filledElevation, carved.elevation, lakeOcean),
      ),
    )
    return { settledElevation: carved.elevation }
  },
}
