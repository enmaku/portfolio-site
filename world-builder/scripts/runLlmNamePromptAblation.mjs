#!/usr/bin/env node
/**
 * Rate-limited Gemini ablation runner for settlement/faction name prompts.
 * Loads cached annotations from developLlmNameAblationWorld.mjs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SETTLEMENT_NAME_ABLATION_VARIANTS,
  buildJudgeCueSheet,
} from '../llm/ablateSettlementNameAnnotations.js'
import {
  buildSettlementNamePrompt,
  parseSettlementNameResponse,
} from '../llm/buildSettlementNamePrompt.js'
import {
  createSettlementNameJudgeModel,
  createSettlementNamesModel,
} from '../../src/features/world-builder/firebase/ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.join(__dirname, '../research/llm-name-prompt-ablation')
const COOLDOWN_MS = Number(process.env.LLM_ABLATION_COOLDOWN_MS || 45_000)
const MAX_RETRIES = 4

function loadDotEnv(envPath) {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function approxTokens(text) {
  return Math.ceil(String(text).length / 4)
}

function formatNamesForJudge(names) {
  return {
    settlements: Object.entries(names.settlements ?? {}).map(([settlementId, name]) => ({
      settlementId,
      name,
    })),
    factions: Object.entries(names.factions ?? {}).map(([factionId, name]) => ({
      factionId,
      name,
    })),
  }
}

/**
 * @param {() => Promise<unknown>} fn
 */
async function withRetries(fn) {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt += 1
      const message = err instanceof Error ? err.message : String(err)
      const retryable = /429|resource.exhausted|quota|unavailable|timeout/i.test(message)
      if (!retryable || attempt > MAX_RETRIES) throw err
      const waitMs = Math.min(300_000, COOLDOWN_MS * 2 ** attempt)
      console.warn(JSON.stringify({ retry: attempt, waitMs, message }))
      await sleep(waitMs)
    }
  }
}

async function generateNames(prompt) {
  const model = await createSettlementNamesModel()
  const t0 = Date.now()
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return {
    names: parseSettlementNameResponse(text),
    latencyMs: Date.now() - t0,
    responseChars: text.length,
  }
}

/**
 * @param {{
 *   flavor: string,
 *   cueSheet: object,
 *   setA: object,
 *   setB: object,
 * }} params
 */
async function judgeNames(params) {
  const model = await createSettlementNameJudgeModel()
  const prompt = [
    'You are judging two fantasy name sets for settlements and factions on a procedural map.',
    `Author flavor / theme: ${params.flavor}`,
    'Score each set from 1 (poor) to 5 (excellent) on:',
    '- flavorFit: matches the author flavor',
    '- diversity: morphological variety; penalize repeated suffixes/templates',
    '- groundedness: names feel informed by biome, faction membership, and history kinds in the cue sheet when those cues exist',
    '- factionDistinctiveness: faction names feel like distinct polities',
    'Return JSON with flavorFitA, flavorFitB, diversityA, diversityB, groundednessA, groundednessB, factionDistinctivenessA, factionDistinctivenessB, betterSet ("A"|"B"|"tie"), rationale.',
    'Cue sheet (ground truth signals — not the naming prompt):',
    JSON.stringify(params.cueSheet),
    'Set A:',
    JSON.stringify(params.setA),
    'Set B:',
    JSON.stringify(params.setB),
  ].join('\n\n')

  const t0 = Date.now()
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return {
    judgment: JSON.parse(text),
    latencyMs: Date.now() - t0,
    promptApproxTokens: approxTokens(prompt),
    responseChars: text.length,
  }
}

