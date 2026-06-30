import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'
import { buildPhysicalRiverCorridorMask } from './riverCorridorDisplay.js'
import {
  assembleRiverNetwork,
  assembleRiverNetworkFromFields,
  assembleRiverNetworkFromValidationSlice,
  buildNavigableRiverMask,
  buildUpstreamAdjacency,
  countMarkedCells,
  countUpstreamDrainageNeighbors,
  isRiverHeadwaterOnCenterline,
  isRiverHeadwaterOnDrainageField,
  isRiverJunctionOnDrainageField,
  isRiverMouthDrainageCell,
  readRiverNetworkFromWorldDocument,
  selectCoastalMouths,
  traceRiverChainSegments,
  traceRiverUpstream,
} from './riverNetwork.js'
import { buildRiverOverlayRgba } from '../../renderer/buildRiverOverlayCanvas.js'

/**
 * @param {number} width
 * @param {number} height
 */
function emptyOcean(width, height) {
  return new Array(width * height).fill(false)
}

test('selectCoastalMouths keeps the largest discharge within merge radius', () => {
  const width = 20
  const flowAccumulation = new Float32Array(width * width)
  const strongMouth = 10 * width + 5
  const weakMouth = 10 * width + 8
  flowAccumulation[strongMouth] = 200
  flowAccumulation[weakMouth] = 40

  const selected = selectCoastalMouths(
    [weakMouth, strongMouth],
    flowAccumulation,
    width,
    6,
    10,
  )

  assert.deepEqual(selected, [strongMouth])
})

test('traceRiverUpstream marks tributaries above a mouth', () => {
  const width = 8
  const height = 4
  const cellCount = width * height
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount)
  const ocean = emptyOcean(width, height)
  const mask = new Uint8Array(cellCount)

  for (let x = 3; x <= 6; x += 1) {
    flowDirection[2 * width + x] = 4
    flowAccumulation[2 * width + x] = 10 + x * 10
  }

  const mouth = 2 * width + 6
  const junction = 2 * width + 5
  const headwater = 2 * width + 3

  const upstream = buildUpstreamAdjacency({
    cellCount,
    width,
    flowDirection,
    ocean,
  })
  traceRiverUpstream(mouth, mask, flowAccumulation, upstream, 10)

  assert.equal(mask[mouth], 1)
  assert.equal(mask[junction], 1)
  assert.equal(mask[headwater], 1)
})

test('isRiverHeadwaterOnCenterline identifies source cells on the centerline', () => {
  const width = 6
  const height = 4
  const centerline = new Uint8Array(width * height)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const headwater = 1 * width + 1
  const downstream = 1 * width + 2
  centerline[headwater] = 1
  centerline[downstream] = 1
  flowDirection[headwater] = 4

  assert.equal(
    isRiverHeadwaterOnCenterline(headwater, centerline, flowDirection, width, height),
    true,
  )
  assert.equal(
    isRiverHeadwaterOnCenterline(downstream, centerline, flowDirection, width, height),
    false,
  )
})

test('traceRiverChainSegments emits headwater-to-junction chains', () => {
  const width = 8
  const height = 4
  const centerline = new Uint8Array(width * height)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const headwater = 2 * width + 1
  const junction = 2 * width + 4
  const mouth = 2 * width + 6
  centerline[headwater] = 1
  centerline[junction] = 1
  centerline[mouth] = 1
  flowDirection[headwater] = 4
  flowDirection[junction] = 4
  flowDirection[mouth] = 4

  const segments = traceRiverChainSegments(centerline, flowDirection, width, height)
  const flat = segments.flat()

  assert.ok(flat.includes(headwater))
  assert.ok(flat.includes(junction))
})

