import { ACTION_TYPES, getLegalActions } from '../engine/kernel.js'
import * as tf from '@tensorflow/tfjs'
import { buildPolicyLegalMask, buildPolicyObservation, decodePolicyIndexToAction } from './policyAdapter.js'

const modelCache = new Map()
let sharedWorker = null
const workerRequests = new Map()
let workerRequestId = 1
let scheduledInferenceQueue = Promise.resolve()

export async function chooseNnActionWithFallback(state, actor, options) {
  const legal = getLegalActions(state, actor)
  if (!legal.length) return null
  if (legal.length === 1) {
    console.log('[DungeonRunner][NNVector][SingleLegal]', legal[0])
    options?.debugLogger?.({
      kind: 'single-legal',
      legalActions: legal,
      selectedAction: legal[0],
      seatId: actor.seatId,
    })
    return legal[0]
  }
  const modelId = options?.modelId ?? 'latest'
  const backend = tf.getBackend() || 'cpu'
  const first = await attemptSample(modelId, state, legal, options)
  if (first.ok && first.action) return first.action
  const second = await attemptSample(modelId, state, legal, options)
  if (second.ok && second.action) return second.action
  if (!first.ok || !second.ok) {
    const fallback = createFallbackAction(legal, { backend, fallbackReason: 'MODEL_LOAD_FAILED', modelId })
    console.log('[DungeonRunner][NNVector][Fallback]', {
      reason: 'MODEL_LOAD_FAILED',
      firstError: first.errorMessage,
      secondError: second.errorMessage,
      legalActions: legal,
      selectedAction: fallback,
    })
    options?.debugLogger?.({
      kind: 'fallback',
      fallbackReason: 'MODEL_LOAD_FAILED',
      firstError: first.errorMessage,
      secondError: second.errorMessage,
      legalActions: legal,
      selectedAction: fallback,
      seatId: actor.seatId,
    })
    return fallback
  }
  const fallback = createFallbackAction(legal, { backend, fallbackReason: 'ILLEGAL_OUTPUT', modelId })
  console.log('[DungeonRunner][NNVector][Fallback]', {
    reason: 'ILLEGAL_OUTPUT',
    legalActions: legal,
    selectedAction: fallback,
  })
  options?.debugLogger?.({
    kind: 'fallback',
    fallbackReason: 'ILLEGAL_OUTPUT',
    legalActions: legal,
    selectedAction: fallback,
    seatId: actor.seatId,
  })
  return fallback
}

