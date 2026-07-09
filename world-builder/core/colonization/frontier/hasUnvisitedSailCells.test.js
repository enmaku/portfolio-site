import assert from 'node:assert/strict'
import test from 'node:test'
import { hasUnvisitedSailCells } from './hasUnvisitedSailCells.js'

test('hasUnvisitedSailCells is false when every sail cell is visited', () => {
  const sailMask = Uint8Array.from([1, 1, 0, 1])
  const visitRaster = Uint8Array.from([1, 1, 0, 1])
  assert.strictEqual(hasUnvisitedSailCells(visitRaster, sailMask), false)
})

test('hasUnvisitedSailCells is true when a sail cell is still unvisited', () => {
  const sailMask = Uint8Array.from([1, 1, 0, 1])
  const visitRaster = Uint8Array.from([1, 0, 0, 0])
  assert.strictEqual(hasUnvisitedSailCells(visitRaster, sailMask), true)
})
