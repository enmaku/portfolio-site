import { ACTION_TYPES, getLegalActions } from '../engine/kernel.js'
import * as tf from '@tensorflow/tfjs'
import { buildPolicyLegalMask, buildPolicyObservation, decodePolicyIndexToAction } from './policyAdapter.js'
import { createPipelineStepLogger } from './nnPipelineTrace.js'

const modelCache = new Map()
let sharedWorker = null
const workerRequests = new Map()
let workerRequestId = 1
let scheduledInferenceQueue = Promise.resolve()
/**
 * Main-thread WebGL inference (fast once cached). The TF worker only imports CPU tfjs
 * and cold predict/load routinely exceeds NN_WORKER_TIMEOUT_MS.
 */
let workerPathDisabled = true

export const DEFAULT_NN_WORKER_TIMEOUT_MS = 8_000
export const DEFAULT_NN_MODEL_LOAD_TIMEOUT_MS = 12_000
/** Cap time spent in the scheduled inference queue for one sample (0 = no cap). */
/** Used only when callers explicitly cap inference time (not AI turns during play). */
export const DEFAULT_NN_INFER_BUDGET_MS = 600

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {() => Error} createError
 * @returns {Promise<T>}
 */
function promiseWithTimeout(promise, timeoutMs, createError) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(createError()), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

