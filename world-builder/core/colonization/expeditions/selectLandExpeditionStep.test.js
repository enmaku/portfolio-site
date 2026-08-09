import assert from 'node:assert/strict'
import test from 'node:test'
import { selectLandExpeditionStep } from './selectLandExpeditionStep.js'

test('selectLandExpeditionStep prefers bearing-aligned dry land neighbor', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const dryLandMask = new Uint8Array(cellCount).fill(1)
  const visitRaster = new Uint8Array(cellCount)
  const movementCost = new Float32Array(cellCount).fill(1)
  movementCost[2 * width + 3] = 5

  const doc = {
    gridWidth: width,
    gridHeight: height,
    movementCost,
    fields: { elevation: new Float32Array(cellCount).fill(0.5) },
  }

  const current = { x: 2, y: 2 }
  const bearing = 0
  const step = selectLandExpeditionStep(current, bearing, {
    doc,
    dryLandMask,
    visitRaster,
  })

  assert.deepStrictEqual(step, { x: 3, y: 2 })
})

test('selectLandExpeditionStep rejects water cells', () => {
  const width = 3
  const height = 3
  const cellCount = width * height
  const dryLandMask = new Uint8Array(cellCount).fill(1)
  dryLandMask[1 * width + 2] = 0
  const visitRaster = new Uint8Array(cellCount)

  const doc = {
    gridWidth: width,
    gridHeight: height,
    movementCost: new Float32Array(cellCount).fill(1),
    fields: { elevation: new Float32Array(cellCount).fill(0.5) },
  }

  const step = selectLandExpeditionStep({ x: 1, y: 1 }, 0, {
    doc,
    dryLandMask,
    visitRaster,
  })
  assert.notDeepStrictEqual(step, { x: 2, y: 1 })
})

test('selectLandExpeditionStep can step through visited haul-shed neighbors', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const dryLandMask = new Uint8Array(cellCount).fill(1)
  const visitRaster = new Uint8Array(cellCount)
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      visitRaster[(2 + dy) * width + (2 + dx)] = 1
    }
  }

  const doc = {
    gridWidth: width,
    gridHeight: height,
    movementCost: new Float32Array(cellCount).fill(1),
    fields: { elevation: new Float32Array(cellCount).fill(0.5) },
  }

  const step = selectLandExpeditionStep({ x: 2, y: 2 }, 0, {
    doc,
    dryLandMask,
    visitRaster,
  })

  assert.ok(step, 'expected a legal step even when immediate neighbors are visited')
})
