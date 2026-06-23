import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { runHydrologySubsteps } from './hydrologySubsteps.js'
import { computeFlowAccumulation, downstreamIndex } from './computeFlowAccumulation.js'
import { carveTemporaryRivers } from './seededTemporaryRiverCarve.js'
import {
  buildIncisedChannelMask,
  buildChannelWidthField,
  extractRiverNetworkFromIncisedChannels,
} from './extractRiverNetworkFromIncisedChannels.js'
import { computeCoastNavigability } from '../coast/computeCoastNavigability.js'

function makeYJunctionTerrain(width, height) {
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.2)
  const midY = Math.floor(height / 2)
  const junctionX = Math.floor(width * 0.55)
  const mouthX = width - 2

  for (let y = 1; y < height - 1; y += 1) {
    elevation[y * width + junctionX] = SEA_LEVEL + 0.35
    if (y <= midY) {
      elevation[y * width + 4] = SEA_LEVEL + 0.5 - y * 0.02
    } else {
      elevation[y * width + 4] = SEA_LEVEL + 0.5 - (height - 1 - y) * 0.02
    }
  }

  for (let x = junctionX; x <= mouthX; x += 1) {
    elevation[midY * width + x] = SEA_LEVEL + 0.12
  }

  return elevation
}

test('buildIncisedChannelMask traces only from incised mouths meeting flow cutoff', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.35 * x) / width
    }
  }
  const rainfall = new Float32Array(width * height).fill(1)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
  })
  const carved = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 42,
    inciseIterations: 2,
    streamPowerK: 0.004,
  })

  const channelMask = buildIncisedChannelMask({
    incisedCorridorMask: carved.corridorMask,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    coastNavigability: computeCoastNavigability({ elevation, width, height }),
  })

  let incisedCellInMask = false
  for (let idx = 0; idx < channelMask.length; idx += 1) {
    if (!channelMask[idx]) continue
    if (carved.corridorMask[idx]) incisedCellInMask = true
  }

  assert.ok(incisedCellInMask)
})

test('extractRiverNetworkFromIncisedChannels merges tributary discharge monotonically downstream', () => {
  const width = 40
  const height = 40
  const elevation = makeYJunctionTerrain(width, height)
  const rainfall = new Float32Array(width * height).fill(1)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
  })
  const carved = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 77,
    inciseIterations: 2,
    streamPowerK: 0.004,
  })

  const extracted = extractRiverNetworkFromIncisedChannels({
    elevation: carved.elevation,
    incisedCorridorMask: carved.corridorMask,
    rainfall,
    width,
    height,
    navigableFlowCutoffScale: 0.25,
  })

  let mergeIdx = -1
  for (let idx = 0; idx < width * height; idx += 1) {
    if (ocean[idx]) continue
    let upstreamCount = 0
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = (idx % width) + dx
        const ny = Math.floor(idx / width) + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nIdx = ny * width + nx
        if (ocean[nIdx]) continue
        if (downstreamIndex(nIdx, width, extracted.flowDirection) === idx) {
          upstreamCount += 1
        }
      }
    }
    if (upstreamCount >= 2) {
      mergeIdx = idx
      break
    }
  }

  assert.ok(mergeIdx >= 0, 'expected a tributary merge cell')

  let maxUpstreamFlow = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = (mergeIdx % width) + dx
      const ny = Math.floor(mergeIdx / width) + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (extracted.ocean[nIdx]) continue
      if (downstreamIndex(nIdx, width, extracted.flowDirection) === mergeIdx) {
        maxUpstreamFlow = Math.max(maxUpstreamFlow, extracted.flowAccumulation[nIdx])
      }
    }
  }

  assert.ok(
    extracted.flowAccumulation[mergeIdx] >= maxUpstreamFlow,
    'merge cell discharge should absorb upstream tributaries',
  )
})

