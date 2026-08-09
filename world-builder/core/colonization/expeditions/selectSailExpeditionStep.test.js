import assert from 'node:assert/strict'
import test from 'node:test'
import { selectSailExpeditionStep, listLegalSailExpeditionSteps, SAIL_EXPEDITION_MAX_SHORE_DISTANCE } from './selectSailExpeditionStep.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { deriveSailOverlayMask } from '../../sail/deriveSailOverlayMask.js'
import { SEA_LEVEL } from '../../biomeIds.js'

test('selectSailExpeditionStep stays on sail overlay within shore proximity', () => {
  const width = 7
  const height = 5
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.55)
  for (let x = 0; x < width; x += 1) {
    elevation[2 * width + x] = 0.1
  }
  elevation[2 * width + 3] = 0.55

  const doc = {
    gridWidth: width,
    gridHeight: height,
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    fields: { elevation },
  }
  const sailMask = deriveSailOverlayMask({
    elevation,
    lakeMask: doc.lakeMask,
    riverCorridorMask: doc.riverCorridorMask,
    gridWidth: width,
    gridHeight: height,
    seaLevel: SEA_LEVEL,
  })
  const dryLandMask = buildDryLandTraversableMask(doc)
  const current = { x: 3, y: 1 }
  const step = selectSailExpeditionStep(current, 0, sailMask, dryLandMask, doc)
  assert.ok(step)
  assert.strictEqual(sailMask[step.y * width + step.x], 1)
  const legal = listLegalSailExpeditionSteps(current, sailMask, dryLandMask, width, height)
  assert.ok(legal.length > 0)
})

test('listLegalSailExpeditionSteps uses max shore distance constant', () => {
  const width = 12
  const height = 3
  const cellCount = width * height
  const sailMask = new Uint8Array(cellCount).fill(1)
  const dryLandMask = new Uint8Array(cellCount)
  dryLandMask[1 * width + 0] = 1

  const current = { x: 5, y: 1 }
  const legal = listLegalSailExpeditionSteps(current, sailMask, dryLandMask, width, height)
  assert.ok(legal.some((cell) => cell.x === 6 && cell.y === 1))

  const tooFar = { x: 7, y: 1 }
  assert.ok(
    !listLegalSailExpeditionSteps(tooFar, sailMask, dryLandMask, width, height).some(
      (cell) => cell.x === 8 && cell.y === 1,
    ),
  )
  assert.strictEqual(SAIL_EXPEDITION_MAX_SHORE_DISTANCE, 6)
})
