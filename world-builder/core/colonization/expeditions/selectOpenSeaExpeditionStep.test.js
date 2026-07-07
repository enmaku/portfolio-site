import assert from 'node:assert/strict'
import test from 'node:test'
import { listLegalOpenSeaExpeditionSteps } from './selectOpenSeaExpeditionStep.js'
import { listLegalSailExpeditionSteps } from './selectSailExpeditionStep.js'

test('listLegalOpenSeaExpeditionSteps allows sail steps without shore proximity cap', () => {
  const gridWidth = 9
  const gridHeight = 9
  const cellCount = gridWidth * gridHeight
  const sailMask = new Uint8Array(cellCount)
  const dryLandMask = new Uint8Array(cellCount)

  for (let x = 0; x < gridWidth; x += 1) {
    sailMask[4 * gridWidth + x] = 1
  }
  dryLandMask[4 * gridWidth + 0] = 1

  const current = { x: 7, y: 4 }
  const openLegal = listLegalOpenSeaExpeditionSteps(current, sailMask, gridWidth, gridHeight)
  const inlandLegal = listLegalSailExpeditionSteps(
    current,
    sailMask,
    dryLandMask,
    gridWidth,
    gridHeight,
  )

  assert.ok(openLegal.some((cell) => cell.x === 8 && cell.y === 4))
  assert.strictEqual(inlandLegal.some((cell) => cell.x === 8 && cell.y === 4), false)
})
