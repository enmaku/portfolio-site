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

test('classifySettlementMaritimeRole marks landlocked river sail as inland sail not port', () => {
  const gridWidth = 32
  const gridHeight = 32
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.65)
  const riverCorridorMask = new Uint8Array(cellCount)
  const pin = { x: 16, y: 16 }
  riverCorridorMask[pin.y * gridWidth + pin.x] = 1
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
  const role = classifySettlementMaritimeRole(doc, pin)
  assert.strictEqual(role, 'inland_sail')
  assert.strictEqual(isPortSettlement(role), false)
})

test('classifySettlementMaritimeRole marks ocean-connected river pin as port', () => {
  const gridWidth = 8
  const gridHeight = 8
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.65)
  for (let x = 0; x < gridWidth; x += 1) {
    elevation[(gridHeight - 1) * gridWidth + x] = 0.2
  }
  const riverCorridorMask = new Uint8Array(cellCount)
  for (let y = 2; y < gridHeight - 1; y += 1) {
    riverCorridorMask[y * gridWidth + 3] = 1
  }
  const doc = {
    geographySeed: 3,
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    coastalNodes: [],
    biomes: new Uint8Array(cellCount),
  }

  const role = classifySettlementMaritimeRole(doc, { x: 3, y: 2 })
  assert.strictEqual(role, 'port')
  assert.strictEqual(isPortSettlement(role), true)
})

test('classifySettlementMaritimeRole marks near-coast landlocked lake as inland sail not port', () => {
  const gridWidth = 64
  const gridHeight = 64
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.65)
  for (let x = 0; x < gridWidth; x += 1) {
    elevation[(gridHeight - 1) * gridWidth + x] = 0.2
  }
  const lakeMask = new Uint8Array(cellCount)
  for (let y = 58; y <= 60; y += 1) {
    for (let x = 30; x <= 34; x += 1) {
      lakeMask[y * gridWidth + x] = 1
    }
  }
  const doc = {
    geographySeed: 4,
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask,
    riverCorridorMask: new Uint8Array(cellCount),
    coastalNodes: [],
    biomes: new Uint8Array(cellCount),
  }

  const role = classifySettlementMaritimeRole(doc, { x: 32, y: 59 })
  assert.strictEqual(role, 'inland_sail')
  assert.strictEqual(isPortSettlement(role), false)
})
