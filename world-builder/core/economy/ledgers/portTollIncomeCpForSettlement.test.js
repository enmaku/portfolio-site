import assert from 'node:assert/strict'
import { test } from 'node:test'
import { portTollIncomeCpForSettlement } from './portTollIncomeCpForSettlement.js'

test('reads mapped port toll income', () => {
  assert.equal(
    portTollIncomeCpForSettlement({ portTollIncomeCpBySettlementId: { p: 42 } }, 'p'),
    42,
  )
})

test('missing map is honest zero (no obligation-delta recovery)', () => {
  assert.equal(
    portTollIncomeCpForSettlement(
      {
        obligationDeltas: [{ toSettlementId: 'p', amountCp: 99, kind: 'toll' }],
      },
      'p',
    ),
    0,
  )
  assert.equal(portTollIncomeCpForSettlement(null, 'p'), 0)
})
