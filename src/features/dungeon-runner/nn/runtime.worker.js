import * as tf from '@tensorflow/tfjs'
import { decodePolicyIndexToAction } from './policyAdapter.js'

const modelCache = new Map()

self.onmessage = async (event) => {
  const data = event?.data ?? {}
  const { requestId, modelId, legalActions, legalMask, features, samplingMode, randomSeed, debugTrace, hero, activeSeatId, heroLoadout } = data
  try {
    const model = await loadModel(modelId)
    const result = await inferAction(model, features, legalMask, legalActions, samplingMode, randomSeed, hero, activeSeatId, heroLoadout)
    self.postMessage({
      requestId,
      action: result.action,
      debug: debugTrace ? result.debug : undefined,
      backend: tf.getBackend() || 'cpu',
      modelId,
    })
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'MODEL_LOAD_FAILED',
    })
  }
}

async function loadModel(modelId) {
  if (modelId.startsWith('missing')) throw new Error('missing model')
  if (modelCache.has(modelId)) return modelCache.get(modelId)
  const modelUrl = `/models/dungeon-runner/${modelId}/model.json?ts=${Date.now()}`
  const model = await tf.loadLayersModel(modelUrl, { requestInit: { cache: 'no-store' } })
  modelCache.set(modelId, model)
  return model
}

async function inferAction(model, features, legalMask, legalActions, samplingMode = 'stochastic', randomSeed = 1, hero = 'WARRIOR', activeSeatId = null, heroLoadout = null) {
  const obsInput = tf.tensor2d([features])
  const modelInputs = Array.isArray(model.inputs) ? model.inputs.length : 1
  const maskInput = modelInputs > 1 ? tf.tensor2d([legalMask ?? new Array(26).fill(0)]) : null
  const prediction = maskInput ? model.predict([obsInput, maskInput]) : model.predict(obsInput)
  const logitsTensor = selectPolicyLogitsTensor(prediction)
  const values = Array.from(await logitsTensor.data())
  obsInput.dispose()
  maskInput?.dispose()
  disposePrediction(prediction)
  if (values.length === 4) {
    const ACTION_INDEX = ['DRAW', 'ADD_TO_DUNGEON', 'SACRIFICE', 'PASS']
    const bestIndex =
      samplingMode === 'deterministic'
        ? argmax(values)
        : sampleIndexFromScores(values, seededRandomFactory(randomSeed))
    const actionType = ACTION_INDEX[bestIndex] ?? 'PASS'
    return {
      action: legalActions.find((action) => action.type === actionType) ?? legalActions[0] ?? { type: 'PASS' },
      debug: { values, legalMask, selectedIndex: bestIndex, mode: 'legacy-4' },
    }
  }
  const legalIndices = (legalMask ?? [])
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index >= 0 && index < values.length)
  const maskedValues = applyPolicyMask(values, legalMask)
  if (!legalIndices.length) {
    return {
      action: legalActions[0] ?? { type: 'PASS' },
      debug: { values, legalMask, selectedIndex: null, mode: 'policy-26' },
    }
  }
  if (samplingMode === 'deterministic') {
    const best = argmaxOverIndices(maskedValues, legalIndices)
    const state = { hero, heroLoadout, turn: { activeSeatId } }
    return {
      action: decodePolicyIndexToAction(best, legalActions, state, { seatId: activeSeatId }) ?? legalActions[0] ?? { type: 'PASS' },
      debug: { values, legalMask, selectedIndex: best, mode: 'policy-26' },
    }
  }
  const picked = sampleIndexFromScores(maskedValues, seededRandomFactory(randomSeed))
  const state = { hero, heroLoadout, turn: { activeSeatId } }
  return {
    action: decodePolicyIndexToAction(picked, legalActions, state, { seatId: activeSeatId }) ?? legalActions[0] ?? { type: 'PASS' },
    debug: { values, legalMask, selectedIndex: picked, mode: 'policy-26' },
  }
}

function argmax(values) {
  let bestIndex = 0
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[bestIndex]) bestIndex = i
  }
  return bestIndex
}

function argmaxOverIndices(values, indices) {
  let best = indices[0]
  for (let i = 1; i < indices.length; i += 1) {
    const idx = indices[i]
    if (values[idx] > values[best]) best = idx
  }
  return best
}

function selectPolicyLogitsTensor(prediction) {
  if (Array.isArray(prediction)) {
    const ranked = [...prediction].sort((a, b) => {
      const aWidth = a?.shape?.[a.shape.length - 1] ?? 0
      const bWidth = b?.shape?.[b.shape.length - 1] ?? 0
      return bWidth - aWidth
    })
    return ranked[0]
  }
  return prediction
}

function disposePrediction(prediction) {
  if (Array.isArray(prediction)) {
    for (const tensor of prediction) tensor.dispose()
    return
  }
  prediction.dispose()
}

function sampleIndexFromScores(values, randomFn) {
  const max = Math.max(...values)
  const expValues = values.map((value) => Math.exp(value - max))
  const total = expValues.reduce((sum, value) => sum + value, 0)
  if (!total || !Number.isFinite(total)) return argmax(values)
  let cursor = randomFn() * total
  for (let i = 0; i < expValues.length; i += 1) {
    cursor -= expValues[i]
    if (cursor <= 0) return i
  }
  return expValues.length - 1
}

function applyPolicyMask(values, legalMask) {
  const masked = [...values]
  for (let i = 0; i < masked.length; i += 1) {
    if ((legalMask?.[i] ?? 0) <= 0) masked[i] = -1.0e9
  }
  return masked
}

function seededRandomFactory(seed) {
  let state = (seed >>> 0) || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}
