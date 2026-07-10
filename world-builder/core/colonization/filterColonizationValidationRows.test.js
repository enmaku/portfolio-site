import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COLONIZATION_GAP_CHECK_IDS,
  colonizationAdvisoryRequiresConfirm,
  filterColonizationValidationRows,
  resolveColonizationGeographyGaps,
} from './filterColonizationValidationRows.js'

test('filterColonizationValidationRows keeps colonization-relevant non-pass rows only', () => {
  const rows = [
    { checkId: 'coastMouth', status: 'fail', summary: 'a' },
    { checkId: 'hacksLawExponent', status: 'fail', summary: 'b' },
    { checkId: 'arableEnvelopeCoverage', status: 'warn', summary: 'c' },
    { checkId: 'navigableRiverQuota', status: 'pass', summary: 'd' },
    { checkId: 'biomeDiversity', status: 'fail', summary: 'e' },
  ]

  const filtered = filterColonizationValidationRows(rows, {})

  const ids = filtered.map((row) => row.checkId)
  assert.ok(ids.includes('coastMouth'))
  assert.ok(ids.includes('arableEnvelopeCoverage'))
  assert.ok(!ids.includes('hacksLawExponent'))
  assert.ok(!ids.includes('navigableRiverQuota'))
  assert.ok(!ids.includes('biomeDiversity'))
})

test('filterColonizationValidationRows adds gap rows for missing colonization geography', () => {
  const filtered = filterColonizationValidationRows([], {
    sailLandingCellCount: 0,
    hasFreshwaterBands: false,
  })

  const ids = filtered.map((row) => row.checkId)
  assert.ok(ids.includes(COLONIZATION_GAP_CHECK_IDS.weakSailOverlayForLanding))
  assert.ok(ids.includes(COLONIZATION_GAP_CHECK_IDS.noFreshwaterBands))
  assert.ok(filtered.every((row) => row.status === 'warn' || row.status === 'fail'))
})

test('filterColonizationValidationRows omits gap rows when geography inputs exist', () => {
  const filtered = filterColonizationValidationRows([], {
    sailLandingCellCount: 12,
    hasFreshwaterBands: true,
  })

  const ids = filtered.map((row) => row.checkId)
  assert.ok(!ids.includes(COLONIZATION_GAP_CHECK_IDS.weakSailOverlayForLanding))
  assert.ok(!ids.includes(COLONIZATION_GAP_CHECK_IDS.noFreshwaterBands))
})

test('colonizationAdvisoryRequiresConfirm is true only when a listed row is fail', () => {
  assert.strictEqual(
    colonizationAdvisoryRequiresConfirm([{ checkId: 'coastMouth', status: 'warn' }]),
    false,
  )
  assert.strictEqual(
    colonizationAdvisoryRequiresConfirm([{ checkId: 'coastMouth', status: 'fail' }]),
    true,
  )
  assert.strictEqual(colonizationAdvisoryRequiresConfirm([]), false)
})

test('resolveColonizationGeographyGaps reports no gaps without a generation report', () => {
  assert.deepStrictEqual(resolveColonizationGeographyGaps(null), {})
  assert.deepStrictEqual(resolveColonizationGeographyGaps({ gridWidth: 2 }), {})
  assert.deepStrictEqual(filterColonizationValidationRows([], {}), [])
})
