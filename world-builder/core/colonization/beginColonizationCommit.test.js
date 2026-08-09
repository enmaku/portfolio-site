import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

/**
 * @param {Partial<{
 *   arable: number,
 *   timber: number,
 *   riverAtLanding: boolean,
 *   startingPopulation: number,
 * }>} [options]
 */
function geographyDoc(options = {}) {
  const cellCount = 16
  const arableValue = options.arable ?? 1
  const timberValue = options.timber ?? 1
  const arableRaster = new Float32Array(cellCount).fill(arableValue)
  const timberRaster = new Float32Array(cellCount).fill(timberValue)
  const riverCorridorMask = new Uint8Array(cellCount)
  if (options.riverAtLanding !== false) {
    riverCorridorMask[2 * 4 + 1] = 1
  }

  return {
    geographySeed: 42,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster,
    timberRaster,
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
  }
}

/**
 * Coastal fixture whose landing (4,5) classifies as a port: left columns are ocean, the
 * rest is well-viable grassland. A salt node at the landing gives the port export value
 * but no local food.
 */
function portGeographyDoc() {
  const width = 10
  const height = 10
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      elevation[y * width + x] = 0.1
    }
  }
  return {
    geographySeed: 7,
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(cellCount),
    timberRaster: new Float32Array(cellCount),
    metalsRaster: new Float32Array(cellCount),
    movementCost: new Float32Array(cellCount).fill(1),
    fields: {
      elevation,
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    saltNodes: [{ x: 4, y: 5, score: 5 }],
    metalNodes: [],
    coastalNodes: [],
  }
}

test('beginColonizationCommit off-map import lets a food-poor founding port survive', async () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 4, y: 5 }
  slice.colonistSettings.startingPopulation = 100
  slice.colonistSettings.threeDayHaulDistance = 2

  const next = await beginColonizationCommit(slice, portGeographyDoc())

  assert.ok(next.settlements[0].population > 0)
  assert.strictEqual(next.settlements[0].status, 'living')
  // External may be spent down to zero funding last-line food imports at 2.5×.
  assert.ok((next.externalTradeAccounts[next.settlements[0].id] ?? 0) >= 0)
})

test('beginColonizationCommit enters running with founding settlement and history log', async () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 120
  slice.colonistSettings.threeDayHaulDistance = 2

  const next = await beginColonizationCommit(slice, geographyDoc())

  assert.strictEqual(next.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  assert.strictEqual(next.epoch, 0)
  assert.strictEqual(next.settlements.length, 1)
  assert.strictEqual(next.settlements[0].x, 1)
  assert.strictEqual(next.settlements[0].y, 2)
  assert.ok(next.settlements[0].population <= 120)
  assert.ok(next.settlements[0].population > 0)
  assert.ok(next.settlements[0].tier != null)
  assert.strictEqual(next.historyLog[0].kind, 'founding')
  assert.strictEqual(next.historyLog[0].epoch, 0)
  assert.ok(next.historyLog.some((e) => e.kind === 'faction_emerged'))
  assert.ok(typeof next.realmId === 'string' && next.realmId.length > 0)
  const settlementId = next.settlements[0].id
  assert.ok(Array.isArray(next.primaryClaim[settlementId]))
  assert.ok(next.primaryClaim[settlementId].some((cell) => cell.x === 1 && cell.y === 2))
  assert.ok(next.populationCollapseRaster instanceof Float32Array)
  assert.strictEqual(next.populationCollapseRaster.length, 16)
  assert.ok(next.populationCollapseRaster.some((value) => value > 0))
})

test('beginColonizationCommit mints a founding faction for the landing settlement', async () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 120
  slice.colonistSettings.threeDayHaulDistance = 2

  const next = await beginColonizationCommit(slice, geographyDoc())
  const founding = next.settlements[0]
  assert.ok(founding.factionId)
  assert.strictEqual(next.factions.length, 1)
  assert.strictEqual(next.factions[0].status, 'active')
  assert.strictEqual(next.factions[0].capitalSettlementId, founding.id)
  assert.deepStrictEqual(next.factions[0].settlementIds, [founding.id])
  assert.strictEqual(founding.factionId, next.factions[0].id)
  assert.ok(next.historyLog.some((e) => e.kind === 'faction_emerged' && e.cause === 'founding'))
})

test('beginColonizationCommit clamps starting population and keeps founding history as epoch 0 anchor', async () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 50_000
  slice.colonistSettings.threeDayHaulDistance = 1

  const next = await beginColonizationCommit(slice, geographyDoc({ arable: 0.1, timber: 0.1 }))

  assert.ok(next.settlements[0].population < 50_000)
  assert.strictEqual(next.historyLog[0].kind, 'founding')
  assert.strictEqual(next.historyLog[0].epoch, 0)
  assert.strictEqual(next.historyLog[0].colonistSettings.startingPopulation, 50_000)
})

test('beginColonizationCommit non-sustain path when freshwater fails', async () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 120
  slice.colonistSettings.threeDayHaulDistance = 1

  const doc = geographyDoc({ riverAtLanding: false })
  doc.fields.rainfall.fill(0)
  doc.biomes.fill(BIOMES.DESERT)

  const next = await beginColonizationCommit(slice, doc)

  assert.strictEqual(next.settlements[0].population, 0)
  assert.strictEqual(next.settlements[0].tier, null)
  assert.strictEqual(next.settlements[0].status, 'ruin')
  assert.strictEqual(next.historyLog[0].kind, 'founding')
  assert.ok(next.historyLog.some((entry) => entry.kind === 'settlement_abandoned'))
})

test('beginColonizationCommit is deterministic for same geography and colonist inputs', async () => {
  const build = async () => {
    const slice = createDefaultColonizationSlice()
    slice.colonizationPhase = COLONIZATION_PHASE_SETUP
    slice.foundingLanding = { x: 1, y: 2 }
    slice.colonistSettings.startingPopulation = 200
    slice.colonistSettings.threeDayHaulDistance = 2
    return beginColonizationCommit(slice, geographyDoc())
  }

  const a = await build()
  const b = await build()
  assert.strictEqual(a.settlements[0].population, b.settlements[0].population)
  assert.strictEqual(a.settlements[0].tier, b.settlements[0].tier)
  assert.deepStrictEqual(a.primaryClaim, b.primaryClaim)
})

test('beginColonizationCommit is a no-op without landing or outside setup', async () => {
  const noLanding = createDefaultColonizationSlice()
  noLanding.colonizationPhase = COLONIZATION_PHASE_SETUP
  assert.strictEqual(await beginColonizationCommit(noLanding, geographyDoc()), noLanding)

  const terrain = createDefaultColonizationSlice()
  terrain.foundingLanding = { x: 0, y: 0 }
  assert.strictEqual(await beginColonizationCommit(terrain, geographyDoc()), terrain)
})
