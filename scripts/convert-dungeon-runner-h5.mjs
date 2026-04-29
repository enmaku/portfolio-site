#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DEFAULT_REPO_URL = 'https://github.com/enmaku/dungeon-runner.git'
const DEFAULT_REPO_REF = 'main'
const DEFAULT_REPO_MODELS_DIR = 'models'

const args = process.argv.slice(2)
const modelId = args.find((arg) => !arg.startsWith('--'))
const repoUrl = getArgValue(args, '--repo-url') ?? DEFAULT_REPO_URL
const repoRef = getArgValue(args, '--repo-ref') ?? DEFAULT_REPO_REF
const repoModelsDir = getArgValue(args, '--repo-models-dir') ?? DEFAULT_REPO_MODELS_DIR
const repoModelFile = getArgValue(args, '--repo-model-file') ?? 'policy.weights.h5'
const localModelsDir = process.env.DUNGEON_RUNNER_MODELS_DIR
const pythonBin = process.env.PYTHON_BIN ?? 'python3'
const converterBin = process.env.TENSORFLOWJS_CONVERTER_BIN ?? null
const converterPythonBin = process.env.TENSORFLOWJS_CONVERTER_PYTHON_BIN ?? null

if (!modelId) {
  console.error(
    'Usage: node scripts/convert-dungeon-runner-h5.mjs <model-id> [--repo-url <url>] [--repo-ref <ref>] [--repo-models-dir <dir>] [--repo-model-file <filename>]',
  )
  process.exit(1)
}

let tempRepoDir = null
let sourceModelsDir = localModelsDir
if (!sourceModelsDir) {
  tempRepoDir = mkdtempSync(path.join(tmpdir(), 'dungeon-runner-models-'))
  const clone = spawnSync(
    'git',
    ['clone', '--depth', '1', '--branch', repoRef, repoUrl, tempRepoDir],
    { stdio: 'inherit' },
  )
  if (clone.status !== 0) {
    console.error('Failed to clone dungeon-runner repository')
    cleanupTemp(tempRepoDir)
    process.exit(clone.status ?? 1)
  }
  sourceModelsDir = path.join(tempRepoDir, repoModelsDir)
}

const flatModelPath = path.join(sourceModelsDir, `${modelId}.h5`)
const nestedModelPath = path.join(sourceModelsDir, modelId, repoModelFile)
const inputPath = existsSync(flatModelPath) ? flatModelPath : nestedModelPath
const sourceRepoRoot = localModelsDir ? path.resolve(sourceModelsDir, '..') : tempRepoDir
const outputDir = path.join(process.cwd(), 'public', 'models', 'dungeon-runner', modelId)
const converterOutputRoot = mkdtempSync(path.join(tmpdir(), 'dungeon-runner-convert-out-'))
const converterOutputDir = path.join(converterOutputRoot, modelId)

if (!existsSync(inputPath)) {
  console.error(`Model file not found: ${inputPath}`)
  cleanupTemp(tempRepoDir)
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })
mkdirSync(converterOutputDir, { recursive: true })

const result =
  path.basename(inputPath) === 'policy.weights.h5'
    ? spawnSync(
        pythonBin,
        [
          './scripts/convert-dungeon-runner-policy-weights.py',
          '--repo-root',
          sourceRepoRoot,
          '--weights',
          inputPath,
          '--output-dir',
          converterOutputDir,
        ],
        { stdio: 'inherit' },
      )
    : converterBin
      ? spawnSync(converterBin, ['--input_format=keras', inputPath, converterOutputDir], { stdio: 'inherit' })
      : converterPythonBin
        ? spawnSync(
            converterPythonBin,
            ['-m', 'tensorflowjs.converters.converter', '--input_format=keras', inputPath, converterOutputDir],
            {
              stdio: 'inherit',
            },
          )
        : spawnSync(pythonBin, ['-m', 'tensorflowjs_converter', '--input_format=keras', inputPath, converterOutputDir], {
            stdio: 'inherit',
          })

if (result.status !== 0) {
  console.error('tensorflowjs_converter failed')
  cleanupTemp(tempRepoDir)
  cleanupTemp(converterOutputRoot)
  process.exit(result.status ?? 1)
}

cpSync(converterOutputDir, outputDir, { recursive: true, force: true })
cleanupTemp(tempRepoDir)
cleanupTemp(converterOutputRoot)
console.log(`Converted ${inputPath} -> ${outputDir}`)

function getArgValue(argsList, name) {
  const index = argsList.indexOf(name)
  if (index === -1) return null
  return argsList[index + 1] ?? null
}

function cleanupTemp(dirPath) {
  if (!dirPath) return
  rmSync(dirPath, { recursive: true, force: true })
}
