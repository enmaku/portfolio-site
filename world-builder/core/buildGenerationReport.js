import { runGeographyValidationChecks } from './validation/runGeographyValidationChecks.js'

/**
 * @param {Object} params
 * @param {number} params.erosionStepCount
 * @param {import('./types.js').RiverGraph} params.riverGraph
 * @param {import('./types.js').CoastalNode[]} params.coastalNodes
 * @param {import('./types.js').ScalarFields} params.fields
 * @param {Uint8Array} params.biomes
 * @param {number} params.gridWidth
 * @param {number} params.gridHeight
 * @returns {import('./types.js').GenerationReport}
 */
export function buildGenerationReport({
  erosionStepCount,
  riverGraph,
  coastalNodes,
  fields,
  biomes,
  gridWidth,
  gridHeight,
}) {
  const navigableRiverEdgeCount = riverGraph.edges.filter((edge) => edge.navigable).length
  const validationRows = runGeographyValidationChecks({
    fields,
    biomes,
    riverGraph,
    coastalNodes,
    gridWidth,
    gridHeight,
  })

  return {
    erosionStepCount,
    navigableRiverEdgeCount,
    coastalNodeCount: coastalNodes.length,
    validationRows,
  }
}
