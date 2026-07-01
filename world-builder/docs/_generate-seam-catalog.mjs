#!/usr/bin/env node
/**
 * Generates SEAM-TEST-CATALOG.md from world-builder test files and useWorldBuilder composable tests
 * Run: node world-builder/docs/_generate-seam-catalog.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '../..')

/** @param {string} dir */
function collectTestFiles(dir) {
  /** @type {string[]} */
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...collectTestFiles(full))
    } else if (name.endsWith('.test.js')) {
      out.push(full)
    }
  }
  return out
}

const wbTests = collectTestFiles(join(repoRoot, 'world-builder'))
const composableTests = [
  join(repoRoot, 'src/composables/useWorldBuilderGeneration.test.js'),
  join(repoRoot, 'src/composables/useWorldBuilderOverlayState.test.js'),
  join(repoRoot, 'src/composables/useWorldBuilderPageController.test.js'),
]
const allTests = [...wbTests, ...composableTests].sort()

/** @param {string} rel */
function classifySeam(rel) {
  if (rel.includes('SeamContract')) return 'runtime-seam-contract'
  if (rel.includes('useWorldBuilderPageController')) return 'page-controller'
  if (rel.includes('useWorldBuilderGeneration')) return 'generation-composable'
  if (rel.includes('useWorldBuilderOverlayState')) return 'overlay-composable'
  if (rel.includes('worldBuilderGenerationSeamContract')) return 'generation-seam'
  if (rel.includes('rendererSeamContract')) return 'renderer-seam'
  if (rel.includes('resourceOverlayStateSeamContract')) return 'overlay-seam'
  if (rel.includes('resourceRasterOverlaySeamContract')) return 'overlay-raster-seam'
  if (rel.includes('hydrologyRiverPathfindingSeamContract')) return 'simulation-hydrology-seam'
  if (rel.includes('createWorldBuilderMapViewport')) return 'viewport-behavior'
  if (rel.includes('worldBuilder.integration')) return 'e2e-integration'
  if (rel.includes('runDerivedGeographyInWorker') || rel.includes('worker/')) return 'worker-protocol'
  if (rel.includes('derivedGeographyPipeline') || rel.includes('runLandmassPipeline')) return 'landmass-pipeline'
  if (rel.includes('landmassPipeline')) return 'landmass-contract'
  if (rel.includes('hydrologySubstep')) return 'hydrology-substep'
  if (rel.includes('/hydrology/')) return 'hydrology-unit'
  if (rel.includes('/renderer/')) return 'renderer-unit'
  if (rel.includes('/validation/')) return 'validation-unit'
  if (rel.includes('worldBuilderGeneration')) return 'generation-orchestration'
  if (rel.includes('resourceOverlay') || rel.includes('resourceOverlays')) return 'overlay-state'
  if (rel.includes('worldBuilderPageModel')) return 'page-display-model'
  if (rel.includes('/research/')) return 'research-asset'
  if (rel.includes('/core/')) return 'core-unit'
  return 'world-builder-unit'
}

/** @param {string} rel */
function seamDescription(seam) {
  const map = {
    'runtime-seam-contract': 'ADR-0009 behavioral boundary; no source greps',
    'page-controller': 'Vue page controller seam (ADR-0009)',
    'generation-composable': 'Generation lifecycle without renderer',
    'overlay-composable': 'Overlay owner projection to viewport',
    'generation-seam': 'Settings → orchestrator → world document',
    'renderer-seam': 'WorldDocument → map layers without generation imports',
    'overlay-seam': 'Overlay owner-only viewport mutation',
    'overlay-raster-seam': 'Raster overlay refresh locality',
    'simulation-hydrology-seam': 'Simulation vs presentation hydrology masks',
    'viewport-behavior': 'Map viewport layer sync and framing',
    'e2e-integration': 'Full pipeline smoke without internal mocks',
    'worker-protocol': 'Worker postMessage and clone round-trip',
    'landmass-pipeline': 'Derived geography pipeline orchestration',
    'landmass-contract': 'Stage input/output contract derivation',
    'hydrology-substep': 'Hydrology substep runner and contracts',
    'hydrology-unit': 'Hydrology algorithm module',
    'renderer-unit': 'Renderer canvas and diff helpers',
    'validation-unit': 'Generation report and rejection checks',
    'generation-orchestration': 'Progress, cancel, and policy modules',
    'overlay-state': 'Resource overlay visibility state machine',
    'page-display-model': 'Validation/hydrology display projections',
    'research-asset': 'Research transcript asset integrity',
    'core-unit': 'Core geography algorithm',
    'world-builder-unit': 'Top-level world-builder module',
  }
  return map[seam] ?? seam
}

