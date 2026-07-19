import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneWorldDocument } from '../cloneWorldDocument.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_PHASE_TERRAIN,
  DEFAULT_LAND_EXPEDITION_RANGE,
  DEFAULT_INLAND_SAIL_EXPEDITION_RANGE,
  DEFAULT_OPEN_SEA_EXPEDITION_RANGE,
  DEFAULT_PEOPLE_PER_HABITABLE_CELL,
  DEFAULT_POPULATION_DENSITY,
  MAX_LAND_EXPEDITION_RANGE,
  MAX_PEOPLE_PER_HABITABLE_CELL,
  MAX_POPULATION_DENSITY,
  MAX_THREE_DAY_HAUL_DISTANCE,
  MIN_INLAND_SAIL_EXPEDITION_RANGE,
  MIN_PEOPLE_PER_HABITABLE_CELL,
  MIN_POPULATION_DENSITY,
  cloneColonizationSlice,
  createDefaultColonistSettings,
  createDefaultColonizationSlice,
  mergeColonizationSessions,
  resolveColonistSettings,
  resolveColonizationSlice,
  serializeColonizationSessionForStorage,
} from './createDefaultColonizationSlice.js'

test('createDefaultColonizationSlice starts in terrain with empty scaffolding', () => {
  const slice = createDefaultColonizationSlice()

  assert.strictEqual(slice.colonizationPhase, COLONIZATION_PHASE_TERRAIN)
  assert.strictEqual(slice.epoch, 0)
  assert.strictEqual(slice.foundingLanding, null)
  assert.strictEqual(slice.realmId, null)
  assert.deepStrictEqual(slice.settlements, [])
  assert.deepStrictEqual(slice.historyLog, [])
  assert.deepStrictEqual(slice.primaryClaim, {})
  assert.strictEqual(slice.populationCollapseRaster, null)
  assert.deepStrictEqual(slice.notableFigures, [])
  assert.deepStrictEqual(slice.colonistSettings, createDefaultColonistSettings())
})

test('createDefaultColonistSettings provides concrete defaults for every field', () => {
  const settings = createDefaultColonistSettings()

  assert.strictEqual(typeof settings.threeDayHaulDistance, 'number')
  assert.ok(settings.threeDayHaulDistance > 0)
  assert.ok(settings.threeDayHaulDistance <= MAX_THREE_DAY_HAUL_DISTANCE)
  assert.strictEqual(typeof settings.startingPopulation, 'number')
  assert.ok(settings.startingPopulation > 0)
  assert.strictEqual(settings.peoplePerHabitableCell, DEFAULT_PEOPLE_PER_HABITABLE_CELL)
  assert.strictEqual(settings.populationDensity, DEFAULT_POPULATION_DENSITY)
  assert.strictEqual(settings.yieldModifier, 'typical')
  assert.strictEqual(settings.landExpeditionRange, DEFAULT_LAND_EXPEDITION_RANGE)
  assert.strictEqual(settings.inlandSailExpeditionRange, DEFAULT_INLAND_SAIL_EXPEDITION_RANGE)
  assert.strictEqual(settings.openSeaExpeditionRange, DEFAULT_OPEN_SEA_EXPEDITION_RANGE)
})

test('resolveColonistSettings clamps people per habitable cell', () => {
  assert.strictEqual(
    resolveColonistSettings({ peoplePerHabitableCell: 999 }).peoplePerHabitableCell,
    MAX_PEOPLE_PER_HABITABLE_CELL,
  )
  assert.strictEqual(
    resolveColonistSettings({ peoplePerHabitableCell: 1 }).peoplePerHabitableCell,
    MIN_PEOPLE_PER_HABITABLE_CELL,
  )
})

test('resolveColonistSettings clamps population density', () => {
  assert.strictEqual(
    resolveColonistSettings({ populationDensity: 99 }).populationDensity,
    MAX_POPULATION_DENSITY,
  )
  assert.strictEqual(
    resolveColonistSettings({ populationDensity: 0.1 }).populationDensity,
    MIN_POPULATION_DENSITY,
  )
})

test('createDefaultColonizationSlice includes empty trade accounts and route state', () => {
  const slice = createDefaultColonizationSlice()
  assert.deepStrictEqual(slice.tradeAccounts, { obligations: [], balancesBySettlementId: {} })
  assert.deepStrictEqual(slice.externalTradeAccounts, {})
  assert.deepStrictEqual(slice.tradeRouteState, { candidates: [], activeFlows: [] })
  assert.strictEqual(slice.lastTradeEpochResult, null)
})

