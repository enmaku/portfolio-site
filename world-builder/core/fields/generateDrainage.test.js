import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDrainage } from './generateDrainage.js'

test('generateDrainage scales permeability when soilDrainageScale differs from 1', () => {
  const params = { geographySeed: 42, width: 8, height: 8 }
  const baseline = generateDrainage({ ...params, options: { soilDrainageScale: 1 } })
  const reduced = generateDrainage({ ...params, options: { soilDrainageScale: 0.5 } })

  let sawReduction = false
  for (let i = 0; i < baseline.length; i += 1) {
    assert.ok(reduced[i] <= baseline[i] + 1e-6)
    if (reduced[i] < baseline[i] - 1e-6) {
      sawReduction = true
    }
  }
  assert.ok(sawReduction)
})