export async function chooseNnActionWithFallback(state, actor, options) {
  const trace = createPipelineStepLogger('NN', Boolean(options?.pipelineTrace), {
    modelId: options?.modelId ?? 'latest',
    seatId: actor.seatId,
    phase: state.phase,
    turnNumber: state.turn?.turnNumber,
  })
  trace('choose.start', { backend: tf.getBackend() || 'cpu' })
  const legal = getLegalActions(state, actor)
  if (!legal.length) {
    trace('choose.no-legal-actions')
    return null
  }
  if (legal.length === 1) {
    trace('choose.single-legal', { actionType: legal[0].type })
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
  trace('choose.sample.begin', { legalCount: legal.length })
  const sample = await attemptSample(modelId, state, legal, options)
  if (sample.ok && sample.action) {
    if (sample.action.meta?.fallbackReason === 'INFER_BUDGET_EXCEEDED') {
      trace('choose.fallback-budget', { actionType: sample.action.type })
    } else {
      trace('choose.sample.ok', { actionType: sample.action.type, backend: sample.action.meta?.backend })
    }
    return sample.action
  }
  if (!sample.ok) {
    trace('choose.sample.failed', { errorMessage: sample.errorMessage })
    const fallback = createFallbackAction(legal, state, {
      backend,
      fallbackReason: 'MODEL_LOAD_FAILED',
      modelId,
    })
    options?.debugLogger?.({
      kind: 'fallback',
      fallbackReason: 'MODEL_LOAD_FAILED',
      firstError: sample.errorMessage,
      legalActions: legal,
      selectedAction: fallback,
      seatId: actor.seatId,
    })
    return fallback
  }
  const fallback = createFallbackAction(legal, state, {
    backend,
    fallbackReason: 'ILLEGAL_OUTPUT',
    modelId,
  })
  options?.debugLogger?.({
    kind: 'fallback',
    fallbackReason: 'ILLEGAL_OUTPUT',
    legalActions: legal,
    selectedAction: fallback,
    seatId: actor.seatId,
  })
  trace('choose.fallback', { fallbackReason: 'ILLEGAL_OUTPUT', actionType: fallback.type })
  return fallback
}

/** Preload TF.js models so the first AI turn does not pay fetch/parse cost. */
export async function warmNnModelCache(modelIds, options = {}) {
  const unique = [...new Set((modelIds ?? []).filter(Boolean))]
  await Promise.all(unique.map((modelId) => loadModel(modelId, options).catch(() => {})))
}

/** Preload models on the main thread and in the inference worker. */
export async function warmNnRuntime(modelIds, options = {}) {
  const unique = [...new Set((modelIds ?? []).filter(Boolean))]
  await warmNnModelCache(unique, options)
  if (workerPathDisabled || typeof Worker !== 'function') return
  await Promise.all(unique.map((modelId) => warmNnWorkerModel(modelId, options).catch(() => {})))
}

async function warmNnWorkerModel(modelId, options = {}) {
  const worker = getOrCreateWorker()
  if (!worker) return
  const requestId = `warm-${workerRequestId++}`
  const timeoutMs = options.loadTimeoutMs ?? DEFAULT_NN_MODEL_LOAD_TIMEOUT_MS
  await promiseWithTimeout(
    new Promise((resolve, reject) => {
      workerRequests.set(requestId, { resolve, reject })
      worker.postMessage({ kind: 'warm', requestId, modelId })
    }),
    timeoutMs,
    () => new Error('NN_WORKER_WARM_TIMEOUT'),
  )
  workerRequests.delete(requestId)
}

async function attemptSample(modelId, state, legal, options) {
  try {
    const sample = await sampleAction(modelId, state, legal, options)
    if (sample.inferBudgetExceeded) {
      return {
        ok: true,
        action: createFallbackAction(legal, state, {
          backend: tf.getBackend() || 'cpu',
          fallbackReason: 'INFER_BUDGET_EXCEEDED',
          modelId,
        }),
        errorMessage: null,
      }
    }
    return { ok: true, action: sample.action, errorMessage: null }
  } catch (error) {
    return {
      ok: false,
      action: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

async function sampleAction(modelId, state, legal, options) {
  const budgetMs = options?.inferBudgetMs ?? 0
  const inferTask = () => runScheduledInference(async () => {
    return inferActionWithBestRuntime(modelId, state, legal, options)
  }, options)
  let sampled
  if (budgetMs > 0) {
    const raced = await Promise.race([
      inferTask().then((value) => ({ kind: 'ok', value })),
      new Promise((resolve) => {
        setTimeout(() => resolve({ kind: 'timeout' }), budgetMs)
      }),
    ])
    if (raced.kind === 'timeout') {
      return { action: null, inferBudgetExceeded: true }
    }
    sampled = raced.value
  } else {
    sampled = await inferTask()
  }
  if (!sampled || !legal.some((action) => action.type === sampled.type)) {
    return { action: null, inferBudgetExceeded: false }
  }
  if (sampled.__debug && typeof options?.debugLogger === 'function') {
    options.debugLogger(sampled.__debug)
  }
  return {
    action: {
      ...sampled,
      meta: {
        backend: sampled.backend ?? tf.getBackend() ?? 'cpu',
        modelId: sampled.modelId ?? modelId,
      },
    },
    inferBudgetExceeded: false,
  }
}

/** Drop queued inference waiters so a new sample is not blocked by an abandoned prefetch. */
export function abandonScheduledInferenceQueue() {
  scheduledInferenceQueue = Promise.resolve()
}

async function runScheduledInference(task, options) {
  const trace = createPipelineStepLogger('NN', Boolean(options?.pipelineTrace), {
    modelId: options?.modelId ?? 'latest',
  })
  const queueWaitStart = performance.now()
  let queueEntered = false
  const current = scheduledInferenceQueue.catch(() => {}).then(async () => {
    if (!queueEntered) {
      queueEntered = true
      trace('inference.queue.enter', { queueWaitMs: Math.round(performance.now() - queueWaitStart) })
    }
    return task()
  })
  scheduledInferenceQueue = current
  return current
}

async function loadModel(modelId, options = {}) {
  const trace = createPipelineStepLogger('NN', Boolean(options?.pipelineTrace), { modelId })
  if (modelId.startsWith('missing')) throw new Error('missing model')
  if (modelCache.has(modelId)) {
    trace('model.cache-hit')
    return modelCache.get(modelId)
  }
  const baseUrl = import.meta.env?.BASE_URL ?? '/'
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const modelUrl = `${prefix}models/dungeon-runner/${modelId}/model.json?ts=${Date.now()}`
  const timeoutMs = options.loadTimeoutMs ?? DEFAULT_NN_MODEL_LOAD_TIMEOUT_MS
  trace('model.load.begin', { modelUrl, timeoutMs })
  const loadStart = performance.now()
  const model = await promiseWithTimeout(
    tf.loadLayersModel(modelUrl, { requestInit: { cache: 'no-store' } }),
    timeoutMs,
    () => new Error('MODEL_LOAD_TIMEOUT'),
  )
  trace('model.load.done', { loadMs: Math.round(performance.now() - loadStart) })
  modelCache.set(modelId, model)
  return model
}

async function inferActionWithBestRuntime(modelId, state, legal, options) {
  const trace = createPipelineStepLogger('NN', Boolean(options?.pipelineTrace), {
    modelId,
    seatId: state.turn?.activeSeatId,
  })
  const backendHint = tf.getBackend() || 'cpu'
  const randomSeed = createSamplingSeed(state, modelId, backendHint)
  trace('infer.begin', { backend: backendHint, workerPathDisabled, legalCount: legal.length })
  if (typeof Worker === 'function' && !workerPathDisabled) {
    try {
      trace('infer.worker.begin')
      const workerStart = performance.now()
      const workerAction = await inferActionViaWorker(modelId, state, legal, options, randomSeed)
      trace('infer.worker.done', {
        workerMs: Math.round(performance.now() - workerStart),
        hasAction: Boolean(workerAction),
      })
      if (workerAction) return workerAction
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      trace('infer.worker.error', { message })
      if (message === 'NN_WORKER_TIMEOUT') {
        terminateSharedWorker()
      }
    }
  }
  if (options?.allowMainThreadInfer === false) {
    return null
  }
  const model = await loadModel(modelId, options)
  const predictStart = performance.now()
  const action = await inferAction(model, state, legal, options, randomSeed)
  trace('infer.main-thread.done', {
    predictMs: Math.round(performance.now() - predictStart),
    actionType: action?.type,
  })
  return {
    ...action,
    backend: backendHint,
    modelId,
  }
}

async function inferAction(model, state, legal, options, randomSeed) {
  const trace = createPipelineStepLogger('NN', Boolean(options?.pipelineTrace), { seatId: state.turn?.activeSeatId })
  const features = buildPolicyObservation(state, { seatId: state.turn.activeSeatId })
  const legalMask = buildPolicyLegalMask(state, { seatId: state.turn.activeSeatId }, legal)
  const obsInput = tf.tensor2d([features])
  const modelInputs = Array.isArray(model.inputs) ? model.inputs.length : 1
  const maskInput = modelInputs > 1 ? tf.tensor2d([legalMask]) : null
  trace('predict.begin', { modelInputs, featureLen: features.length })
  const predictStart = performance.now()
  const prediction = maskInput ? model.predict([obsInput, maskInput]) : model.predict(obsInput)
  const logitsTensor = selectPolicyLogitsTensor(prediction)
  const values = Array.from(await logitsTensor.data())
  trace('predict.done', { predictMs: Math.round(performance.now() - predictStart), logitLen: values.length })
  obsInput.dispose()
  maskInput?.dispose()
  disposePrediction(prediction)
  const selected = selectActionFromScores(values, legalMask, legal, options, randomSeed, state, { seatId: state.turn.activeSeatId })
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
  const seatId = state.turn.activeSeatId
  const seatLoadout = seatId ? [...(state.heroLoadout?.[seatId] ?? [])] : []
  const timeoutMs = options?.workerTimeoutMs ?? DEFAULT_NN_WORKER_TIMEOUT_MS
  const payload = {
    requestId,
    modelId,
    samplingMode: options?.samplingMode ?? 'stochastic',
    randomSeed,
    debugTrace: true,
    legalMask: buildPolicyLegalMask(state, { seatId: state.turn.activeSeatId }, legal),
    legalActions: legal,
    features: buildPolicyObservation(state, { seatId }),
    hero: state.hero,
    activeSeatId: seatId,
    seatLoadout,
  }

  const response = await promiseWithTimeout(
    new Promise((resolve, reject) => {
      workerRequests.set(requestId, { resolve, reject })
      worker.postMessage(payload)
    }),
    timeoutMs,
    () => new Error('NN_WORKER_TIMEOUT'),
  )

  workerRequests.delete(requestId)
  return response
}

function terminateSharedWorker() {
  if (!sharedWorker) return
  for (const pending of workerRequests.values()) {
    pending.reject(new Error('NN_WORKER_TERMINATED'))
  }
  workerRequests.clear()
  sharedWorker.terminate()
  sharedWorker = null
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
      if (data.warmed) {
        pending.resolve(null)
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

function createFallbackAction(legalActions, state, meta) {
  const seed = state?.rng?.state ?? 1
  const next = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0
  const index = legalActions.length > 0 ? next % legalActions.length : 0
  const sample = legalActions[index] ?? legalActions[0]
  return { ...sample, meta }
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
  terminateSharedWorker()
  workerRequestId = 1
  scheduledInferenceQueue = Promise.resolve()
  modelCache.clear()
  workerPathDisabled = false
}
