import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateScoreExpression } from './evaluateScoreExpression.js'

test('evaluateScoreExpression accepts finite numbers including negatives', () => {
  assert.equal(evaluateScoreExpression(12), 12)
  assert.equal(evaluateScoreExpression(0), 0)
  assert.equal(evaluateScoreExpression(-7), -7)
  assert.equal(evaluateScoreExpression(Number.NaN), null)
  assert.equal(evaluateScoreExpression(Infinity), null)
})

test('evaluateScoreExpression parses numeric strings including negatives and decimals', () => {
  assert.equal(evaluateScoreExpression('12'), 12)
  assert.equal(evaluateScoreExpression('  -7 '), -7)
  assert.equal(evaluateScoreExpression('+3'), 3)
  assert.equal(evaluateScoreExpression('2.5'), 2.5)
  assert.equal(evaluateScoreExpression(''), null)
  assert.equal(evaluateScoreExpression('   '), null)
  assert.equal(evaluateScoreExpression(null), null)
})

test('evaluateScoreExpression evaluates basic addition and subtraction', () => {
  assert.equal(evaluateScoreExpression('10+5'), 15)
  assert.equal(evaluateScoreExpression('10-3'), 7)
  assert.equal(evaluateScoreExpression('1 + 2 + 3'), 6)
  assert.equal(evaluateScoreExpression('20-5-5'), 10)
  assert.equal(evaluateScoreExpression('-2+5'), 3)
  assert.equal(evaluateScoreExpression('10+-3'), 7)
  assert.equal(evaluateScoreExpression('10--3'), 13)
  assert.equal(evaluateScoreExpression('4.5+1.5-2'), 4)
  assert.equal(evaluateScoreExpression('8−3'), 5)
})

test('evaluateScoreExpression rejects unsupported or incomplete expressions', () => {
  assert.equal(evaluateScoreExpression('10+'), null)
  assert.equal(evaluateScoreExpression('10*2'), null)
  assert.equal(evaluateScoreExpression('(1+2)'), null)
  assert.equal(evaluateScoreExpression('1/2'), null)
  assert.equal(evaluateScoreExpression('abc'), null)
  assert.equal(evaluateScoreExpression('1+2a'), null)
})
