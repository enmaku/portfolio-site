import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveContestedSettlement } from './resolveContestedSettlement.js'

test('higher projected might wins; ties favor the defender', () => {
  assert.equal(
    resolveContestedSettlement({
      attackerProjectedMight: 120,
      defenderProjectedMight: 100,
      defenderAdvantageOnStake: 1,
    }),
    'attacker',
  )
  assert.equal(
    resolveContestedSettlement({
      attackerProjectedMight: 100,
      defenderProjectedMight: 100,
      defenderAdvantageOnStake: 1,
    }),
    'defender',
  )
  assert.equal(
    resolveContestedSettlement({
      attackerProjectedMight: 110,
      defenderProjectedMight: 100,
      defenderAdvantageOnStake: 1.2,
    }),
    'defender',
  )
})

test('nonzero attacker projection is required to contest', () => {
  assert.equal(
    resolveContestedSettlement({
      attackerProjectedMight: 0,
      defenderProjectedMight: 50,
      defenderAdvantageOnStake: 1.1,
    }),
    'unreachable',
  )
  assert.equal(
    resolveContestedSettlement({
      attackerProjectedMight: -1,
      defenderProjectedMight: 10,
      defenderAdvantageOnStake: 1,
    }),
    'unreachable',
  )
})

test('defender advantage applies to the stake contribution only', () => {
  const without = resolveContestedSettlement({
    attackerProjectedMight: 100,
    defenderProjectedMight: 90,
    stakeDefenderProjectedMight: 90,
    defenderAdvantageOnStake: 1,
  })
  const withWalls = resolveContestedSettlement({
    attackerProjectedMight: 100,
    defenderProjectedMight: 90,
    stakeDefenderProjectedMight: 90,
    defenderAdvantageOnStake: 1.2,
  })
  assert.equal(without, 'attacker')
  assert.equal(withWalls, 'defender')

  const alliesOnlyBoostWouldWin = resolveContestedSettlement({
    attackerProjectedMight: 200,
    defenderProjectedMight: 190,
    stakeDefenderProjectedMight: 10,
    defenderAdvantageOnStake: 1.2,
  })
  assert.equal(alliesOnlyBoostWouldWin, 'attacker')
})