test('serializeColonizationSessionForStorage round-trips trade accounts', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.tradeAccounts = {
    obligations: [
      { creditorSettlementId: 'a', debtorSettlementId: 'b', amountCp: 12 },
    ],
    balancesBySettlementId: { a: 12, b: -12 },
  }
  slice.externalTradeAccounts = { a: 5 }
  slice.tradeRouteState = {
    candidates: [
      {
        id: 'e1',
        fromSettlementId: 'a',
        toSettlementId: 'b',
        mode: 'overland',
        haulDistanceFraction: 0.5,
        capacityLb: 100,
        transportCostCpPerLb: 0.5,
      },
    ],
    activeFlows: [],
  }

  const revived = resolveColonizationSlice(serializeColonizationSessionForStorage(slice))
  assert.deepStrictEqual(revived.tradeAccounts.obligations, slice.tradeAccounts.obligations)
  assert.strictEqual(revived.externalTradeAccounts.a, 5)
  assert.strictEqual(revived.tradeRouteState.candidates.length, 1)
  assert.strictEqual(revived.colonistSettings.openSeaExpeditionRange, DEFAULT_OPEN_SEA_EXPEDITION_RANGE)
})

test('resolveColonistSettings clamps expedition range multipliers', () => {
  const settings = resolveColonistSettings({
    landExpeditionRange: 99,
    inlandSailExpeditionRange: 0,
    openSeaExpeditionRange: 99,
  })
  assert.strictEqual(settings.landExpeditionRange, MAX_LAND_EXPEDITION_RANGE)
  assert.strictEqual(settings.inlandSailExpeditionRange, MIN_INLAND_SAIL_EXPEDITION_RANGE)
  assert.strictEqual(settings.openSeaExpeditionRange, 12)
})

test('resolveColonistSettings migrates legacy sailExpeditionRange to inland sail range', () => {
  const settings = resolveColonistSettings({ sailExpeditionRange: 5 })
  assert.strictEqual(settings.inlandSailExpeditionRange, 5)
  assert.strictEqual(settings.openSeaExpeditionRange, DEFAULT_OPEN_SEA_EXPEDITION_RANGE)
})

test('serializeColonizationSessionForStorage preserves expedition range settings and route segment mode', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.colonistSettings.landExpeditionRange = 3
  slice.colonistSettings.inlandSailExpeditionRange = 5
  slice.colonistSettings.openSeaExpeditionRange = 10
  slice.roads = [{ cells: [{ x: 1, y: 1 }], mode: 'sail', settlementIds: ['a', 'b'] }]

  const serialized = serializeColonizationSessionForStorage(slice)
  const revived = resolveColonizationSlice(serialized)

  assert.strictEqual(revived.colonistSettings.landExpeditionRange, 3)
  assert.strictEqual(revived.colonistSettings.inlandSailExpeditionRange, 5)
  assert.strictEqual(revived.colonistSettings.openSeaExpeditionRange, 10)
  assert.strictEqual(revived.roads[0].mode, 'inland_sail')
})

test('resolveColonistSettings clamps three-day haul distance to the scale calibration max', () => {
  const settings = resolveColonistSettings({ threeDayHaulDistance: MAX_THREE_DAY_HAUL_DISTANCE + 50 })
  assert.strictEqual(settings.threeDayHaulDistance, MAX_THREE_DAY_HAUL_DISTANCE)
})

test('serializeColonizationSessionForStorage omits derived collapse and visit rasters', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.populationCollapseRaster = new Float32Array([0, 12, 3])
  slice.visitedCells = Uint8Array.from([1, 0, 1])
  slice.primaryClaim = { s1: [{ x: 1, y: 2 }] }

  const serialized = serializeColonizationSessionForStorage(slice)
  assert.strictEqual('populationCollapseRaster' in serialized, false)
  assert.strictEqual('visitedCells' in serialized, false)
  assert.strictEqual('primaryClaim' in serialized, false)

  const revived = resolveColonizationSlice(serialized)
  assert.strictEqual(revived.populationCollapseRaster, null)
  assert.strictEqual(revived.visitedCells, null)
  assert.deepStrictEqual(revived.primaryClaim, {})
})

test('serializeColonizationSessionForStorage keeps only logistics survey patches', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.logisticsNodeSurvey = [
    {
      x: 1,
      y: 2,
      primaryType: 'surplus_basin',
      tags: { surplus_basin: 0.8 },
      exhausted: false,
      founded: false,
    },
    {
      x: 3,
      y: 4,
      primaryType: 'refinery',
      tags: { refinery: 0.6 },
      exhausted: true,
      founded: false,
    },
  ]

  const serialized = serializeColonizationSessionForStorage(slice)

  assert.deepStrictEqual(serialized.logisticsNodeSurvey, [
    {
      x: 3,
      y: 4,
      primaryType: 'refinery',
      exhausted: true,
    },
  ])
})

test('resolveColonizationSlice ignores persisted visit raster payloads', () => {
  const fromArray = resolveColonizationSlice({
    visitedCells: Array.from({ length: 16 }, (_, i) => (i === 5 ? 1 : 0)),
  })
  assert.strictEqual(fromArray.visitedCells, null)
})

