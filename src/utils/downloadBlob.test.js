import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { downloadBlob } from './downloadBlob.js'

test('downloadBlob creates an anchor with the given filename', () => {
  const clicks = []
  const removed = []
  const appended = []
  const dom = {
    createElement(tag) {
      assert.equal(tag, 'a')
      return {
        href: '',
        download: '',
        click() {
          clicks.push(this.download)
        },
      }
    },
    body: {
      appendChild(node) {
        appended.push(node)
      },
      removeChild(node) {
        removed.push(node)
      },
    },
  }
  globalThis.URL.createObjectURL = () => 'blob:test'
  globalThis.URL.revokeObjectURL = () => {}

  downloadBlob(new Blob(['x'], { type: 'application/pdf' }), 'campaign-kit-seed-1-epoch-0.pdf', dom)

  assert.equal(clicks[0], 'campaign-kit-seed-1-epoch-0.pdf')
  assert.equal(appended.length, 1)
  assert.equal(removed.length, 1)
})

test('downloadBlob defers revokeObjectURL until after click', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const events = []
    const dom = {
      createElement() {
        return {
          href: '',
          download: '',
          click() {
            events.push('click')
          },
        }
      },
      body: {
        appendChild() {},
        removeChild() {},
      },
    }
    globalThis.URL.createObjectURL = () => 'blob:test'
    globalThis.URL.revokeObjectURL = () => events.push('revoke')

    downloadBlob(new Blob(['x'], { type: 'application/pdf' }), 'kit.pdf', dom)

    assert.deepEqual(events, ['click'])
    mock.timers.tick(0)
    assert.deepEqual(events, ['click', 'revoke'])
  } finally {
    mock.timers.reset()
  }
})
