import assert from 'node:assert/strict'
import test from 'node:test'
import { collectWriteupMentionedSettlementIds } from './collectWriteupMentionedSettlementIds.js'

test('collectWriteupMentionedSettlementIds uses writeupSettlementIds only', () => {
  const ids = collectWriteupMentionedSettlementIds({
    writeupSettlementIds: ['a'],
    notableSettlements: [{ settlementId: 'a' }, { settlementId: 'c' }],
  })
  assert.deepEqual(ids, ['a'])
})

test('collectWriteupMentionedSettlementIds falls back to notables when ids omitted', () => {
  const ids = collectWriteupMentionedSettlementIds({
    writeupSettlementIds: [],
    notableSettlements: [{ settlementId: 'a' }, { settlementId: 'b' }],
  })
  assert.deepEqual(ids.sort(), ['a', 'b'])
})

test('collectWriteupMentionedSettlementIds ignores prose / name fields', () => {
  const ids = collectWriteupMentionedSettlementIds({
    writeupSettlementIds: ['a'],
    settlements: { a: 'X', b: 'Y' },
    regionWriteup: 'X leads The X-Y League against rivals.',
  })
  assert.deepEqual(ids, ['a'])
})