test('buildRiverNetworkMask routes lake overflow outlets downstream', () => {
  const width = 7
  const height = 5
  const cellCount = width * height
  const flowAccumulation = new Float32Array(cellCount).fill(1)
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const ocean = Array.from({ length: cellCount }, () => false)
  const lakeMask = new Uint8Array(cellCount)
  const lakeIdByCell = new Int32Array(cellCount).fill(-1)

  lakeMask[2 * width + 2] = 1
  lakeIdByCell[2 * width + 2] = 0
  flowAccumulation[2 * width + 3] = 20
  flowDirection[2 * width + 3] = 4
  flowAccumulation[2 * width + 4] = 18
  flowDirection[2 * width + 4] = 4
  flowAccumulation[2 * width + 5] = 16
  flowDirection[2 * width + 5] = 4
  ocean[2 * width + 6] = true

  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    lakeMask,
    overflowLakeIds: new Set([0]),
    lakeIdByCell,
    navigableFlowCutoffScale: 0.1,
  })

  assert.strictEqual(mask[2 * width + 3], 1)
  assert.ok(mask[2 * width + 4] === 1 || mask[2 * width + 5] === 1)
})

test('isRiverHeadwaterOnDrainageField matches drainage-field upstream count', () => {
  const width = 6
  const height = 4
  const cellCount = width * height
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const ocean = emptyOcean(width, height)
  const headwater = 1 * width + 1
  const downstream = 1 * width + 2
  flowDirection[headwater] = 4

  assert.equal(
    isRiverHeadwaterOnDrainageField(headwater, width, height, flowDirection, ocean),
    true,
  )
  assert.equal(
    isRiverHeadwaterOnDrainageField(downstream, width, height, flowDirection, ocean),
    false,
  )
  assert.equal(
    countUpstreamDrainageNeighbors(downstream, width, height, flowDirection, ocean),
    1,
  )
})

test('isRiverJunctionOnDrainageField detects confluences on the drainage field', () => {
  const width = 8
  const height = 4
  const cellCount = width * height
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const ocean = emptyOcean(width, height)
  const junction = 2 * width + 4
  flowDirection[2 * width + 3] = 4
  flowDirection[2 * width + 5] = 3
  flowDirection[junction] = 4

  assert.equal(
    isRiverJunctionOnDrainageField(junction, width, height, flowDirection, ocean),
    true,
  )
})

test('isRiverMouthDrainageCell requires ocean downstream', () => {
  const ocean = [false, true, false, false]
  assert.equal(isRiverMouthDrainageCell(1, ocean), true)
  assert.equal(isRiverMouthDrainageCell(0, ocean), false)
})

test('buildNavigableRiverMask marks cells along graph edges', () => {
  const width = 4
  const height = 4
  const graph = {
    nodes: [],
    edges: [{ fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [5, 6, 7] }],
  }
  const mask = buildNavigableRiverMask(graph, width, height)
  assert.equal(mask[5], 1)
  assert.equal(mask[6], 1)
  assert.equal(mask[7], 1)
  assert.equal(mask[0], 0)
})

test('assembleRiverNetworkFromFields prefers persisted centerline over graph edge cells', () => {
  const width = 6
  const height = 4
  const cellCount = width * height
  const centerline = new Uint8Array(cellCount)
  centerline[7] = 1
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount).fill(0.1)
  const graph = {
    nodes: [],
    edges: [{ fromNodeId: 'a', toNodeId: 'b', navigable: true, cellPath: [5, 6, 7, 8] }],
  }

  const network = assembleRiverNetworkFromFields({
    riverNetworkMask: centerline,
    flowDirection,
    flowAccumulation,
    riverGraph: graph,
    width,
    height,
  })

  assert.ok(network)
  assert.equal(network.centerline, centerline)
  assert.equal(countMarkedCells(network.centerline), 1)
})

test('assembleRiverNetworkFromValidationSlice assembles contract from slice fields', () => {
  const width = 4
  const height = 4
  const cellCount = width * height
  const centerline = new Uint8Array(cellCount)
  centerline[5] = 1
  const corridor = new Uint8Array(cellCount)
  corridor[5] = 1
  corridor[6] = 1
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const drainage = new Float32Array(cellCount).fill(0.2)
  const graph = { nodes: [], edges: [] }

  const network = assembleRiverNetworkFromValidationSlice({
    fields: { drainage },
    riverNetworkMask: centerline,
    riverCorridorMask: corridor,
    flowDirection,
    riverGraph: graph,
    gridWidth: width,
    gridHeight: height,
  })

  assert.ok(network)
  assert.equal(network.centerline, centerline)
  assert.equal(network.corridor, corridor)
  assert.equal(network.flow.accumulation, drainage)
})

