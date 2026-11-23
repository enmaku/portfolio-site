#!/usr/bin/env node
// Regenerates the viewer's sheet fixtures from the committed Pathbuilder exports.
// Fixtures are generated, never hand-edited: re-run this after a schema change.
//
//   node scripts/critcrafter-regenerate-fixtures.mjs
//
// Until the critcrafterSheet function exists (ticket #500), `stubBuildSheet` emits a
// minimal schema-valid sheet. Wire `defaultBuildSheet` to the real function when it lands.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { minimalSheet } from '../src/features/critcrafter/test/minimalSheet.js'
import { validateSheet } from '../src/features/critcrafter/test/sheetSchema.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const EXPORTS_DIR = path.join(root, 'docs/critcrafter/fixtures/pathbuilder-exports')
export const FIXTURES_DIR = path.join(root, 'src/features/critcrafter/fixtures')

/** Placeholder for the real function: identity from the export, everything else minimal. */
export function stubBuildSheet(pbExport) {
  const b = pbExport.build
  const sheet = minimalSheet()
  sheet.header.name = b.name
  sheet.header.level = b.level
  sheet.header.ancestry = b.ancestry
  sheet.header.classLine = b.dualClass ? `${b.class} / ${b.dualClass}` : b.class
  return sheet
}

// TODO(#500): replace with the real critcrafterSheet function.
const defaultBuildSheet = stubBuildSheet

/** Returns the file names written. Nothing is written if any sheet fails the schema. */
export function regenerateFixtures({
  exportsDir = EXPORTS_DIR,
  outDir = FIXTURES_DIR,
  buildSheet = defaultBuildSheet,
} = {}) {
  const names = fs
    .readdirSync(exportsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const sheets = names.map((f) => {
    const sheet = buildSheet(JSON.parse(fs.readFileSync(path.join(exportsDir, f), 'utf8')))
    const { valid, errors } = validateSheet(sheet)
    if (!valid) {
      throw new Error(`${f}: generated sheet fails schema: ${JSON.stringify(errors.slice(0, 3))}`)
    }
    return [f.replace(/\.json$/, '.sheet.json'), sheet]
  })
  fs.mkdirSync(outDir, { recursive: true })
  for (const [file, sheet] of sheets) {
    fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(sheet, null, 2)}\n`)
  }
  return sheets.map(([file]) => file)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const written = regenerateFixtures()
  console.log(`Wrote ${written.length} sheet fixtures to ${path.relative(root, FIXTURES_DIR)}`)
}