/** @param {string} content */
function extractTests(content) {
  /** @type {string[]} */
  const names = []
  for (const m of content.matchAll(/test\s*\(\s*['`]([^'`]+)['`]/g)) {
    names.push(m[1])
  }
  return names
}

/** @param {string} content */
function detectSkipConditions(content, rel) {
  /** @type {string[]} */
  const conditions = []
  if (/test\.skip|describe\.skip/.test(content)) {
    conditions.push('Contains explicit test.skip/describe.skip — must be 0 before merge (#369)')
  }
  if (rel.includes('createWorldBuilderMapViewport') && !content.includes('mock.module')) {
    conditions.push('May require --experimental-test-module-mocks in npm test (#369)')
  }
  if (rel.includes('researchTranscriptAssets')) {
    conditions.push('Skips runtime scan paths listed in RUNTIME_SCAN_SKIP')
  }
  if (conditions.length === 0) {
    conditions.push('None — runs under npm run test:world-builder')
  }
  return conditions
}

/** @param {string} rel */
function primaryBehaviors(rel, testNames) {
  if (testNames.length === 0) return 'Module import smoke or harness setup'
  const joined = testNames.join(' ').toLowerCase()
  /** @type {string[]} */
  const behaviors = []
  if (joined.includes('simulation') || joined.includes('simulationrivermask')) {
    behaviors.push('simulationRiverMask population or invariance')
  }
  if (joined.includes('clone') || joined.includes('independently')) {
    behaviors.push('Typed array / graph clone independence')
  }
  if (joined.includes('cancel')) behaviors.push('Pipeline cancellation semantics')
  if (joined.includes('contract') || joined.includes('inputkeys')) {
    behaviors.push('Contract derivation or selector wiring')
  }
  if (joined.includes('locality') || joined.includes('refresh')) {
    behaviors.push('Layer refresh locality')
  }
  if (joined.includes('deterministic') || joined.includes('seed')) {
    behaviors.push('Seed determinism')
  }
  if (behaviors.length === 0) {
    behaviors.push(testNames[0].slice(0, 80))
    if (testNames.length > 1) behaviors.push(`+${testNames.length - 1} additional cases`)
  }
  return behaviors.join('; ')
}

let body = `# Seam test catalog

> **Purpose:** Index every World Builder test file with its architectural seam, primary behaviors, and skip conditions. Phase 5 issues (#364–#375, #369) reference this matrix when adding or tightening seam coverage.
>
> **Scope:** \`world-builder/**/*.test.js\` (127 files) plus \`src/composables/useWorldBuilder*.test.js\` (3 files) = **130** catalog entries.
>
> **Last generated:** Run \`node world-builder/docs/_generate-seam-catalog.mjs\` after adding test files.

---

## How to read this catalog

| Column | Meaning |
|--------|---------|
| **Seam** | Architectural boundary under test (see [ARCHITECTURE-SEAMS.md](./ARCHITECTURE-SEAMS.md)) |
| **Behaviors** | What the suite proves — logic and contracts, not UI copy |
| **Skip conditions** | When the suite does not run or is exempt from CI gates |

### Seam type legend

`

const seamTypes = [...new Set(allTests.map((f) => classifySeam(relative(repoRoot, f))))].sort()
for (const seam of seamTypes) {
  body += `- \`${seam}\` — ${seamDescription(seam)}\n`
}

body += `
### Global skip policy (#369, #378)

- Full \`npm test\` must report **0 skipped** viewport behavioral suites.
- Seam contract tests must not use \`readFileSync\` source inspection (research asset tests exempt).
- No test title may claim **simulation** while asserting presentation-only fields (#364).

---

## Catalog by area

`

/** @type {Record<string, { rel: string, seam: string, behaviors: string, skips: string[] }[]>} */
const byArea = {}

for (const full of allTests) {
  const rel = relative(repoRoot, full)
  const content = readFileSync(full, 'utf8')
  const testNames = extractTests(content)
  const seam = classifySeam(rel)
  const skips = detectSkipConditions(content, rel)
  const parts = rel.split('/')
  const area = parts.slice(0, 2).join('/') // world-builder/core or src/composables
  if (!byArea[area]) byArea[area] = []
  byArea[area].push({
    rel,
    seam,
    behaviors: primaryBehaviors(rel, testNames),
    skips,
  })
}

for (const area of Object.keys(byArea).sort()) {
  body += `### \`${area}/\`\n\n`
  body += `| File | Seam | Behaviors | Skip conditions |\n`
  body += `|------|------|-----------|------------------|\n`
  for (const entry of byArea[area]) {
    const short = entry.rel.replace(`${area}/`, '')
    body += `| \`${short}\` | \`${entry.seam}\` | ${entry.behaviors.replace(/\|/g, '\\|')} | ${entry.skips.join('; ').replace(/\|/g, '\\|')} |\n`
  }
  body += `\n`
}

body += `---

## Detailed entries (alphabetical)

Each file lists individual \`test(...)\` titles for reviewer grep and #375 controller matrix cross-check.

`

for (const full of allTests) {
  const rel = relative(repoRoot, full)
  const content = readFileSync(full, 'utf8')
  const testNames = extractTests(content)
  const seam = classifySeam(rel)
  const skips = detectSkipConditions(content, rel)
  body += `### \`${rel}\`\n\n`
  body += `- **Seam:** \`${seam}\` — ${seamDescription(seam)}\n`
  body += `- **Test count:** ${testNames.length}\n`
  body += `- **Skip conditions:** ${skips.join('; ')}\n`
  body += `- **Behaviors:** ${primaryBehaviors(rel, testNames)}\n`
  if (testNames.length > 0) {
    body += `- **Cases:**\n`
    for (const name of testNames) {
      body += `  - ${name}\n`
    }
  }
  body += `\n`
}

body += `---

## Seam contract files (quick reference)

| File | Seam under test |
|------|-----------------|
| \`world-builder/worldBuilderGenerationSeamContract.test.js\` | Generation without renderer |
| \`world-builder/renderer/rendererSeamContract.test.js\` | Renderer without generation path |
| \`world-builder/resourceOverlayStateSeamContract.test.js\` | Overlay owner → viewport |
| \`world-builder/renderer/resourceRasterOverlaySeamContract.test.js\` | Raster overlay refresh |
| \`world-builder/core/hydrology/hydrologyRiverPathfindingSeamContract.test.js\` | Simulation river mask seam |

---

## Related docs

- [REWORK-PROTOCOL.md](./REWORK-PROTOCOL.md) — thermo instant-REWORK rules for seam tests
- [MINI-REVIEW-RUBRICS.md](./MINI-REVIEW-RUBRICS.md) — slice-type review checklists
- [PAGE-CONTROLLER-INTERFACE.md](./PAGE-CONTROLLER-INTERFACE.md) — controller method → test mapping (#375)
- [COMMIT-SLICE-MAP.md](./COMMIT-SLICE-MAP.md) — which issue owns seam test edits

`

const outPath = join(__dirname, 'SEAM-TEST-CATALOG.md')
writeFileSync(outPath, body)
const lines = body.split('\n').length
console.log(`Wrote ${outPath} (${lines} lines, ${allTests.length} files)`)
