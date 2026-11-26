import test from 'node:test'
import assert from 'node:assert/strict'
import { createSheetStack } from './sheetStack.js'

const stat = { value: 5, breakdown: [{ label: 'Level', amount: 5, type: 'level' }] }

test('openBreakdown shows one breakdown sheet', () => {
  const s = createSheetStack()
  assert.equal(s.top.value, null)
  s.openBreakdown({ label: 'Fortitude', stat, signed: true })
  assert.equal(s.top.value.kind, 'breakdown')
  assert.equal(s.top.value.view.total, '+5')
  assert.equal(s.canGoBack.value, false)
})

test('openDetail stacks on the breakdown and back returns to it', () => {
  const s = createSheetStack()
  s.openBreakdown({ label: 'Athletics', stat })
  s.openDetail({ name: 'Grapple', traits: [], rules: null, aonUrl: 'u' })
  assert.equal(s.top.value.kind, 'detail')
  assert.equal(s.canGoBack.value, true)
  s.back()
  assert.equal(s.top.value.kind, 'breakdown')
  s.back()
  assert.equal(s.top.value, null)
})

test('close clears the whole stack; a fresh openBreakdown replaces, not stacks', () => {
  const s = createSheetStack()
  s.openBreakdown({ label: 'A', stat })
  s.openDetail({ name: 'x', traits: [], rules: null, aonUrl: null })
  s.close()
  assert.equal(s.top.value, null)
  s.openBreakdown({ label: 'A', stat })
  s.openBreakdown({ label: 'B', stat })
  assert.equal(s.top.value.view.title, 'B')
  s.back()
  assert.equal(s.top.value, null)
})
