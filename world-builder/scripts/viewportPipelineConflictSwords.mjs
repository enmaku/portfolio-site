/**
 * Drive real createWorldBuilderMapViewport (Pixi mocked via the same harness as unit tests)
 * after full-resolution geography + colonization epochs. Asserts the viewport Graphics draw
 * path emits conquest swords — no sharp stub map / Text emoji.
 */
import { mock } from 'node:test'
import { generateDerivedGeography } from '../core/generateDerivedGeography.js'
import { DEFAULT_GRID_SIZE } from '../core/types.js'
import { applyColonizationEpoch } from '../core/colonization/applyColonizationEpoch.js'
import { beginColonizationCommit } from '../core/colonization/beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from '../core/colonization/createDefaultColonizationSlice.js'
import { applyColonizationSliceToWorldDocument } from '../core/colonization/colonizationPhaseTransitions.js'
import { resetConflictTuning } from '../core/colonization/politics/conflict/conflictTuning.js'
import { BIOMES, SEA_LEVEL } from '../core/biomeIds.js'
import { RECENT_CONQUEST_ICON_COLOR } from '../renderer/settlementNodeMarkers.js'
import {
  createHostEl,
  createOverlayOwnerDriver,
  installViewportMocks,
  uninstallViewportGlobals,
  viewportSpyState,
} from '../renderer/createWorldBuilderMapViewportTestHarness.js'

resetConflictTuning()

if (!mock.module) {
  throw new Error('node --experimental-test-module-mocks required')
}

function pickFoundingLanding(doc) {
  const { gridWidth: w, gridHeight: h, fields, lakeMask, biomes } = doc
  const elev = fields.elevation
  for (let y = (h * 0.25) | 0; y < (h * 0.75) | 0; y += 7) {
    for (let x = (w * 0.25) | 0; x < (w * 0.75) | 0; x += 7) {
      const i = y * w + x
      if (lakeMask?.[i]) continue
      if (elev[i] <= SEA_LEVEL) continue
      if (biomes && biomes[i] === BIOMES.OCEAN) continue
      return { x, y }
    }
  }
  return { x: (w / 2) | 0, y: (h / 3) | 0 }
}

function yellowSwordMarks() {
  return viewportSpyState.drawnStrokes.filter(
    (stroke) => stroke.color === RECENT_CONQUEST_ICON_COLOR,
  )
}

const createWorldBuilderMapViewport = await installViewportMocks()

console.log(`Generating full-resolution world (${DEFAULT_GRID_SIZE}×${DEFAULT_GRID_SIZE})…`)
const t0 = Date.now()
const geography = generateDerivedGeography({
  geographySeed: 42,
  prevailingWindDegrees: 90,
})
console.log(
  JSON.stringify({
    generatedMs: Date.now() - t0,
    grid: [geography.gridWidth, geography.gridHeight],
  }),
)

const landing = pickFoundingLanding(geography)
let slice = createDefaultColonizationSlice()
slice.colonizationPhase = COLONIZATION_PHASE_SETUP
slice.foundingLanding = landing
slice = await beginColonizationCommit(slice, geography)

const viewport = await createWorldBuilderMapViewport(createHostEl(), geography)
const overlay = createOverlayOwnerDriver(viewport)
overlay.setVisibility('settlements', true)
overlay.setVisibility('factionTerritory', true)

/** @type {null | object} */
let firstSwordsEpoch = null
const epochLog = []
const maxEpochs = 8

for (let step = 0; step < maxEpochs; step += 1) {
  const { slice: next, events } = await applyColonizationEpoch(slice, geography)
  slice = next

  const wars = events.filter((e) => e.kind === 'major_war_start')
  const wins = events.filter((e) => e.kind === 'major_war_end' && e.winner === 'attacker')
  const losses = events.filter((e) => e.kind === 'major_war_end' && e.winner === 'defender')

  const worldDocument = applyColonizationSliceToWorldDocument(geography, slice)
  viewport.updateWorldDocument(worldDocument)

  const swords = yellowSwordMarks()
  const row = {
    epoch: slice.epoch,
    living: slice.settlements.filter((s) => s.status === 'living').length,
    factions: slice.factions.filter((f) => f.status === 'active').length,
    wars: wars.length,
    attackerWins: wins.length,
    defenderWins: losses.length,
    recentKeys: Object.keys(slice.recentConquestBySettlementId ?? {}).length,
    viewportYellowSwordStrokes: swords.length,
  }
  epochLog.push(row)
  console.log(JSON.stringify(row))

  if (swords.length > 0 && !firstSwordsEpoch) {
    firstSwordsEpoch = row
  }
}

viewport.destroy()
uninstallViewportGlobals()

const summary = {
  pipeline: 'createWorldBuilderMapViewport + updateWorldDocument + Graphics crossed swords',
  firstSwordsEpoch,
  anyWars: epochLog.some((r) => r.wars > 0),
  anyAttackerWins: epochLog.some((r) => r.attackerWins > 0),
  anyViewportSwords: Boolean(firstSwordsEpoch),
}
console.log('SUMMARY', JSON.stringify(summary, null, 2))

if (!firstSwordsEpoch) {
  process.exitCode = 1
  throw new Error(
    'FAIL: createWorldBuilderMapViewport never stroked conquest swords after colonization epochs',
  )
}

console.log('PASS: viewport pipeline stroked conquest swords at epoch', firstSwordsEpoch.epoch)
