/**
 * Typed hydrology world evolution — one explicit stage type per substep boundary (#355).
 *
 * @typedef {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState
 * @typedef {import('../types.js').LakeMetaRecord} LakeMetaRecord
 * @typedef {import('../types.js').LakeRecord} LakeRecord
 * @typedef {import('../types.js').HydrologyPipelineStats} HydrologyPipelineStats
 * @typedef {import('../types.js').RiverNetwork} RiverNetwork
 * @typedef {import('./riverNetwork.js').RiverGraph} RiverGraph
 */

/**
 * @typedef {Object} HydrologyWorldBase
 * @property {DerivedGeographyPipelineState} state
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} HydrologyFillOutputs
 * @property {boolean[]} ocean
 * @property {Uint8Array} lakeMask
 * @property {LakeRecord[]} lakes
 * @property {LakeMetaRecord[]} lakeMeta
 * @property {HydrologyPipelineStats} hydrologyStats
 * @property {Float32Array} filledElevation
 * @property {Int32Array | null} spillOutlet
 * @property {Int32Array | null} lakeIdByCell
 * @property {Map<number, number[]> | null} catchmentCellsByLake
 */

/**
 * @typedef {HydrologyWorldBase & HydrologyFillOutputs} HydrologyAfterFill
 */

/**
 * @typedef {Object} HydrologyClimateOutputs
 * @property {Float32Array} temperature
 * @property {Float32Array} rainfall
 * @property {Uint8Array} snowCapMask
 * @property {Float32Array} meltContribution
 */

/**
 * @typedef {HydrologyAfterFill & HydrologyClimateOutputs} HydrologyAfterClimate
 */

/**
 * @typedef {Object} HydrologySeasonalOutputs
 * @property {Float32Array} effectiveRunoff
 * @property {Set<number>} overflowLakeIds
 */

/**
 * @typedef {HydrologyAfterClimate & HydrologySeasonalOutputs} HydrologyAfterSeasonal
 */

/**
 * @typedef {Object} HydrologyRouteOutputs
 * @property {Int16Array} flowDirection
 * @property {Float32Array} flowAccumulation
 * @property {boolean[]} lakeOcean
 */

/**
 * @typedef {HydrologyAfterSeasonal & HydrologyRouteOutputs} HydrologyAfterRoute
 */

/**
 * @typedef {Object} HydrologyInciseOutputs
 * @property {Float32Array} settledElevation
 */

/**
 * @typedef {HydrologyAfterRoute & HydrologyInciseOutputs} HydrologyAfterIncise
 */

/**
 * @typedef {Object} HydrologyExtractOutputs
 * @property {Int16Array} settledFlowDirection
 * @property {Float32Array} settledFlowAccumulation
 * @property {boolean[]} settledOcean
 * @property {Float32Array} channelWidth
 * @property {RiverGraph} settledRiverGraph
 * @property {RiverGraph} simulationRiverGraph
 */

/**
 * @typedef {HydrologyAfterIncise & HydrologyExtractOutputs} HydrologyAfterExtract
 */

/** @typedef {HydrologyAfterExtract} HydrologyAfterRefine */

/**
 * @typedef {Object} HydrologySettleOutputs
 * @property {Float32Array} settledElevation
 * @property {LakeRecord[]} lakes
 * @property {LakeMetaRecord[]} lakeMeta
 * @property {Int32Array | null} spillOutlet
 * @property {Int16Array} settledFlowDirection
 * @property {Float32Array} settledFlowAccumulation
 * @property {boolean[]} settledOcean
 * @property {Float32Array} settledDrainage
 * @property {Float32Array} channelWidth
 * @property {RiverGraph} settledRiverGraph
 * @property {RiverGraph} simulationRiverGraph
 */

/**
 * @typedef {HydrologyAfterRefine & HydrologySettleOutputs} HydrologyAfterSettle
 */

/**
 * @typedef {Object} HydrologyPaintOutputs
 * @property {RiverNetwork} riverNetwork
 */

/**
 * @typedef {HydrologyAfterSettle & HydrologyPaintOutputs} HydrologyAfterPaint
 */

/** @typedef {HydrologyAfterPaint} HydrologyWorld */

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {HydrologyWorldBase}
 */
export function createInitialHydrologyWorld(state) {
  return {
    state,
    width: state.width,
    height: state.height,
  }
}

/**
 * @template {HydrologyWorldBase} TIn
 * @template {HydrologyWorldBase} TOut
 * @param {TIn} world
 * @param {Partial<TOut>} output
 * @returns {TOut}
 */
export function mergeHydrologyWorld(world, output) {
  return /** @type {TOut} */ ({ ...world, ...output })
}