async function main() {
  loadDotEnv(path.join(REPO_ROOT, '.env'))
  process.env.NODE_ENV = process.env.NODE_ENV || 'development'

  const annotationsPath = path.join(OUT_DIR, 'annotations-full.json')
  const metaPath = path.join(OUT_DIR, 'meta.json')
  if (!existsSync(annotationsPath) || !existsSync(metaPath)) {
    throw new Error('Missing fixture. Run: node world-builder/scripts/developLlmNameAblationWorld.mjs')
  }

  const annotations = JSON.parse(readFileSync(annotationsPath, 'utf8'))
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  const flavor = meta.flavor || 'pirates'
  const cueSheet = buildJudgeCueSheet(annotations)

  mkdirSync(path.join(OUT_DIR, 'results'), { recursive: true })
  mkdirSync(path.join(OUT_DIR, 'judgments'), { recursive: true })

  /** @type {Record<string, string> | null} */
  let baselineSettlementNames = null
  /** @type {Record<string, string> | null} */
  let baselineFactionNames = null
  const baselineResultPath = path.join(OUT_DIR, 'results', 'baseline.json')
  if (existsSync(baselineResultPath)) {
    const existingBaseline = JSON.parse(readFileSync(baselineResultPath, 'utf8'))
    baselineSettlementNames = existingBaseline.names?.settlements ?? {}
    baselineFactionNames = existingBaseline.names?.factions ?? {}
  }

  const only = String(process.env.LLM_ABLATION_ONLY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const variants = only.length
    ? SETTLEMENT_NAME_ABLATION_VARIANTS.filter((v) => only.includes(v.id))
    : SETTLEMENT_NAME_ABLATION_VARIANTS

  /** @type {object[]} */
  const summaryRows = []
  let callIndex = 0

  for (const variant of variants) {
    const resultPath = path.join(OUT_DIR, 'results', `${variant.id}.json`)
    if (existsSync(resultPath) && process.env.LLM_ABLATION_FORCE !== '1') {
      console.log(JSON.stringify({ skipExisting: variant.id }))
      const existing = JSON.parse(readFileSync(resultPath, 'utf8'))
      if (variant.id === 'baseline') {
        baselineSettlementNames = existing.names?.settlements ?? {}
        baselineFactionNames = existing.names?.factions ?? {}
      }
      summaryRows.push({
        id: variant.id,
        skipped: true,
        promptApproxTokens: existing.promptApproxTokens,
        latencyMs: existing.latencyMs,
      })
      continue
    }

    const ablated = variant.transform(annotations)
    const prompt = buildSettlementNamePrompt({
      annotations: ablated,
      flavorPrompt: flavor,
      includeAntiRepetition: variant.includeAntiRepetition !== false,
    })
    const promptApproxTokens = approxTokens(prompt)
    console.log(
      JSON.stringify({
        phase: 'generate',
        id: variant.id,
        promptApproxTokens,
        cooldownMs: callIndex === 0 ? 0 : COOLDOWN_MS,
      }),
    )
    if (callIndex > 0) await sleep(COOLDOWN_MS)
    callIndex += 1

    const generated = await withRetries(() => generateNames(prompt))
    const resultPayload = {
      id: variant.id,
      label: variant.label,
      flavor,
      promptApproxTokens,
      latencyMs: generated.latencyMs,
      responseChars: generated.responseChars,
      names: generated.names,
      settlementNameCount: Object.keys(generated.names.settlements).length,
      factionNameCount: Object.keys(generated.names.factions).length,
      createdAt: new Date().toISOString(),
    }
    writeFileSync(resultPath, `${JSON.stringify(resultPayload, null, 2)}\n`)

    if (variant.id === 'baseline') {
      baselineSettlementNames = generated.names.settlements
      baselineFactionNames = generated.names.factions
    }

    const judgmentPath = path.join(OUT_DIR, 'judgments', `${variant.id}.json`)
    if (!baselineSettlementNames) {
      throw new Error('baseline names missing; run baseline first')
    }

    const baselineNames = {
      settlements: baselineSettlementNames,
      factions: baselineFactionNames ?? {},
    }
    const variantNames = generated.names
    const swap = Math.random() < 0.5
    const setA = formatNamesForJudge(swap ? variantNames : baselineNames)
    const setB = formatNamesForJudge(swap ? baselineNames : variantNames)

    console.log(
      JSON.stringify({
        phase: 'judge',
        id: variant.id,
        swapped: swap,
        cooldownMs: COOLDOWN_MS,
      }),
    )
    await sleep(COOLDOWN_MS)
    callIndex += 1

    const judged = await withRetries(() =>
      judgeNames({
        flavor,
        cueSheet,
        setA,
        setB,
      }),
    )

    const mapped = mapJudgmentToBaseline(judged.judgment, swap)
    const judgmentPayload = {
      id: variant.id,
      label: variant.label,
      swapped: swap,
      raw: judged.judgment,
      vsBaseline: mapped,
      latencyMs: judged.latencyMs,
      promptApproxTokens: judged.promptApproxTokens,
      createdAt: new Date().toISOString(),
    }
    writeFileSync(judgmentPath, `${JSON.stringify(judgmentPayload, null, 2)}\n`)

    summaryRows.push({
      id: variant.id,
      promptApproxTokens,
      genLatencyMs: generated.latencyMs,
      judge: mapped,
    })
  }

  writeFileSync(
    path.join(OUT_DIR, 'summary.json'),
    `${JSON.stringify({ meta, rows: summaryRows, createdAt: new Date().toISOString() }, null, 2)}\n`,
  )
  console.log(JSON.stringify({ done: true, variants: summaryRows.length, outDir: OUT_DIR }))
}

/**
 * @param {object} raw
 * @param {boolean} swapped if true, A was variant and B was baseline
 */
function mapJudgmentToBaseline(raw, swapped) {
  const pick = (aKey, bKey) => (swapped ? raw[bKey] : raw[aKey])
  const pickVar = (aKey, bKey) => (swapped ? raw[aKey] : raw[bKey])
  let better = raw.betterSet
  if (swapped && better === 'A') better = 'variant'
  else if (swapped && better === 'B') better = 'baseline'
  else if (!swapped && better === 'A') better = 'baseline'
  else if (!swapped && better === 'B') better = 'variant'
  else better = 'tie'

  return {
    baseline: {
      flavorFit: pick('flavorFitA', 'flavorFitB'),
      diversity: pick('diversityA', 'diversityB'),
      groundedness: pick('groundednessA', 'groundednessB'),
      factionDistinctiveness: pick('factionDistinctivenessA', 'factionDistinctivenessB'),
    },
    variant: {
      flavorFit: pickVar('flavorFitA', 'flavorFitB'),
      diversity: pickVar('diversityA', 'diversityB'),
      groundedness: pickVar('groundednessA', 'groundednessB'),
      factionDistinctiveness: pickVar('factionDistinctivenessA', 'factionDistinctivenessB'),
    },
    better,
    rationale: raw.rationale ?? '',
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
