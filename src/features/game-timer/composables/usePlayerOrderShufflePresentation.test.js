import assert from 'node:assert/strict'
import test from 'node:test'
import {
  finishPlayerOrderShufflePresentation,
  runPlayerOrderShufflePresentation,
  usePlayerOrderShufflePresentation,
} from './usePlayerOrderShufflePresentation.js'

test('shuffle presentation exposes deterministic intermediate orders and target', async () => {
  const presentation = usePlayerOrderShufflePresentation()
  const seenOrders = []
  const target = await runPlayerOrderShufflePresentation({
    playerIds: ['a', 'b', 'c'],
    seed: 42,
    sleep: async () => {
      seenOrders.push([...presentation.displayedPlayerIds.value])
    },
  })

  assert.ok(seenOrders.length >= 18)
  assert.deepEqual(presentation.displayedPlayerIds.value, target)
  assert.equal(presentation.isPlayerOrderShuffling.value, true)
  finishPlayerOrderShufflePresentation()
  assert.equal(presentation.displayedPlayerIds.value, null)
  assert.equal(presentation.isPlayerOrderShuffling.value, false)
})

test('finishing a shuffle cancels its pending presentation', async () => {
  let releaseStep
  const pendingStep = new Promise((resolve) => {
    releaseStep = resolve
  })
  const resultPromise = runPlayerOrderShufflePresentation({
    playerIds: ['a', 'b'],
    seed: 7,
    sleep: () => pendingStep,
  })

  finishPlayerOrderShufflePresentation()
  releaseStep()

  assert.equal(await resultPromise, null)
})
