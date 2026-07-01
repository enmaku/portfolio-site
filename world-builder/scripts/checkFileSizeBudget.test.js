import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import {
  ABSOLUTE_MAX_LINES,
  PHASE5_FILE_BUDGETS,
  REVIEW_THRESHOLD_LINES,
  SPLIT_BEFORE_MERGE_LINES,
} from './fileSizeBudgetConfig.mjs'
import {
  auditFileSizeBudgets,
  countFileLines,
  formatAuditReport,
  listScopedProductionFiles,
} from './checkFileSizeBudget.mjs'

test('listScopedProductionFiles includes Phase 5 extraction targets', () => {
  const files = listScopedProductionFiles()
  assert.ok(files.includes('world-builder/core/derivedGeographyPipeline.js'))
  assert.ok(files.includes('world-builder/core/hydrology/substeps/index.js'))
  assert.ok(files.includes('src/pages/projects/WorldBuilderPage.vue'))
  assert.ok(files.every((file) => !file.endsWith('.test.js')))
})

test('Phase 5 extraction files are within per-file budgets', () => {
  for (const [repoRelativePath, budget] of Object.entries(PHASE5_FILE_BUDGETS)) {
    const lines = countFileLines(repoRelativePath)
    assert.ok(
      lines <= budget.max,
      `${repoRelativePath}: ${lines} lines exceeds phase 5 max ${budget.max}`,
    )
  }
})

test('hydrologySubstepModules is a shim re-export, not a monolith', () => {
  const lines = countFileLines('world-builder/core/hydrology/hydrologySubstepModules.js')
  assert.ok(lines <= PHASE5_FILE_BUDGETS['world-builder/core/hydrology/hydrologySubstepModules.js'].max)
  assert.ok(lines <= 80)
})

test('derivedGeographyPipeline orchestrator stays under 650 lines', () => {
  const lines = countFileLines('world-builder/core/derivedGeographyPipeline.js')
  assert.ok(lines <= 650)
  assert.ok(lines <= PHASE5_FILE_BUDGETS['world-builder/core/derivedGeographyPipeline.js'].max)
})

test('hydrology substep registry stays under 80 lines', () => {
  const lines = countFileLines('world-builder/core/hydrology/substeps/index.js')
  assert.ok(lines <= 80)
})

test('no scoped production file exceeds absolute max or split threshold', () => {
  const audit = auditFileSizeBudgets()

  for (const file of audit.files) {
    assert.ok(
      file.lines <= ABSOLUTE_MAX_LINES,
      `${file.path}: ${file.lines} lines exceeds absolute max ${ABSOLUTE_MAX_LINES}`,
    )
    assert.ok(
      file.lines <= SPLIT_BEFORE_MERGE_LINES,
      `${file.path}: ${file.lines} lines exceeds split-before-merge ${SPLIT_BEFORE_MERGE_LINES}`,
    )
  }

  assert.equal(audit.violations.length, 0, audit.violations.map((v) => v.path).join(', '))
})

test('formatAuditReport documents warnings with thresholds', () => {
  const report = formatAuditReport({
    files: [{ path: 'world-builder/a.js', lines: 700 }],
    violations: [],
    warnings: [
      {
        path: 'world-builder/a.js',
        lines: 700,
        threshold: REVIEW_THRESHOLD_LINES,
        rule: 'extract candidate review',
      },
    ],
  })

  assert.match(report, /Scanned: 1 production files/)
  assert.match(report, /Violations: none/)
  assert.match(report, new RegExp(`Warnings \\(>${REVIEW_THRESHOLD_LINES} lines`))
  assert.match(report, /700 lines \(>600, review for extract\)/)
  assert.match(report, /Flag these in the merge PR body/)
})

test('formatAuditReport states when no warnings', () => {
  const report = formatAuditReport({
    files: [{ path: 'world-builder/a.js', lines: 100 }],
    violations: [],
    warnings: [],
  })

  assert.match(report, /Warnings \(>600 lines\): none/)
})

test('checkFileSizeBudget CLI exits 0 when budgets pass', () => {
  const result = spawnSync('node', ['./world-builder/scripts/checkFileSizeBudget.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Violations: none/)
  assert.match(result.stdout, /Scanned: \d+ production files/)
  assert.match(result.stdout, /Warnings \(>600 lines/)
})

test('hydrology substep files stay under 250 lines', () => {
  const substepFiles = Object.entries(PHASE5_FILE_BUDGETS).filter(([path]) =>
    path.includes('/substeps/hydrology') && path.endsWith('Substep.js'),
  )

  assert.ok(substepFiles.length > 0)
  for (const [repoRelativePath, budget] of substepFiles) {
    const lines = countFileLines(repoRelativePath)
    assert.ok(lines <= 250, `${repoRelativePath}: ${lines} lines exceeds substep max 250`)
    assert.ok(lines <= budget.max)
  }
})
