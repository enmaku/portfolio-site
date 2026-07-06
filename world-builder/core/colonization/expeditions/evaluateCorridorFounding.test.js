import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateFirstViableCorridorCandidate } from './evaluateCorridorFounding.js'

test('evaluateFirstViableCorridorCandidate tries later corridor candidates after an earlier rejection', () => {
  const candidates = [
    {
      x: 1,
      y: 1,
      node: { x: 1, y: 1, primaryType: 'surplus_basin', tags: {}, exhausted: false },
    },
    {
      x: 2,
      y: 1,
      node: { x: 2, y: 1, primaryType: 'haul_junction', tags: {}, exhausted: false },
    },
  ]
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: Float32Array.from([0, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 0]),
    timberRaster: new Float32Array(16).fill(1),
    movementCost: new Float32Array(16).fill(1),
    fields: {
      elevation: new Float32Array(16).fill(0.55),
      temperature: new Float32Array(16).fill(0.5),
      rainfall: new Float32Array(16).fill(0.6),
      drainage: new Float32Array(16).fill(0.2),
      salinity: new Float32Array(16).fill(0.1),
    },
    biomes: new Uint8Array(16).fill(3),
    lakeMask: new Uint8Array(16),
    riverCorridorMask: Uint8Array.from({ length: 16 }, (_, index) => (index === 6 ? 1 : 0)),
    saltNodes: [],
  }

  const result = evaluateFirstViableCorridorCandidate(
    candidates,
    [
      { id: 'origin', x: 0, y: 0, status: 'living' },
      { id: 'occupied', x: 1, y: 1, status: 'living' },
    ],
    {
      threeDayHaulDistance: 2,
      startingPopulation: 50,
      yieldModifier: 'typical',
      epochBatch: 1,
    },
    worldDocument,
    [],
  )

  assert.ok(result && 'candidate' in result)
  assert.strictEqual(result.candidate.x, 2)
  assert.strictEqual(result.candidate.y, 1)
})
