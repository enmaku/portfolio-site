import { deriveBasinCatchments } from '../deriveBasinCatchments.js'
import { computeCellRunoff } from '../computeCellRunoff.js'
import { simulateSeasonalHydrology } from '../simulateSeasonalHydrology.js'
import { baselineDrainageFromState } from '../baselineDrainageFromState.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologySeasonalSubstep = {
  id: 'hydrologySeasonal',
  label: 'Seasonal hydrology',
  inputs: {
    geographySeed: (world) => world.state.geographySeed,
    prevailingWindDegrees: (world) => world.state.prevailingWindDegrees,
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    erodedElevation: (world) => world.state.erodedElevation,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
    filledElevation: (world) => world.filledElevation,
    lakeMask: (world) => world.lakeMask,
    lakes: (world) => world.lakes,
    lakeMeta: (world) => world.lakeMeta,
    lakeIdByCell: (world) => world.lakeIdByCell,
    temperature: (world) => world.temperature,
    rainfall: (world) => world.rainfall,
    snowCapMask: (world) => world.snowCapMask,
    meltContribution: (world) => world.meltContribution,
    ocean: (world) => world.ocean,
    hydrologyStats: (world) => world.hydrologyStats,
  },
  outputKeys: [
    'effectiveRunoff',
    'overflowLakeIds',
    'filledElevation',
    'lakeMeta',
    'lakes',
    'catchmentCellsByLake',
    'hydrologyStats',
  ],
  run(input) {
    const {
      options,
      width,
      height,
      erodedElevation,
      baselineDrainage,
      filledElevation,
      lakeMask,
      lakes,
      lakeMeta,
      lakeIdByCell,
      temperature,
      rainfall,
      snowCapMask,
      meltContribution,
      ocean,
      hydrologyStats,
      geographySeed,
      prevailingWindDegrees,
    } = input

    if (!options.enableSeasonalHydrology) {
      return {
        effectiveRunoff: computeCellRunoff({
          rainfall,
          meltContribution,
          soilDrainage: baselineDrainage,
          soilDrainageScale: options.soilDrainageScale,
          ocean,
        }),
        overflowLakeIds: new Set(),
      }
    }

    const { catchmentCellsByLake } = deriveBasinCatchments({
      elevation: erodedElevation,
      lakeIdByCell,
      width,
      height,
      seaLevel: options.seaLevel,
    })

    const seasonal = simulateSeasonalHydrology({
      elevation: erodedElevation,
      filledElevation,
      rainfall,
      temperature,
      snowCapMask,
      lakeMask,
      lakes,
      lakeMeta,
      catchmentCellsByLake,
      lakeIdByCell,
      soilDrainage: baselineDrainage,
      ocean,
      width,
      height,
      geographySeed,
      prevailingWindDegrees,
      options,
    })

    const nextStats = hydrologyStats
      ? {
          ...hydrologyStats,
          overflowLakeCount: seasonal.seasonalStats.overflowLakeCount,
          seasonalYearCount: seasonal.seasonalStats.seasonalYearCount,
          meanLakeLevelDelta: seasonal.seasonalStats.meanLakeLevelDelta,
          bankCrumbleCount: seasonal.seasonalStats.bankCrumbleCount,
          endorheicCount: seasonal.lakes.filter((lake) => lake.endorheic).length,
          endorheicFraction:
            seasonal.lakes.length > 0
              ? seasonal.lakes.filter((lake) => lake.endorheic).length / seasonal.lakes.length
              : 0,
        }
      : hydrologyStats

    return {
      filledElevation: seasonal.filledElevation,
      lakeMeta: seasonal.lakeMeta,
      lakes: seasonal.lakes,
      effectiveRunoff: seasonal.effectiveRunoff,
      overflowLakeIds: seasonal.overflowLakeIds,
      catchmentCellsByLake,
      hydrologyStats: nextStats,
    }
  },
}
