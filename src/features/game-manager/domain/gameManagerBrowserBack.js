/**
 * Pure decisions for Game Manager browser-back: close top layer or stay on route.
 */

/**
 * @param {string | null | undefined} path
 */
export function isGameManagerPath(path) {
  if (!path || typeof path !== 'string') return false
  return path === '/projects/game-manager' || path.startsWith('/projects/game-manager/')
}

/**
 * @param {{ layerIds: string[] }} input
 * @returns {{ type: 'closeLayer', layerId: string } | { type: 'trap' }}
 */
export function resolveGameManagerBrowserBackAction({ layerIds }) {
  const ids = Array.isArray(layerIds) ? layerIds : []
  if (ids.length > 0) {
    return { type: 'closeLayer', layerId: ids[ids.length - 1] }
  }
  return { type: 'trap' }
}

/**
 * Block leaving Game Manager unless an intentional leave was armed (e.g. timer leg).
 * Same-path navigations (query/hash) are allowed.
 *
 * @param {{
 *   toPath: string,
 *   allowLeave: boolean,
 * }} input
 */
export function shouldBlockGameManagerRouteLeave({ toPath, allowLeave }) {
  if (allowLeave) return false
  return !isGameManagerPath(toPath)
}

/**
 * @template {{ id: string }} T
 * @param {T[]} stack
 * @param {T} layer
 * @returns {T[]}
 */
export function claimLayerOnStack(stack, layer) {
  if (!layer?.id) return stack
  if (stack.some((entry) => entry.id === layer.id)) return stack
  return [...stack, layer]
}

/**
 * @template {{ id: string }} T
 * @param {T[]} stack
 * @param {string} id
 * @returns {T[]}
 */
export function releaseLayerFromStack(stack, id) {
  return stack.filter((entry) => entry.id !== id)
}
