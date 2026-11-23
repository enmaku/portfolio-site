import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePathbuilderId, pathbuilderJsonUrl } from './pathbuilderId.js'

test('bare digits parse to the normalised id string', () => {
  assert.equal(parsePathbuilderId('123456'), '123456')
  assert.equal(parsePathbuilderId('  42 '), '42')
  assert.equal(parsePathbuilderId('007'), '7')
})

test('a Pathbuilder URL with ?id=N parses to N', () => {
  assert.equal(parsePathbuilderId('https://pathbuilder2e.com/json.php?id=99887'), '99887')
  assert.equal(parsePathbuilderId('https://example.com/x?foo=1&id=5'), '5')
})

test('anything else is rejected with null', () => {
  for (const bad of ['', '   ', null, undefined, 'abc', '12a', 'https://x.com/?id=abc', 'https://x.com/', '-5', '1.5']) {
    assert.equal(parsePathbuilderId(bad), null, String(bad))
  }
})

test('pathbuilderJsonUrl builds the plain json.php URL', () => {
  assert.equal(pathbuilderJsonUrl('42'), 'https://pathbuilder2e.com/json.php?id=42')
})
