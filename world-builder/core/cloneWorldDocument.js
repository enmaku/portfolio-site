import {
  cloneColonizationSlice,
  pickColonizationSliceFields,
} from './colonization/createDefaultColonizationSlice.js'
import { cloneGenerationReport } from './cloneGenerationReport.js'

/**
 * Clone typed arrays so worker postMessage copies are independent on the main thread.
 * @param {import('./types.js').WorldDocument} doc
 * @returns {import('./types.js').WorldDocument}
 */
export function cloneWorldDocument(doc) {
  const fields = {
    elevation: new Float32Array(doc.fields.elevation),
    temperature: new Float32Array(doc.fields.temperature),
    rainfall: new Float32Array(doc.fields.rainfall),
    drainage: new Float32Array(doc.fields.drainage),
    salinity: new Float32Array(doc.fields.salinity),
  }
  const colonization =
    doc.colonizationPhase !== undefined
      ? cloneColonizationSlice(pickColonizationSliceFields(doc))
      : null
  return {
    ...doc,
    ...(colonization ?? {}),
    fields,
    biomes: new Uint8Array(doc.biomes),
    displayBiomes: new Uint8Array(doc.displayBiomes),
    lakeMask: doc.lakeMask ? new Uint8Array(doc.lakeMask) : undefined,
    simulationRiverMask: doc.simulationRiverMask
      ? new Uint8Array(doc.simulationRiverMask)
      : undefined,
    riverNetworkMask: doc.riverNetworkMask ? new Uint8Array(doc.riverNetworkMask) : undefined,
    riverCorridorMask: doc.riverCorridorMask ? new Uint8Array(doc.riverCorridorMask) : undefined,
    channelWidth: doc.channelWidth ? new Float32Array(doc.channelWidth) : undefined,
    flowDirection: doc.flowDirection ? new Int16Array(doc.flowDirection) : undefined,
    coastNavigability: doc.coastNavigability
      ? new Float32Array(doc.coastNavigability)
      : undefined,
    movementCost: doc.movementCost ? new Float32Array(doc.movementCost) : undefined,
    erosionSnapshots: doc.erosionSnapshots?.map((snapshot) => new Float32Array(snapshot)),
    riverGraph: doc.riverGraph
      ? {
          nodes: doc.riverGraph.nodes.map((node) => ({ ...node })),
          edges: doc.riverGraph.edges.map((edge) => ({
            ...edge,
            cellPath: edge.cellPath ? [...edge.cellPath] : undefined,
          })),
        }
      : undefined,
    lakes: doc.lakes?.map((lake) => ({ ...lake })),
    lakeMeta: doc.lakeMeta?.map((meta) => ({ ...meta })),
    coastalNodes: doc.coastalNodes?.map((node) => ({ ...node })),
    saltNodes: doc.saltNodes?.map((node) => ({ ...node })),
    metalsRaster: doc.metalsRaster ? new Float32Array(doc.metalsRaster) : undefined,
    metalNodes: doc.metalNodes?.map((node) => ({ ...node })),
    arableRaster: doc.arableRaster ? new Float32Array(doc.arableRaster) : undefined,
    timberRaster: doc.timberRaster ? new Float32Array(doc.timberRaster) : undefined,
    generationReport: doc.generationReport ? cloneGenerationReport(doc.generationReport) : undefined,
    visitedCells:
      doc.visitedCells instanceof Uint8Array ? new Uint8Array(doc.visitedCells) : doc.visitedCells,
  }
}
