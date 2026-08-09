import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { generatePhysicalTerrainBaseline } from '../generatePhysicalTerrainBaseline.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../core/worldGenerationOptions.js'
import { fillLakes } from './fillLakes.js'
import { deriveBasinCatchments, buildLakeIdByCell, OCEAN_SINK } from './deriveBasinCatchments.js'

const REPRESENTATIVE_GEOGRAPHY_SEEDS = [12345, DEFAULT_GEOGRAPHY_SEED]

function intRasterChecksum(arr, stride = 97) {
  let checksum = 0
  for (let i = 0; i < arr.length; i += stride) {
    checksum = (checksum + (arr[i] + 1000) * (i + 1)) % 2147483647
  }
  return checksum
}

const CATCHMENT_GOLDEN_CHECKSUMS = new Map([
  [12345, 87541905],
  [DEFAULT_GEOGRAPHY_SEED, 87579365],
])

test('deriveBasinCatchments maps hillside cells into lake catchments', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.8)
  elevation[2 * width + 2] = 0.3
  elevation[2 * width + 1] = 0.5
  elevation[1 * width + 2] = 0.55

  const lakeMask = new Uint8Array(width * height)
  lakeMask[2 * width + 2] = 1

  const lakeIdByCell = new Int32Array(width * height).fill(-1)
  lakeIdByCell[2 * width + 2] = 0

  const { catchmentIndex, catchmentCellsByLake } = deriveBasinCatchments({
    elevation,
    lakeIdByCell,
    width,
    height,
    seaLevel: 0.2,
  })

  assert.equal(catchmentIndex[2 * width + 2], 0)
  assert.ok(catchmentCellsByLake[0].length >= 2)
  assert.equal(catchmentIndex[width * height - 1], OCEAN_SINK)
})

test('buildLakeIdByCell throws when lake metadata cannot be matched to a mask component', () => {
  const width = 5
  const height = 5
  const lakeMask = new Uint8Array(width * height)
  lakeMask[2 * width + 2] = 1
  lakeMask[2 * width + 3] = 1

  const lakes = [{ id: 0, area: 99, endorheic: true }]

  assert.throws(
    () => buildLakeIdByCell(lakeMask, lakes, width, height),
    /Could not match lake record 0/,
  )
})

test('buildLakeIdByCell maps spill-adjacent components to lake records', () => {
  const width = 6
  const height = 4
  const lakeMask = new Uint8Array(width * height)
  lakeMask[1 * width + 2] = 1
  lakeMask[1 * width + 3] = 1

  const lakes = [{ id: 0, area: 2, endorheic: false, spillX: 4, spillY: 1 }]
  const lakeIdByCell = buildLakeIdByCell(lakeMask, lakes, width, height)

  assert.strictEqual(lakeIdByCell[1 * width + 2], 0)
  assert.strictEqual(lakeIdByCell[1 * width + 3], 0)
})

test('buildLakeIdByCell resolves fillLakes metadata for representative geography seeds (#316)', () => {
  for (const geographySeed of REPRESENTATIVE_GEOGRAPHY_SEEDS) {
    const width = 64
    const height = 64
    const doc = generatePhysicalTerrainBaseline({
      geographySeed,
      prevailingWindDegrees: 90,
      width,
      height,
    })
    const ocean = isOceanCell(doc.fields.elevation, width, height, SEA_LEVEL)
    const filled = fillLakes({
      elevation: doc.fields.elevation,
      width,
      height,
      ocean,
      seaLevel: SEA_LEVEL,
    })

    assert.doesNotThrow(() => buildLakeIdByCell(filled.lakeMask, filled.lakes, width, height))
  }
})

test('deriveBasinCatchments preserves golden catchment checksums for representative seeds', () => {
  for (const geographySeed of REPRESENTATIVE_GEOGRAPHY_SEEDS) {
    const width = 64
    const height = 64
    const doc = generatePhysicalTerrainBaseline({
      geographySeed,
      prevailingWindDegrees: 90,
      width,
      height,
    })
    const ocean = isOceanCell(doc.fields.elevation, width, height, SEA_LEVEL)
    const filled = fillLakes({
      elevation: doc.fields.elevation,
      width,
      height,
      ocean,
      seaLevel: SEA_LEVEL,
    })
    const { catchmentIndex } = deriveBasinCatchments({
      elevation: doc.fields.elevation,
      lakeIdByCell: filled.lakeIdByCell,
      width,
      height,
      seaLevel: SEA_LEVEL,
    })

    assert.strictEqual(
      intRasterChecksum(catchmentIndex),
      CATCHMENT_GOLDEN_CHECKSUMS.get(geographySeed),
      `catchment checksum drift for seed ${geographySeed}`,
    )
  }
})
