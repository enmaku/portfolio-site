import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { NODE_MAP_EDGE_MARGIN } from '../nodePlacementBounds.js'
import { deriveCoastalNodes } from './deriveCoastalNodes.js'

const width = 48
const height = 48

test('deriveCoastalNodes excludes river mouths within the map edge margin', () => {
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.1)
  const coastNavigability = new Float32Array(width * height).fill(0.8)

  const nodes = deriveCoastalNodes({
    riverGraph: {
      nodes: [
        { id: 'mouth-edge', x: 3, y: 3, kind: 'mouth' },
        { id: 'mouth-interior', x: 24, y: 24, kind: 'mouth' },
      ],
      edges: [],
    },
    coastNavigability,
    elevation,
    width,
    height,
  })

  assert.strictEqual(nodes.some((node) => node.x === 3 && node.y === 3), false)
  assert.strictEqual(nodes.some((node) => node.x === 24 && node.y === 24), true)

  const margin = NODE_MAP_EDGE_MARGIN
  for (const node of nodes) {
    assert.ok(node.x >= margin)
    assert.ok(node.y >= margin)
    assert.ok(node.x < width - margin)
    assert.ok(node.y < height - margin)
  }
})
