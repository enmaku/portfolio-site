#!/usr/bin/env node
/**
 * Rate-limited sims: which prompt tactics reduce biome/geography calque names?
 * Uses cached annotations from developLlmNameAblationWorld.mjs.
 * Scores with a local heuristic (no extra Gemini judge calls).
 *
 * Env:
 *   LLM_BIOME_COOLDOWN_MS   default 8000 (Flash Lite ~15 RPM; stay polite)
 *   LLM_BIOME_REPEATS       default 2 (runs per variant)
 *   LLM_BIOME_ONLY          comma ids to subset
 *   LLM_BIOME_FORCE=1       regenerate even if result exists
 *   LLM_BIOME_FLAVOR        default from meta.json or pirates
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BIOME_LITERAL_PROMPT_VARIANTS,
  buildBiomeLiteralExperimentPrompt,
} from '../llm/biomeLiteralNamePromptVariants.js'
import {
  buildSettlementNamePrompt,
  parseSettlementNameResponse,
} from '../llm/buildSettlementNamePrompt.js'
import { scoreBiomeLiteralNames } from '../llm/scoreBiomeLiteralNames.js'
import { createSettlementNamesModel } from '../../src/features/world-builder/firebase/ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const FIXTURE_DIR = path.join(__dirname, '../research/llm-name-prompt-ablation')
const OUT_DIR = path.join(__dirname, '../research/llm-biome-literal-naming')
const COOLDOWN_MS = Number(process.env.LLM_BIOME_COOLDOWN_MS || 8_000)
const REPEATS = Math.max(1, Number(process.env.LLM_BIOME_REPEATS || 2))
const MAX_RETRIES = 5

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
      const waitMs = Math.min(300_000, Math.max(COOLDOWN_MS, 15_000) * 2 ** (attempt - 1))
      console.warn(JSON.stringify({ retry: attempt, waitMs, message }))
      await sleep(waitMs)
    }
  }
}

/**
 * @param {object} annotations
 * @returns {Record<string, string>}
 */
function biomeBySettlementId(annotations) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const row of annotations.settlements ?? []) {
    if (typeof row?.settlementId === 'string' && typeof row?.biome === 'string') {
      out[row.settlementId] = row.biome
    }
  }
  return out
}

