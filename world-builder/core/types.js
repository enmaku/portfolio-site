/**
 * @typedef {Object} ScalarFields
 * @property {Float32Array} elevation
 * @property {Float32Array} temperature
 * @property {Float32Array} rainfall
 * @property {Float32Array} drainage
 * @property {Float32Array} salidity
 */

/**
 * @typedef {Object} WorldDocument
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {ScalarFields} fields
 * @property {Uint8Array} biomes
 * @property {ReadonlyArray<{ id: number, label: string }>} biomeCatalog
 * @property {string} generatedAt
 * @property {'physicalTerrainBaseline'} pipelineStage
 */

/**
 * @typedef {Object} PhysicalTerrainBaselineParams
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {number} [width]
 * @property {number} [height]
 */

export const PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE = 'physicalTerrainBaseline'

export const DEFAULT_GRID_SIZE = 1024

/** Grid size the field tunings were originally authored for. */
export const REFERENCE_GRID_SIZE = 256

/**
 * Scale a distance or frequency authored at REFERENCE_GRID_SIZE to another grid width.
 * @param {number} value
 * @param {number} gridSize
 */
export function scaleForGridSize(value, gridSize) {
  return value * (REFERENCE_GRID_SIZE / gridSize)
}
