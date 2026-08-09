import { fillLakes } from '../fillLakes.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyFillSubstep = {
  id: 'hydrologyFill',
  label: 'Fill lakes',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    erodedElevation: (world) => world.state.erodedElevation,
  },
  outputKeys: [
    'ocean',
    'lakeMask',
    'lakes',
    'lakeMeta',
    'hydrologyStats',
    'filledElevation',
    'spillOutlet',
    'lakeIdByCell',
    'catchmentCellsByLake',
  ],
  run({ options, width, height, erodedElevation }, { flowFieldSession }) {
    const ocean = flowFieldSession.deriveOceanMask({
      elevation: erodedElevation,
      width,
      height,
      seaLevel: options.seaLevel,
    })
    const {
      lakeMask,
      lakes,
      lakeMeta,
      filledElevation,
      spillOutlet,
      lakeIdByCell,
      basinCellsByLake,
      breachCount,
      endorheicCount,
    } = fillLakes({
      elevation: erodedElevation,
      width,
      height,
      ocean,
      seaLevel: options.seaLevel,
      minLakeAreaScale: options.minLakeAreaScale,
      breachThreshold: options.breachThreshold,
      useDryFloorInitialLevel: options.enableSeasonalHydrology,
    })
    return {
      ocean,
      lakeMask,
      lakes,
      lakeMeta,
      hydrologyStats: {
        breachCount,
        endorheicCount,
        endorheicFraction: lakes.length > 0 ? endorheicCount / lakes.length : 0,
        lakeCount: lakes.length,
      },
      filledElevation,
      spillOutlet,
      lakeIdByCell,
      catchmentCellsByLake: basinCellsByLake,
    }
  },
}
