#!/usr/bin/env node
/**
 * Develop a full-scale World Builder colonization fixture for LLM name-prompt ablation.
 * Live path: generateDerivedGeography → runBeginColonizationCommit → N× runColonizationEpochStep.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BIOMES, SEA_LEVEL } from '../core/biomeIds.js'
import { generateDerivedGeography } from '../core/generateDerivedGeography.js'
import { runBeginColonizationCommit } from '../core/colonization/runBeginColonizationCommit.js'
import { runColonizationEpochStep } from '../core/colonization/runColonizationEpochStep.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from '../core/colonization/createDefaultColonizationSlice.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../core/worldGenerationOptions.js'
import { DEFAULT_GRID_SIZE } from '../core/types.js'
import { buildSettlementNameAnnotations } from '../llm/buildSettlementNameAnnotations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '../research/llm-name-prompt-ablation')
const GEOGRAPHY_SEED = 42
const PREVAILING_WIND_DEGREES = 90
const EPOCH_STEPS = 3
const FLAVOR = 'pirates'

/**
 * @param {import('../core/types.js').WorldDocument} doc
 */
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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(path.join(OUT_DIR, 'results'), { recursive: true })
  mkdirSync(path.join(OUT_DIR, 'judgments'), { recursive: true })

  console.log(
    `Generating full-scale geography (${DEFAULT_GRID_SIZE}×${DEFAULT_GRID_SIZE}, seed=${GEOGRAPHY_SEED})…`,
  )
  const t0 = Date.now()
  const geography = generateDerivedGeography({
    geographySeed: GEOGRAPHY_SEED,
    prevailingWindDegrees: PREVAILING_WIND_DEGREES,
  })
  console.log(JSON.stringify({ generatedMs: Date.now() - t0, grid: [geography.gridWidth, geography.gridHeight] }))

  const landing = pickFoundingLanding(geography)
  console.log(JSON.stringify({ foundingLanding: landing }))

  let slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = landing

  const begin = await runBeginColonizationCommit(slice, geography, {
    yieldToUi: async () => {},
  })
  if (!begin.committed) {
    throw new Error('runBeginColonizationCommit did not commit')
  }
  slice = begin.slice
  console.log(
    JSON.stringify({
      began: true,
      epoch: slice.epoch,
      living: (slice.settlements ?? []).filter((s) => s.status !== 'ruin').length,
    }),
  )

  for (let i = 0; i < EPOCH_STEPS; i += 1) {
    const step = await runColonizationEpochStep(slice, geography, {
      yieldToUi: async () => {},
    })
    if (!step.ran) {
      throw new Error(`runColonizationEpochStep did not run at step ${i}`)
    }
    slice = step.slice
    console.log(
      JSON.stringify({
        epochStep: i + 1,
        epoch: slice.epoch,
        living: (slice.settlements ?? []).filter((s) => s.status !== 'ruin').length,
        factions: (slice.factions ?? []).filter((f) => f.status === 'active').length,
      }),
    )
  }

  const annotations = buildSettlementNameAnnotations(slice, geography)
  const meta = {
    geographySeed: GEOGRAPHY_SEED,
    prevailingWindDegrees: PREVAILING_WIND_DEGREES,
    defaultGeographySeedConstant: DEFAULT_GEOGRAPHY_SEED,
    epochSteps: EPOCH_STEPS,
    flavor: FLAVOR,
    epoch: annotations.epoch,
    settlementCount: annotations.settlements.length,
    factionCount: (annotations.factions ?? []).length,
    rivalryEdgeCount: (annotations.rivalryEdges ?? []).length,
    foundingLanding: landing,
    createdAt: new Date().toISOString(),
  }

  writeFileSync(path.join(OUT_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  writeFileSync(
    path.join(OUT_DIR, 'annotations-full.json'),
    `${JSON.stringify(annotations)}\n`,
  )

  const approxTokens = Math.ceil(JSON.stringify(annotations).length / 4)
  console.log(
    JSON.stringify({
      wrote: OUT_DIR,
      settlementCount: meta.settlementCount,
      factionCount: meta.factionCount,
      annotationsApproxTokens: approxTokens,
    }),
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