test('assembleRiverNetwork and readRiverNetworkFromWorldDocument round-trip contract fields', () => {
  const width = 4
  const height = 4
  const cellCount = width * height
  const centerline = new Uint8Array(cellCount)
  centerline[5] = 1
  centerline[6] = 1
  const corridor = new Uint8Array(cellCount)
  corridor[5] = 1
  corridor[6] = 1
  corridor[9] = 1
  const flowDirection = new Int16Array(cellCount).fill(-1)
  flowDirection[5] = 4
  const flowAccumulation = new Float32Array(cellCount)
  flowAccumulation[5] = 20
  flowAccumulation[6] = 40
  const channelWidth = new Float32Array(cellCount)
  channelWidth[5] = 0.4
  channelWidth[6] = 0.8
  const graph = {
    nodes: [{ id: 'n0', x: 1, y: 1, kind: 'mouth' }],
    edges: [{ fromNodeId: 'n0', toNodeId: 'n0', navigable: true, cellPath: [5, 6] }],
  }

  const network = assembleRiverNetwork({
    centerline,
    corridor,
    flowDirection,
    flowAccumulation,
    channelWidth,
    graph,
    width,
    height,
  })

  assert.equal(network.centerline, centerline)
  assert.equal(network.corridor, corridor)
  assert.equal(network.flow.direction, flowDirection)
  assert.equal(network.graph, graph)
  assert.equal(countMarkedCells(network.corridor), 3)

  const doc = {
    geographySeed: 1,
    prevailingWindDegrees: 0,
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation: new Float32Array(cellCount),
      temperature: new Float32Array(cellCount),
      rainfall: new Float32Array(cellCount),
      drainage: flowAccumulation,
      salinity: new Float32Array(cellCount),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    biomeCatalog: [],
    generatedAt: '',
    pipelineStage: 'derivedGeography',
    riverNetworkMask: centerline,
    riverCorridorMask: corridor,
    channelWidth,
    flowDirection,
    riverGraph: graph,
  }

  const readBack = readRiverNetworkFromWorldDocument(doc)
  assert.ok(readBack)
  assert.equal(readBack.centerline, centerline)
  assert.equal(readBack.corridor, corridor)
  assert.equal(readBack.graph, graph)
})

test('painted corridor and renderer overlay agree on visible river cells', () => {
  const width = 12
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.65)
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount)
  const ocean = emptyOcean(width, height)
  const channelWidth = new Float32Array(cellCount)

  for (let x = 2; x <= 8; x += 1) {
    const idx = 4 * width + x
    flowDirection[idx] = 4
    flowAccumulation[idx] = 20 + x
    channelWidth[idx] = 0.2 + x * 0.05
  }
  ocean[4 * width + 9] = true
  flowDirection[4 * width + 8] = 4

  const centerline = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
  })
  const corridor = buildPhysicalRiverCorridorMask(centerline, width, height, {
    elevation,
    flowDirection,
    channelWidth,
    ocean,
  })
  const graph = { nodes: [], edges: [] }
  const network = assembleRiverNetwork({
    centerline,
    corridor,
    flowDirection,
    flowAccumulation,
    channelWidth,
    graph,
    width,
    height,
  })

  const biomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (network.corridor[idx]) biomes[idx] = BIOMES.RIVER_CORRIDOR
  }

  const rgbaFromContract = buildRiverOverlayRgba({
    geographySeed: 1,
    prevailingWindDegrees: 0,
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation,
      temperature: new Float32Array(cellCount),
      rainfall: new Float32Array(cellCount),
      drainage: flowAccumulation,
      salinity: new Float32Array(cellCount),
    },
    biomes,
    biomeCatalog: [],
    generatedAt: '',
    pipelineStage: 'derivedGeography',
    riverNetworkMask: network.centerline,
    riverCorridorMask: network.corridor,
    channelWidth,
    flowDirection,
    riverGraph: graph,
  })

  assert.ok(rgbaFromContract)
  let paintedCells = 0
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (network.corridor[idx]) paintedCells += 1
  }
  assert.ok(paintedCells > 0)

  let visibleRiverPixels = 0
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (rgbaFromContract[idx * 4 + 3] > 0) visibleRiverPixels += 1
  }
  assert.ok(visibleRiverPixels >= paintedCells)
})