async function attemptSample(modelId, state, legal, options) {
  try {
    return { ok: true, action: await sampleAction(modelId, state, legal, options), errorMessage: null }
  } catch (error) {
    return {
      ok: false,
      action: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

async function sampleAction(modelId, state, legal, options) {
  const sampled = await runScheduledInference(async () => {
    return inferActionWithBestRuntime(modelId, state, legal, options)
  })
  if (!sampled || !legal.some((action) => action.type === sampled.type)) return null
  if (sampled.__debug && typeof options?.debugLogger === 'function') {
    options.debugLogger(sampled.__debug)
  }
  if (sampled?.__debug?.values) console.log('[DungeonRunner][NNVector]', sampled.__debug.values)
  return {
    ...sampled,
    meta: {
      backend: sampled.backend ?? tf.getBackend() ?? 'cpu',
      modelId: sampled.modelId ?? modelId,
    },
  }
}

async function runScheduledInference(task) {
  const current = scheduledInferenceQueue.catch(() => {}).then(task)
  scheduledInferenceQueue = current
  return current
}

async function loadModel(modelId) {
  if (modelId.startsWith('missing')) throw new Error('missing model')
  if (modelCache.has(modelId)) return modelCache.get(modelId)
  const modelUrl = `/models/dungeon-runner/${modelId}/model.json?ts=${Date.now()}`
  const model = await tf.loadLayersModel(modelUrl, { requestInit: { cache: 'no-store' } })
  modelCache.set(modelId, model)
  return model
}

async function inferActionWithBestRuntime(modelId, state, legal, options) {
  const backendHint = tf.getBackend() || 'cpu'
  const randomSeed = createSamplingSeed(state, modelId, backendHint)
  if (typeof Worker === 'function') {
    const workerAction = await inferActionViaWorker(modelId, state, legal, options, randomSeed)
    if (workerAction) return workerAction
  }
  const model = await loadModel(modelId)
  const action = await inferAction(model, state, legal, options, randomSeed)
  return {
    ...action,
    backend: backendHint,
    modelId,
  }
}

async function inferAction(model, state, legal, options, randomSeed) {
  const features = buildPolicyObservation(state, { seatId: state.turn.activeSeatId })
  const legalMask = buildPolicyLegalMask(state, { seatId: state.turn.activeSeatId }, legal)
  const obsInput = tf.tensor2d([features])
  const modelInputs = Array.isArray(model.inputs) ? model.inputs.length : 1
  const maskInput = modelInputs > 1 ? tf.tensor2d([legalMask]) : null
  const prediction = maskInput ? model.predict([obsInput, maskInput]) : model.predict(obsInput)
  const logitsTensor = selectPolicyLogitsTensor(prediction)
  const values = Array.from(await logitsTensor.data())
  obsInput.dispose()
  maskInput?.dispose()
  disposePrediction(prediction)
  const selected = selectActionFromScores(values, legalMask, legal, options, randomSeed, state, { seatId: state.turn.activeSeatId })
  console.log('[DungeonRunner][NNRawValues]', values)
  return {
    ...selected.action,
    __debug: {
      mode: selected.mode,
      values,
      legalMask,
      selectedIndex: selected.selectedIndex,
      features,
    },
  }
}

async function inferActionViaWorker(modelId, state, legal, options, randomSeed) {
  const worker = getOrCreateWorker()
  if (!worker) return null
  const requestId = `req-${workerRequestId++}`
  return new Promise((resolve, reject) => {
    workerRequests.set(requestId, {
      resolve,
      reject,
    })
    worker.postMessage({
      requestId,
      modelId,
      samplingMode: options?.samplingMode ?? 'stochastic',
      randomSeed,
      debugTrace: true,
      legalMask: buildPolicyLegalMask(state, { seatId: state.turn.activeSeatId }, legal),
      legalActions: legal,
      features: buildPolicyObservation(state, { seatId: state.turn.activeSeatId }),
      hero: state.hero,
      activeSeatId: state.turn.activeSeatId,
      heroLoadout: state.heroLoadout,
    })
  })
}

function getOrCreateWorker() {
  if (sharedWorker) return sharedWorker
  if (typeof Worker !== 'function') return null
  try {
    sharedWorker = new Worker(new URL('./runtime.worker.js', import.meta.url), { type: 'module' })
    sharedWorker.onmessage = (event) => {
      const data = event?.data ?? {}
      const pending = workerRequests.get(data.requestId)
      if (!pending) return
      workerRequests.delete(data.requestId)
      if (data.error) {
        pending.reject(new Error(data.error))
        return
      }
      pending.resolve(
        data.action
          ? { ...data.action, backend: data.backend, modelId: data.modelId, __debug: data.debug ?? undefined }
          : null,
      )
    }
    sharedWorker.onerror = (error) => {
      for (const pending of workerRequests.values()) {
        pending.reject(error)
      }
      workerRequests.clear()
      sharedWorker?.terminate()
      sharedWorker = null
    }
  } catch {
    sharedWorker = null
  }
  return sharedWorker
}

function selectActionFromScores(values, legalMask, legalActions, options, randomSeed, state, actor) {
  if (values.length === 4) {
    const legacyActionType = selectLegacyActionType(values, options, randomSeed)
    const action = legalActions.find((candidate) => candidate.type === legacyActionType) ?? legalActions[0]
    return { action, selectedIndex: null, mode: 'legacy-4' }
  }
  const legalIndices = legalMask
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index >= 0 && index < values.length)
  if (!legalIndices.length) return { action: legalActions[0], selectedIndex: null, mode: 'policy-26' }
  const maskedValues = applyPolicyMask(values, legalMask)
  const samplingMode = options?.samplingMode ?? 'stochastic'
  if (samplingMode === 'deterministic') {
    const bestIndex = argmaxOverIndices(maskedValues, legalIndices)
    return {
      action: decodePolicyIndexToAction(bestIndex, legalActions, state, actor) ?? legalActions[0],
      selectedIndex: bestIndex,
      mode: 'policy-26',
    }
  }
  const randomFn = options?.random ?? seededRandomFactory(randomSeed)
  const pickedIndex = sampleIndexFromScores(maskedValues, randomFn)
  return {
    action: decodePolicyIndexToAction(pickedIndex, legalActions, state, actor) ?? legalActions[0],
    selectedIndex: pickedIndex,
    mode: 'policy-26',
  }
}

function selectLegacyActionType(values, options, randomSeed) {
  const ACTION_INDEX = [ACTION_TYPES.DRAW, ACTION_TYPES.ADD_TO_DUNGEON, ACTION_TYPES.SACRIFICE, ACTION_TYPES.PASS]
  const samplingMode = options?.samplingMode ?? 'stochastic'
  if (samplingMode === 'deterministic') return ACTION_INDEX[argmax(values)] ?? ACTION_TYPES.PASS
  const randomFn = options?.random ?? seededRandomFactory(randomSeed)
  return ACTION_INDEX[sampleIndexFromScores(values, randomFn)] ?? ACTION_TYPES.PASS
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

function createFallbackAction(legalActions, meta) {
  if (!legalActions.some((action) => action.type === ACTION_TYPES.PASS)) {
    return { ...legalActions[0], meta }
  }
  return { type: ACTION_TYPES.PASS, meta }
}

function applyPolicyMask(values, legalMask) {
  const masked = [...values]
  for (let i = 0; i < masked.length; i += 1) {
    if ((legalMask?.[i] ?? 0) <= 0) masked[i] = -1.0e9
  }
  return masked
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

function createSamplingSeed(state, modelId, backend) {
  const base = `${state.rng.seed}:${state.rng.state}:${state.rng.step}:${state.turn.activeSeatId}:${modelId}:${backend}`
  return hashString32(base)
}

function hashString32(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandomFactory(seed) {
  let state = (seed >>> 0) || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function resetNnRuntimeForTests() {
  if (sharedWorker) {
    sharedWorker.terminate()
    sharedWorker = null
  }
  workerRequests.clear()
  workerRequestId = 1
  scheduledInferenceQueue = Promise.resolve()
  modelCache.clear()
}
