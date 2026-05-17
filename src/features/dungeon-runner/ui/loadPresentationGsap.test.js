import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPresentationGsap } from './loadPresentationGsap.js'

test('loadPresentationGsap loads gsap + Flip via import hook and registers Flip once', async () => {
  let registrations = 0
  const Flip = { pluginName: 'flip-mock' }
  const gsap = {
    registerPlugin(plugin) {
      registrations += 1
      assert.strictEqual(plugin, Flip)
    },
  }
  /** @type {string[]} */
  const specifiers = []
  async function importFn(specifier) {
    specifiers.push(specifier)
    if (specifier === 'gsap') return { default: gsap }
    if (specifier === 'gsap/Flip') return { Flip }
    assert.fail(`unexpected specifier: ${specifier}`)
  }

  const first = await loadPresentationGsap({ import: importFn })
  const second = await loadPresentationGsap({ import: importFn })

  assert.deepEqual(
    specifiers.filter((s) => s === 'gsap'),
    ['gsap', 'gsap'],
  )
  assert.deepEqual(
    specifiers.filter((s) => s === 'gsap/Flip'),
    ['gsap/Flip', 'gsap/Flip'],
  )
  assert.strictEqual(registrations, 1)
  assert.strictEqual(first.gsap, gsap)
  assert.strictEqual(first.Flip, Flip)
  assert.strictEqual(second.gsap, gsap)
  assert.strictEqual(second.Flip, Flip)
})