test('mergeColonizationSessions prefers running over setup', () => {
  const setup = createDefaultColonizationSlice()
  setup.colonizationPhase = COLONIZATION_PHASE_SETUP
  setup.foundingLanding = { x: 1, y: 2 }

  const running = createDefaultColonizationSlice()
  running.colonizationPhase = COLONIZATION_PHASE_RUNNING
  running.epoch = 50
  running.settlements = [{ id: 's1', population: 100 }]

  assert.strictEqual(
    mergeColonizationSessions(setup, running).colonizationPhase,
    COLONIZATION_PHASE_RUNNING,
  )
  assert.strictEqual(
    mergeColonizationSessions(running, setup).colonizationPhase,
    COLONIZATION_PHASE_RUNNING,
  )
})

test('cloneColonizationSlice preserves in-memory collapse raster', () => {
  const slice = createDefaultColonizationSlice()
  slice.populationCollapseRaster = new Float32Array([0, 12, 3])
  const cloned = cloneColonizationSlice(slice)
  assert.ok(cloned.populationCollapseRaster instanceof Float32Array)
  assert.deepStrictEqual([...cloned.populationCollapseRaster], [0, 12, 3])
  assert.notStrictEqual(cloned.populationCollapseRaster, slice.populationCollapseRaster)
})

test('resolveColonizationSlice ignores persisted collapse raster payloads', () => {
  const fromArray = resolveColonizationSlice({
    populationCollapseRaster: [0, 12, 3],
  })
  assert.strictEqual(fromArray.populationCollapseRaster, null)

  const fromIndexMap = resolveColonizationSlice({
    populationCollapseRaster: { 0: 0, 1: 12, 2: 3 },
  })
  assert.strictEqual(fromIndexMap.populationCollapseRaster, null)
})

test('resolveColonizationSlice strips legacy committedTips payloads', () => {
  const revived = resolveColonizationSlice({
    committedTips: [{ epoch: 0, settlements: [{ id: 's1' }] }],
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
  })
  assert.strictEqual('committedTips' in revived, false)
})

test('resolveColonizationSlice backfills settlement map numbers for legacy sessions', () => {
  const revived = resolveColonizationSlice({
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
    settlements: [
      { id: 'later', x: 2, y: 2, foundedEpoch: 3 },
      { id: 'founding', x: 1, y: 1, foundedEpoch: 0 },
    ],
  })
  assert.deepEqual(
    revived.settlements.map((row) => ({ id: row.id, mapNumber: row.mapNumber })),
    [
      { id: 'later', mapNumber: 2 },
      { id: 'founding', mapNumber: 1 },
    ],
  )
})

test('serializeColonizationSessionForStorage omits legacy committedTips from output', () => {
  const slice = resolveColonizationSlice({
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
    committedTips: [{ epoch: 0, claimMap: { s1: [{ x: 0, y: 0 }] } }],
  })
  const serialized = serializeColonizationSessionForStorage(slice)
  assert.strictEqual('committedTips' in serialized, false)
})

test('cloneWorldDocument copies colonization slice independently', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = 'setup'
  slice.foundingLanding = { x: 3, y: 4 }
  slice.colonistSettings.threeDayHaulDistance = 12
  slice.settlements = [{ id: 's1', x: 3, y: 4, tier: 'outpost', population: 50 }]
  slice.historyLog = [{ kind: 'founding', epoch: 0 }]
  slice.realmId = 'realm-1'

  const doc = {
    geographySeed: 1,
    prevailingWindDegrees: 0,
    gridWidth: 2,
    gridHeight: 2,
    fields: {
      elevation: new Float32Array(4),
      temperature: new Float32Array(4),
      rainfall: new Float32Array(4),
      drainage: new Float32Array(4),
      salinity: new Float32Array(4),
    },
    biomes: new Uint8Array(4),
    displayBiomes: new Uint8Array(4),
    biomeCatalog: [],
    generatedAt: 'test',
    pipelineStage: 'derivedGeography',
    ...slice,
  }

  const cloned = cloneWorldDocument(doc)

  assert.strictEqual(cloned.colonizationPhase, 'setup')
  assert.deepStrictEqual(cloned.foundingLanding, { x: 3, y: 4 })
  assert.strictEqual(cloned.colonistSettings.threeDayHaulDistance, 12)
  assert.notStrictEqual(cloned.colonistSettings, doc.colonistSettings)
  assert.notStrictEqual(cloned.foundingLanding, doc.foundingLanding)
  assert.notStrictEqual(cloned.settlements, doc.settlements)
  assert.notStrictEqual(cloned.historyLog, doc.historyLog)

  cloned.foundingLanding.x = 99
  cloned.settlements[0].population = 0
  cloned.historyLog.push({ kind: 'other', epoch: 1 })
  cloned.colonistSettings.threeDayHaulDistance = 1

  assert.strictEqual(doc.foundingLanding.x, 3)
  assert.strictEqual(doc.settlements[0].population, 50)
  assert.strictEqual(doc.historyLog.length, 1)
  assert.strictEqual(doc.colonistSettings.threeDayHaulDistance, 12)
})
