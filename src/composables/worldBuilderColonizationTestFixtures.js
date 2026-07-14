import { SEA_LEVEL } from '../../world-builder/core/biomeIds.js'

/**
 * @param {Object} [overrides]
 * @returns {import('../../world-builder/core/types.js').WorldDocument}
 */
export function fakeWorldDocument(overrides = {}) {
  return {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
    ...overrides,
  }
}

/** 8x8 document with a coastal landmass column, valid for founding-landing tests. */
export function coastalLandmassDocument() {
  const width = 8
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
  for (let y = 2; y < 6; y += 1) {
    elevation[y * width + 2] = SEA_LEVEL - 0.2
  }
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[3 * width + 3] = 1
  return fakeWorldDocument({
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation,
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(2),
    arableRaster: new Float32Array(cellCount).fill(1),
    timberRaster: new Float32Array(cellCount).fill(1),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    generationReport: {
      validationRows: [],
      validationSignals: { movement: { largestSailComponentCellCount: 8 } },
      largestSailComponentCellCount: 8,
    },
  })
}

/** 32x32 all-land document with no coastal boundary near its center, for landing-rejection tests. */
export function rejectingLandmassDocument() {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.2)
  for (let y = 4; y <= 6; y += 1) {
    for (let x = 4; x <= 6; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.2
    }
  }
  return fakeWorldDocument({
    gridWidth: width,
    gridHeight: height,
    fields: { elevation },
    lakeMask: new Uint8Array(width * height),
    generationReport: {
      validationRows: [],
      validationSignals: { movement: { largestSailComponentCellCount: 8 } },
      largestSailComponentCellCount: 8,
    },
  })
}