async function generateNames(prompt, { includeRegionWriteup = false } = {}) {
  const model = await createSettlementNamesModel({ includeRegionWriteup })
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
 * @param {number[]} values
 */
function mean(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

async function main() {
  loadDotEnv(path.join(REPO_ROOT, '.env'))
  process.env.NODE_ENV = process.env.NODE_ENV || 'development'

  const annotationsPath = path.join(FIXTURE_DIR, 'annotations-full.json')
  const metaPath = path.join(FIXTURE_DIR, 'meta.json')
  if (!existsSync(annotationsPath) || !existsSync(metaPath)) {
    throw new Error('Missing fixture. Run: node world-builder/scripts/developLlmNameAblationWorld.mjs')
  }

  const annotations = JSON.parse(readFileSync(annotationsPath, 'utf8'))
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  const flavor =
    process.env.LLM_BIOME_FLAVOR !== undefined
      ? process.env.LLM_BIOME_FLAVOR
      : meta.flavor || 'pirates'
  const tag = String(process.env.LLM_BIOME_TAG || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
  const includeRegionWriteup = process.env.LLM_BIOME_WRITEUP === '1'
  const biomes = biomeBySettlementId(annotations)

  mkdirSync(path.join(OUT_DIR, 'results'), { recursive: true })

  const only = String(process.env.LLM_BIOME_ONLY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const variants = only.length
    ? BIOME_LITERAL_PROMPT_VARIANTS.filter((v) => only.includes(v.id))
    : BIOME_LITERAL_PROMPT_VARIANTS

  /** @type {object[]} */
  const summaryRows = []
  let callIndex = 0

  for (const variant of variants) {
    /** @type {object[]} */
    const runScores = []

    for (let rep = 1; rep <= REPEATS; rep += 1) {
      const resultId = [tag, variant.id, `r${rep}`].filter(Boolean).join('__')
      const resultPath = path.join(OUT_DIR, 'results', `${resultId}.json`)
      if (existsSync(resultPath) && process.env.LLM_BIOME_FORCE !== '1') {
        console.log(JSON.stringify({ skipExisting: resultId }))
        const existing = JSON.parse(readFileSync(resultPath, 'utf8'))
        runScores.push(existing.score)
        continue
      }

      let prompt
      if (includeRegionWriteup) {
        const annotationsForPrompt = variant.transformAnnotations
          ? variant.transformAnnotations(annotations)
          : annotations
        // Production-shaped call: soft anti-literal lives in buildSettlementNamePrompt.
        prompt = buildSettlementNamePrompt({
          annotations: annotationsForPrompt,
          flavorPrompt: flavor,
          includeRegionWriteup: true,
          includeAntiRepetition: true,
        })
        if (variant.instructionBlocks?.length) {
          prompt = `${prompt}\n\n${variant.instructionBlocks.join('\n\n')}`
        }
      } else {
        prompt = buildBiomeLiteralExperimentPrompt({
          annotations,
          flavorPrompt: flavor,
          variant,
        })
      }
      const promptApproxTokens = approxTokens(prompt)
      console.log(
        JSON.stringify({
          phase: 'generate',
          id: resultId,
          label: variant.label,
          flavor: flavor || '(empty)',
          writeup: includeRegionWriteup,
          promptApproxTokens,
          cooldownMs: callIndex === 0 ? 0 : COOLDOWN_MS,
        }),
      )
      if (callIndex > 0) await sleep(COOLDOWN_MS)
      callIndex += 1

      const generated = await withRetries(() =>
        generateNames(prompt, { includeRegionWriteup }),
      )
      const score = scoreBiomeLiteralNames({
        settlements: generated.names.settlements,
        biomeBySettlementId: biomes,
      })
      const sampleNames = Object.values(generated.names.settlements).slice(0, 12)

      const payload = {
        id: resultId,
        variantId: variant.id,
        label: variant.label,
        tag: tag || null,
        rep,
        flavor,
        includeRegionWriteup,
        model: 'gemini-3.5-flash-lite',
        promptApproxTokens,
        latencyMs: generated.latencyMs,
        responseChars: generated.responseChars,
        names: {
          settlements: generated.names.settlements,
          factions: generated.names.factions,
        },
        sampleNames,
        score,
        createdAt: new Date().toISOString(),
      }
      writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`)
      runScores.push(score)
      console.log(
        JSON.stringify({
          done: resultId,
          calqueRate: Number(score.calqueRate.toFixed(3)),
          stemHitRate: Number(score.stemHitRate.toFixed(3)),
          ownBiomeEchoRate: Number(score.ownBiomeEchoRate.toFixed(3)),
          sampleNames,
        }),
      )
    }

    summaryRows.push({
      id: [tag, variant.id].filter(Boolean).join('__') || variant.id,
      variantId: variant.id,
      label: variant.label,
      tag: tag || null,
      flavor: flavor || '(empty)',
      includeRegionWriteup,
      repeats: runScores.length,
      meanCalqueRate: mean(runScores.map((s) => s.calqueRate)),
      meanStemHitRate: mean(runScores.map((s) => s.stemHitRate)),
      meanOwnBiomeEchoRate: mean(runScores.map((s) => s.ownBiomeEchoRate)),
      meanSuffixHitRate: mean(runScores.map((s) => s.suffixHitRate)),
    })
  }

  summaryRows.sort((a, b) => a.meanCalqueRate - b.meanCalqueRate || a.meanStemHitRate - b.meanStemHitRate)

  const summaryName = tag ? `summary-${tag}.json` : 'summary.json'
  const summary = {
    meta: {
      ...meta,
      flavor,
      tag: tag || null,
      includeRegionWriteup,
      model: 'gemini-3.5-flash-lite',
      cooldownMs: COOLDOWN_MS,
      repeats: REPEATS,
      scoring: 'scoreBiomeLiteralNames heuristic',
    },
    ranking: summaryRows,
    createdAt: new Date().toISOString(),
  }
  writeFileSync(path.join(OUT_DIR, summaryName), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(
    JSON.stringify({
      done: true,
      variants: summaryRows.length,
      outDir: OUT_DIR,
      summaryName,
      ranking: summaryRows,
    }),
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