test('extractRiverNetworkFromIncisedChannels places mouth nodes at coastal drainage cells', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.08 + (0.35 * x) / width
    }
  }
  const rainfall = new Float32Array(width * height).fill(1)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
  })
  const carved = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 11,
    inciseIterations: 2,
    streamPowerK: 0.004,
  })

  const extracted = extractRiverNetworkFromIncisedChannels({
    elevation: carved.elevation,
    incisedCorridorMask: carved.corridorMask,
    rainfall,
    width,
    height,
    navigableFlowCutoffScale: 0.2,
  })

  const mouths = extracted.riverGraph.nodes.filter((node) => node.kind === 'mouth')
  assert.ok(mouths.length > 0)
  for (const mouth of mouths) {
    const idx = mouth.y * width + mouth.x
    const downstreamIdx = downstreamIndex(idx, width, extracted.flowDirection)
    assert.ok(downstreamIdx >= 0)
    assert.ok(extracted.ocean[downstreamIdx])
  }
})

test('buildChannelWidthField is zero outside channel mask and positive inside major channels', () => {
  const width = 24
  const height = 24
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.3 * x) / width
    }
  }
  const rainfall = new Float32Array(width * height).fill(1)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
  })
  const carved = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 5,
    inciseIterations: 1,
    streamPowerK: 0.003,
  })
  const channelMask = buildIncisedChannelMask({
    incisedCorridorMask: carved.corridorMask,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    navigableFlowCutoffScale: 0.2,
    coastNavigability: computeCoastNavigability({ elevation, width, height }),
  })
  const widthField = buildChannelWidthField({
    flowAccumulation,
    channelMask,
    width,
    height,
  })

  let hasPositiveWidth = false
  for (let idx = 0; idx < widthField.length; idx += 1) {
    if (!channelMask[idx]) {
      assert.strictEqual(widthField[idx], 0)
    } else if (widthField[idx] > 0) {
      hasPositiveWidth = true
    }
  }
  assert.ok(hasPositiveWidth)
})

test('buildIncisedChannelMask resolves coast navigability from elevation when omitted', () => {
  const width = 24
  const height = 24
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.1 + (0.3 * x) / width
    }
  }
  const rainfall = new Float32Array(width * height).fill(1)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
  })
  const carved = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 5,
    inciseIterations: 1,
    streamPowerK: 0.003,
  })

  const withExplicit = buildIncisedChannelMask({
    incisedCorridorMask: carved.corridorMask,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    coastNavigability: computeCoastNavigability({ elevation, width, height }),
  })
  const withFallback = buildIncisedChannelMask({
    incisedCorridorMask: carved.corridorMask,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    elevation,
  })

  assert.deepStrictEqual(withFallback, withExplicit)
})

test('extractRiverNetworkFromIncisedChannels marks every graph edge as navigable', () => {
  const width = 24
  const height = 24
  const elevation = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      elevation[y * width + x] = x < width / 2 ? 0.9 : SEA_LEVEL + 0.05
    }
  }
  const rainfall = new Float32Array(width * height).fill(1)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    rainfall,
  })
  const carved = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 31,
    inciseIterations: 1,
    streamPowerK: 0.003,
  })

  const extracted = extractRiverNetworkFromIncisedChannels({
    elevation: carved.elevation,
    incisedCorridorMask: carved.corridorMask,
    rainfall,
    width,
    height,
    navigableFlowCutoffScale: 0.15,
  })

  if (extracted.riverGraph.edges.length > 0) {
    assert.ok(extracted.riverGraph.edges.every((edge) => edge.navigable))
  }
})

test('extractRiverNetworkFromIncisedChannels produces non-empty graph for default pipeline seed', () => {
  let state = createInitialPipelineState({
    geographySeed: 12345,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  const { state: hydrologyState } = runHydrologySubsteps(state)

  assert.ok(hydrologyState.riverGraph)
  assert.ok(hydrologyState.riverGraph.nodes.length > 0)
  assert.ok(hydrologyState.riverGraph.edges.length > 0)
})
