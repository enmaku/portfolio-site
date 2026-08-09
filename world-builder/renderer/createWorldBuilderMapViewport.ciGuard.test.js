import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { viewportTestOptions } from './createWorldBuilderMapViewportTestHarness.js'

const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url))

test('viewport behavioral suites run when Node module mocks are enabled', () => {
  assert.strictEqual(
    viewportTestOptions.skip,
    false,
    'viewport suites are skipped — npm test must pass --experimental-test-module-mocks',
  )
})

test('npm test script enables --experimental-test-module-mocks', () => {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  assert.match(
    pkg.scripts.test,
    /--experimental-test-module-mocks/,
    'package.json scripts.test must include --experimental-test-module-mocks so viewport overlay sync/locality/framing suites are not skipped in CI',
  )
})
