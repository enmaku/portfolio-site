import assert from 'node:assert/strict'
import test from 'node:test'
import { createLatestAttendanceWrite } from './latestAttendanceWrite.js'

function deferred() {
  /** @type {(value?: unknown) => void} */
  let resolve
  /** @type {(error: Error) => void} */
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('writes the newest selection when another tap lands mid-save', async () => {
  const calls = []
  const first = deferred()
  const queue = createLatestAttendanceWrite(async (ids) => {
    calls.push([...ids])
    if (calls.length === 1) await first.promise
  })

  const firstPush = queue.push(['a'])
  const secondPush = queue.push(['a', 'b'])
  assert.deepEqual(calls, [['a']])
  assert.equal(queue.pending, true)

  first.resolve()
  await firstPush
  await secondPush

  assert.deepEqual(calls, [['a'], ['a', 'b']])
  assert.equal(queue.pending, false)
})

test('a failed save is ignored once a newer selection is queued', async () => {
  const calls = []
  const first = deferred()
  const queue = createLatestAttendanceWrite(async (ids) => {
    calls.push([...ids])
    if (calls.length === 1) {
      await first.promise
      throw new Error('stale')
    }
  })

  const done = Promise.all([queue.push(['a']), queue.push(['a', 'b'])])
  first.resolve()
  await done

  assert.deepEqual(calls, [['a'], ['a', 'b']])
  assert.equal(queue.pending, false)
})

test('flush rejects when the latest save fails', async () => {
  const queue = createLatestAttendanceWrite(async () => {
    throw new Error('offline')
  })

  await assert.rejects(queue.push(['a']), /offline/)
  assert.equal(queue.pending, false)
})
