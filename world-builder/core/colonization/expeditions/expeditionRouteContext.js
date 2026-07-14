import { buildOceanMask, resolveSailTraversableMask } from './expeditionRouting.js'

/**
 * @typedef {Object} ExpeditionRouteContext
 * @property {import('../../types.js').WorldDocument} doc
 * @property {boolean[] | null} oceanMask
 * @property {Uint8Array | null} sailMask
 */

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {ExpeditionRouteContext}
 */
export function createExpeditionRouteContext(doc) {
  return {
    doc,
    oceanMask: null,
    sailMask: null,
  }
}

/**
 * @param {ExpeditionRouteContext} context
 * @returns {boolean[]}
 */
export function resolveExpeditionOceanMask(context) {
  if (!context.oceanMask) {
    context.oceanMask = buildOceanMask(context.doc)
  }
  return context.oceanMask
}

/**
 * @param {ExpeditionRouteContext} context
 * @returns {Uint8Array | null}
 */
export function resolveExpeditionSailMask(context) {
  if (context.sailMask === null) {
    context.sailMask = resolveSailTraversableMask(context.doc)
  }
  return context.sailMask
}
