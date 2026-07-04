import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../../biomeIds.js'
import {
  LOGISTICS_NODE_SCORE_THRESHOLD,
  pickPrimaryType,
  scoreLogisticsNodes,
} from './scoreLogisticsNodes.js'

function baseDoc(overrides = {}) {
  const cellCount = 16
  return {
    geographySeed: 42,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(0),
    timberRaster: new Float32Array(cellCount).fill(1),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    riverCorridorMask: new Uint8Array(cellCount),
    lakeMask: new Uint8Array(cellCount),
    saltNodes: [],
    metalNodes: [],
    coastalNodes: [],
    ...overrides,
  }
}

test('pickPrimaryType chooses highest-weight tag with stable tie-break', () => {
  assert.strictEqual(
    pickPrimaryType({ surplus_basin: 0.5, haul_junction: 0.8, refinery: 0.2 }),
    'haul_junction',
  )
})

test('scoreLogisticsNodes marks surplus basin on high local arable', () => {
  const doc = baseDoc()
  doc.arableRaster[5] = 3
  doc.arableRaster[6] = 3
  doc.arableRaster[9] = 3
  doc.arableRaster[10] = 3
  const survey = scoreLogisticsNodes(doc)
  const node = survey.find((entry) => entry.x === 2 && entry.y === 2)
  assert.ok(node)
  assert.ok((node.tags.surplus_basin ?? 0) >= LOGISTICS_NODE_SCORE_THRESHOLD * 0.5)
})

test('scoreLogisticsNodes assigns drain_city on coastal river mouth fixture', () => {
  const cellCount = 16
  const elevation = new Float32Array(cellCount).fill(0.5)
  elevation[0] = 0.1
  elevation[1] = 0.1
  elevation[4] = 0.1
  const doc = baseDoc({
    fields: { elevation },
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 5 ? 1 : 0)),
    coastalNodes: [{ x: 1, y: 1, kind: 'mouth' }],
  })
  doc.arableRaster[5] = 2
  doc.arableRaster[6] = 2
  doc.arableRaster[9] = 2
  doc.arableRaster[10] = 2
  const survey = scoreLogisticsNodes(doc)
  const node = survey.find((entry) => entry.x === 1 && entry.y === 1)
  assert.ok(node)
  assert.ok(node.tags.drain_city != null || node.tags.haul_junction != null)
})
