import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../../biomeIds.js'
import { computeFoundingRouteCorridor } from './computeFoundingRouteCorridor.js'
import { SAIL_EXPEDITION_MAX_SHORE_DISTANCE } from './selectSailExpeditionStep.js'

const LAND_ELEVATION = SEA_LEVEL + 0.08

function makeDoc({ width, height, elevation, lakeMask, riverCorridorMask, movementCost, sailMask }) {
  const cellCount = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    fields: { elevation: elevation ?? new Float32Array(cellCount).fill(LAND_ELEVATION) },
    lakeMask: lakeMask ?? new Uint8Array(cellCount),
    riverCorridorMask: riverCorridorMask ?? new Uint8Array(cellCount),
    movementCost: movementCost ?? new Float32Array(cellCount).fill(1),
    sailMask,
  }
}

test('land founding corridor avoids lake and river corridor cells', () => {
  const width = 8
  const height = 8
  const cellCount = width * height

  const doc = makeDoc({
    width,
    height,
    lakeMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 3 * width + 4 ? 1 : 0)),
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 4 * width + 4 ? 1 : 0)),
  })

  const corridor = computeFoundingRouteCorridor({
    doc,
    from: { x: 1, y: 1 },
    to: { x: 6, y: 6 },
    mode: 'land',
  })

  assert.ok(corridor)
  assert.ok(corridor.cells.length > 1)
  for (const cell of corridor.cells) {
    const index = cell.y * width + cell.x
    assert.notStrictEqual(doc.lakeMask[index], 1)
    assert.notStrictEqual(doc.riverCorridorMask[index], 1)
  }
})

test('land founding corridor prefers valley over ridge when ridge blocks direct route', () => {
  const width = 8
  const height = 4
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(LAND_ELEVATION)

  for (let x = 1; x < width - 1; x += 1) {
    elevation[0 * width + x] = LAND_ELEVATION
    elevation[1 * width + x] = LAND_ELEVATION - 0.05
    elevation[2 * width + x] = LAND_ELEVATION + 0.02
  }
  elevation[2 * width + 3] = LAND_ELEVATION + 0.5
  elevation[2 * width + 4] = LAND_ELEVATION + 0.5

  const doc = makeDoc({ width, height, elevation })

  const corridor = computeFoundingRouteCorridor({
    doc,
    from: { x: 1, y: 2 },
    to: { x: 6, y: 2 },
    mode: 'land',
  })

  assert.ok(corridor)
  const usesValley = corridor.cells.some((cell) => cell.y === 1)
  assert.ok(usesValley, 'expected corridor to detour through lower valley row')
  const crossesRidge = corridor.cells.some((cell) => cell.y === 2 && (cell.x === 3 || cell.x === 4))
  assert.ok(!crossesRidge, 'expected corridor to avoid steep ridge cells')
})

test('land founding corridor returns null when destination is blocked', () => {
  const width = 6
  const height = 6
  const cellCount = width * height

  const doc = makeDoc({
    width,
    height,
    lakeMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 3 * width + 3 ? 1 : 0)),
  })

  const corridor = computeFoundingRouteCorridor({
    doc,
    from: { x: 1, y: 1 },
    to: { x: 3, y: 3 },
    mode: 'land',
  })

  assert.strictEqual(corridor, null)
})

test('land founding corridor prefers existing road cells when cheaper', () => {
  const width = 7
  const height = 5
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(LAND_ELEVATION)
  const movementCost = new Float32Array(cellCount).fill(1)

  for (let x = 2; x <= 4; x += 1) {
    movementCost[2 * width + x] = 6
  }

  const doc = makeDoc({ width, height, elevation, movementCost })
  const roadCellMask = new Uint8Array(cellCount)
  roadCellMask[3 * width + 2] = 1
  roadCellMask[3 * width + 3] = 1
  roadCellMask[3 * width + 4] = 1

  const withRoad = computeFoundingRouteCorridor({
    doc,
    from: { x: 1, y: 2 },
    to: { x: 5, y: 2 },
    mode: 'land',
    roadCellMask,
  })

  assert.ok(withRoad)
  const roadUsage = withRoad.cells.filter((cell) => roadCellMask[cell.y * width + cell.x] === 1).length
  assert.ok(roadUsage >= 2)
})

test('sail founding corridor stays on sail overlay and within shore distance', () => {
  const width = 10
  const height = 6
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL - 0.1)
  const dryLandMask = new Uint8Array(cellCount)
  const sailMask = new Uint8Array(cellCount)

  for (let x = 0; x < width; x += 1) {
    dryLandMask[2 * width + x] = 1
    elevation[2 * width + x] = LAND_ELEVATION
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (y >= 1 && y <= 4) {
        sailMask[index] = 1
      }
    }
  }

  const doc = makeDoc({ width, height, elevation, sailMask })

  const corridor = computeFoundingRouteCorridor({
    doc,
    from: { x: 1, y: 3 },
    to: { x: 8, y: 3 },
    mode: 'sail',
    dryLandMask,
    sailMask,
  })

  assert.ok(corridor)
  assert.ok(corridor.cells.length > 1)
  for (const cell of corridor.cells) {
    const index = cell.y * width + cell.x
    assert.strictEqual(sailMask[index], 1)
    let nearShore = false
    for (let dy = -SAIL_EXPEDITION_MAX_SHORE_DISTANCE; dy <= SAIL_EXPEDITION_MAX_SHORE_DISTANCE; dy += 1) {
      for (let dx = -SAIL_EXPEDITION_MAX_SHORE_DISTANCE; dx <= SAIL_EXPEDITION_MAX_SHORE_DISTANCE; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > SAIL_EXPEDITION_MAX_SHORE_DISTANCE) continue
        const nx = cell.x + dx
        const ny = cell.y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        if (dryLandMask[ny * width + nx] === 1) {
          nearShore = true
        }
      }
    }
    assert.ok(nearShore)
  }
})

test('land founding corridor stores adjacent steps along straight paths', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const doc = makeDoc({ width, height, elevation: new Float32Array(cellCount).fill(LAND_ELEVATION) })

  const corridor = computeFoundingRouteCorridor({
    doc,
    from: { x: 1, y: 3 },
    to: { x: 6, y: 3 },
    mode: 'land',
  })

  assert.ok(corridor)
  for (let i = 1; i < corridor.cells.length; i += 1) {
    const prev = corridor.cells[i - 1]
    const next = corridor.cells[i]
    const step = Math.max(Math.abs(next.x - prev.x), Math.abs(next.y - prev.y))
    assert.ok(step <= 1, 'each stored step should be 8-connected to the previous cell')
  }
})
