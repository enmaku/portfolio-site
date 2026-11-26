'use strict'
// Test-side helpers (CommonJS) for the critcrafterSheet function. They validate a sheet
// against the single contract, docs/critcrafter/sheet.schema.json. No code is shared with
// the viewer side. ajv is resolved from the repo root devDependencies.
const fs = require('node:fs')
const path = require('node:path')
const Ajv2020 = require('ajv/dist/2020')
const addFormats = require('ajv-formats')

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../docs/critcrafter/sheet.schema.json'), 'utf8'),
)

const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)

function validateSheet(sheet) {
  const valid = validate(sheet) === true
  return { valid, errors: valid ? [] : [...validate.errors] }
}

function assertValidSheet(sheet) {
  const { valid, errors } = validateSheet(sheet)
  if (!valid) {
    throw new Error(`Sheet fails schema validation:\n${ajv.errorsText(errors, { separator: '\n' })}`)
  }
}

function isStat(node) {
  return (
    node !== null &&
    typeof node === 'object' &&
    !Array.isArray(node) &&
    typeof node.value === 'number' &&
    Array.isArray(node.breakdown)
  )
}

/** Every Stat in the sheet whose breakdown amounts do not sum to its value. */
function findSumInvariantViolations(sheet) {
  const violations = []
  const walk = (node, p) => {
    if (node === null || typeof node !== 'object') return
    if (isStat(node)) {
      const sum = node.breakdown.reduce((n, b) => n + b.amount, 0)
      if (Math.abs(sum - node.value) > 1e-9) violations.push({ path: p, value: node.value, sum })
    }
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${p}[${i}]`))
    } else {
      for (const [k, child] of Object.entries(node)) walk(child, p ? `${p}.${k}` : k)
    }
  }
  walk(sheet, '')
  return violations
}

function assertSumInvariant(sheet) {
  const v = findSumInvariantViolations(sheet)
  if (v.length) {
    throw new Error(
      `Sum invariant broken: ${v.map((x) => `${x.path} (value ${x.value}, breakdown sums to ${x.sum})`).join('; ')}`,
    )
  }
}

function stat(value) {
  return { value, breakdown: [{ label: 'Base', amount: value, type: 'base' }] }
}

/** Smallest schema-valid sheet. */
function minimalSheet() {
  return {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    corpus: { sha: 'stub' },
    warnings: [],
    header: {
      name: 'Fixture',
      level: 1,
      ancestry: 'Human',
      classLine: 'Fighter',
      hp: stat(18),
      perception: stat(5),
      speed: stat(25),
      unarmoredAc: stat(10),
    },
    stats: {
      abilities: [{ id: 'str', score: 18, mod: 4 }],
      saves: [{ id: 'fortitude', name: 'Fortitude', rank: 'T', bonus: stat(5) }],
      classDc: stat(10),
    },
    skills: [],
    gear: {
      bulk: { ...stat(0), encumberedAt: 9, max: 14 },
      weapons: [],
      shields: [],
      armor: [],
      consumables: [],
      gear: [],
    },
    spells: { casters: [], focus: null, rituals: [] },
    actions: { groups: [] },
    features: { groups: [] },
  }
}

module.exports = {
  validateSheet,
  assertValidSheet,
  findSumInvariantViolations,
  assertSumInvariant,
  minimalSheet,
}
