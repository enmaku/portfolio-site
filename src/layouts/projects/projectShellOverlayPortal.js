import { changeGlobalNodesTarget } from 'quasar/src/utils/private.config/nodes.js'

import { resolveProjectShellOverlayPortalMount } from './projectShellFrame.js'

/**
 * @param {Pick<Document, 'body'> | null | undefined} [doc]
 * @returns {HTMLElement}
 */
function resolveDocumentBody(doc) {
  const root = doc ?? (typeof document !== 'undefined' ? document : null)
  if (root?.body == null) {
    throw new Error('project shell overlay portal requires document.body')
  }
  return root.body
}

/**
 * Quasar teleports QDialog/QMenu/etc. into global nodes under `document.body` by default.
 * `changeGlobalNodesTarget` reparents those nodes (same hook AppFullscreen uses).
 *
 * @param {boolean} frameActive
 * @param {Pick<Document, 'body' | 'getElementById'> | null | undefined} [doc]
 * @returns {HTMLElement | null}
 */
export function resolveProjectShellOverlayPortalTarget(frameActive, doc) {
  if (!frameActive) {
    return resolveDocumentBody(doc)
  }
  return resolveProjectShellOverlayPortalMount(true, doc)
}

/**
 * @param {boolean} frameActive
 * @param {Pick<Document, 'body' | 'getElementById'> | null | undefined} [doc]
 */
export function syncProjectShellOverlayPortalTarget(frameActive, doc) {
  if (doc == null && typeof document === 'undefined') return

  const target = resolveProjectShellOverlayPortalTarget(frameActive, doc)
  if (target == null) return

  changeGlobalNodesTarget(target)
}

/** Restore Quasar’s default portal parent when leaving the project shell. */
export function resetProjectShellOverlayPortalTarget(doc) {
  if (doc == null && typeof document === 'undefined') return
  changeGlobalNodesTarget(resolveDocumentBody(doc))
}
