import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifySettlementMaritimeRole,
  isPortSettlement,
} from './classifySettlementMaritimeRole.js'

function makeCoastalDoc() {
  const gridWidth = 32
  const gridHeight = 32
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.6)
  for (let x = 0; x < gridWidth; x += 1) {
    elevation[x] = 0.2
    elevation[gridWidth + x] = 0.2
  }
  return {
    geographySeed: 1,
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    coastalNodes: [{ x: 10, y: 4, kind: 'mouth' }],
    biomes: new Uint8Array(cellCount),
  }
}

test('isPortSettlement is true for ocean-adjacent founding-landing-class coast', () => {
  const doc = makeCoastalDoc()
  const role = classifySettlementMaritimeRole(doc, { x: 10, y: 4 })
  assert.strictEqual(role, 'port')
  assert.strictEqual(isPortSettlement(role), true)
})

test('classifySettlementMaritimeRole marks river sail pin as inland sail not port', () => {
  const gridWidth = 5
  const gridHeight = 5
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.65)
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[12] = 1
  const doc = {
    geographySeed: 2,
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    coastalNodes: [],
    biomes: new Uint8Array(cellCount),
  }
  const role = classifySettlementMaritimeRole(doc, { x: 2, y: 2 })
  assert.strictEqual(role, 'inland_sail')
  assert.strictEqual(isPortSettlement(role), false)
})
