#!/usr/bin/env node
/**
 * Fail when World Builder production files exceed FILE-SIZE-BUDGET.md limits.
 *
 * Enforces:
 * - Absolute max (1000 lines) on all scoped production files
 * - Phase 5 extraction per-file caps (#356, #361, #359)
 * - Split-before-merge threshold (800 lines) on scoped production files
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ABSOLUTE_MAX_LINES,
  PHASE5_FILE_BUDGETS,
  PRODUCTION_SCAN_ROOTS,
  REVIEW_THRESHOLD_LINES,
  SPLIT_BEFORE_MERGE_LINES,
} from './fileSizeBudgetConfig.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * @param {string} repoRelativePath
 * @returns {number}
 */
export function countFileLines(repoRelativePath) {
  const absolutePath = path.join(REPO_ROOT, repoRelativePath)
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing production file: ${repoRelativePath}`)
  }
  return readFileSync(absolutePath, 'utf8').split('\n').length
}

/**
 * @param {string} absolutePath
 * @returns {boolean}
 */
function isProductionSourceFile(absolutePath) {
  if (absolutePath.endsWith('.test.js')) return false
  return absolutePath.endsWith('.js') || absolutePath.endsWith('.vue')
}

/**
 * @param {string} repoRelativePath
 * @returns {boolean}
 */
function isProductionSourcePath(repoRelativePath) {
  return isProductionSourceFile(repoRelativePath)
}

/**
 * @param {string} dirAbsolute
 * @param {string[]} files
 */
function walkProductionFiles(dirAbsolute, files) {
  if (!existsSync(dirAbsolute)) return
  for (const entry of readdirSync(dirAbsolute, { withFileTypes: true })) {
    const absolutePath = path.join(dirAbsolute, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'docs' || entry.name === 'node_modules') continue
      walkProductionFiles(absolutePath, files)
      continue
    }
    if (entry.isFile() && isProductionSourceFile(absolutePath)) {
      files.push(path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/'))
    }
  }
}

/**
 * @returns {string[]}
 */
export function listScopedProductionFiles() {
  /** @type {string[]} */
  const files = []

  for (const root of PRODUCTION_SCAN_ROOTS) {
    const absoluteRoot = path.join(REPO_ROOT, root)
    if (!existsSync(absoluteRoot)) continue

    const stat = statSync(absoluteRoot)
    if (stat.isFile()) {
      if (isProductionSourcePath(root)) files.push(root)
      continue
    }

    walkProductionFiles(absoluteRoot, files)
  }

  return [...new Set(files)].sort()
}

/**
 * @typedef {{ path: string, lines: number, max: number, rule: string }} BudgetViolation
 * @typedef {{ path: string, lines: number, threshold: number, rule: string }} BudgetWarning
 */

/**
 * @returns {{ violations: BudgetViolation[], warnings: BudgetWarning[], files: { path: string, lines: number }[] }}
 */
export function auditFileSizeBudgets() {
  const scopedFiles = listScopedProductionFiles()
  /** @type {BudgetViolation[]} */
  const violations = []
  /** @type {BudgetWarning[]} */
  const warnings = []
  /** @type {{ path: string, lines: number }[]} */
  const files = []

  for (const repoRelativePath of scopedFiles) {
    const lines = countFileLines(repoRelativePath)
    files.push({ path: repoRelativePath, lines })

    if (lines > ABSOLUTE_MAX_LINES) {
      violations.push({
        path: repoRelativePath,
        lines,
        max: ABSOLUTE_MAX_LINES,
        rule: 'absolute max',
      })
    } else if (lines > SPLIT_BEFORE_MERGE_LINES) {
      violations.push({
        path: repoRelativePath,
        lines,
        max: SPLIT_BEFORE_MERGE_LINES,
        rule: 'split before merge',
      })
    } else if (lines > REVIEW_THRESHOLD_LINES) {
      warnings.push({
        path: repoRelativePath,
        lines,
        threshold: REVIEW_THRESHOLD_LINES,
        rule: 'extract candidate review',
      })
    }
  }

  for (const [repoRelativePath, budget] of Object.entries(PHASE5_FILE_BUDGETS)) {
    const lines = countFileLines(repoRelativePath)
    if (lines > budget.max) {
      violations.push({
        path: repoRelativePath,
        lines,
        max: budget.max,
        rule: budget.label ? `phase 5 ${budget.label}` : 'phase 5 budget',
      })
    }
  }

  return { violations, warnings, files }
}

/**
 * @param {{ violations: BudgetViolation[], warnings: BudgetWarning[], files?: { path: string, lines: number }[] }} audit
 * @returns {string}
 */
export function formatAuditReport(audit) {
  const lines = ['World Builder file size budget audit']

  if (audit.files) {
    lines.push(`Scanned: ${audit.files.length} production files`)
  }

  if (audit.violations.length === 0) {
    lines.push('Violations: none')
  } else {
    lines.push(`Violations: ${audit.violations.length}`)
    for (const violation of audit.violations) {
      lines.push(
        `  ${violation.path}: ${violation.lines} lines (max ${violation.max}, ${violation.rule})`,
      )
    }
  }

  if (audit.warnings.length === 0) {
    lines.push(`Warnings (>${REVIEW_THRESHOLD_LINES} lines): none`)
  } else {
    lines.push(
      `Warnings (>${REVIEW_THRESHOLD_LINES} lines, ${audit.warnings[0]?.rule ?? 'extract candidate review'}): ${audit.warnings.length}`,
    )
    for (const warning of audit.warnings) {
      lines.push(
        `  ${warning.path}: ${warning.lines} lines (>${warning.threshold}, review for extract)`,
      )
    }
    lines.push(
      '  Flag these in the merge PR body; split before #382 if any exceed 800 lines.',
    )
  }

  return lines.join('\n')
}

function main() {
  const audit = auditFileSizeBudgets()
  console.log(formatAuditReport(audit))

  if (audit.violations.length > 0) {
    console.error('')
    console.error('File size budget exceeded. See world-builder/docs/FILE-SIZE-BUDGET.md')
    process.exit(1)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
