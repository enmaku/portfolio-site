// Test-side helpers (ESM) for the viewer. They validate a sheet against the single
// contract, docs/critcrafter/sheet.schema.json. No code is shared with the function side.
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const schema = JSON.parse(
  readFileSync(new URL('../../../../docs/critcrafter/sheet.schema.json', import.meta.url), 'utf8'),
)

const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true })
addFormats(ajv)
const validate =ajv.compile(schema)

export function validateSheet(sheet) {
  const valid = validate(sheet) === true
  return { valid, errors: valid ? [] : [...validate.errors] }
}

export function assertValidSheet(sheet) {
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
export function findSumInvariantViolations(sheet) {
  const violations = []
  const walk = (node, path) => {
    if (node === null || typeof node !== 'object') return
    if (isStat(node)) {
      const sum = node.breakdown.reduce((n, b) => n + b.amount, 0)
      if (Math.abs(sum - node.value) > 1e-9) violations.push({ path, value: node.value, sum })
    }
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`))
    } else {
      for (const [k, child] of Object.entries(node)) walk(child, path ? `${path}.${k}` : k)
    }
  }
  walk(sheet, '')
  return violations
}

export function assertSumInvariant(sheet) {
  const v = findSumInvariantViolations(sheet)
  if (v.length) {
    throw new Error(
      `Sum invariant broken: ${v.map((x) => `${x.path} (value ${x.value}, breakdown sums to ${x.sum})`).join('; ')}`,
    )
  }
}
