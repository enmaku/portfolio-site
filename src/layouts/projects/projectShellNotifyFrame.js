/** Quasar Notify global mount (`createGlobalNode('q-notify')`). */
export const PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID = 'q-notify'

/** Notify defaults while **desktop phone frame** is active. */
export const PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS = { position: 'top' }

/** Baseline Notify position restored when leaving the frame (Quasar default). */
export const PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS = { position: 'bottom' }

/** @type {typeof PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS | null} */
let notifyDefaultsRestoreSnapshot = null

/**
 * @param {boolean} frameActive
 * @returns {typeof PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS | typeof PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS}
 */
export function resolveProjectShellNotifyDefaults(frameActive) {
  return frameActive
    ? { ...PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS }
    : { ...PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS }
}

/**
 * Reparent the Notify plugin root into the frame column or back to `document.body`.
 *
 * @param {{
 *   notifyRoot: Element | null,
 *   framePortal: Element | null,
 *   frameActive: boolean,
 *   documentBody?: Element | null,
 * }} params
 */
export function syncProjectShellNotifyContainer({
  notifyRoot,
  framePortal,
  frameActive,
  documentBody = typeof document !== 'undefined' ? document.body : null,
}) {
  if (!notifyRoot || !documentBody) return

  const target = frameActive && framePortal ? framePortal : documentBody
  if (notifyRoot.parentElement !== target) {
    target.appendChild(notifyRoot)
  }
}

/**
 * @param {{
 *   notifyApi: { setDefaults: (opts: Record<string, unknown>) => void },
 *   frameActive: boolean,
 *   notifyRoot: Element | null,
 *   framePortal: Element | null,
 *   documentBody?: Element | null,
 * }} params
 */
export function applyProjectShellNotifyFrame({
  notifyApi,
  frameActive,
  notifyRoot,
  framePortal,
  documentBody,
}) {
  if (frameActive) {
    if (notifyDefaultsRestoreSnapshot === null) {
      notifyDefaultsRestoreSnapshot = { ...PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS }
    }
    notifyApi.setDefaults(resolveProjectShellNotifyDefaults(true))
  } else if (notifyDefaultsRestoreSnapshot !== null) {
    notifyApi.setDefaults(notifyDefaultsRestoreSnapshot)
  } else {
    notifyApi.setDefaults(resolveProjectShellNotifyDefaults(false))
  }

  syncProjectShellNotifyContainer({
    notifyRoot,
    framePortal,
    frameActive,
    documentBody,
  })
}

/**
 * @param {{
 *   notifyApi: { setDefaults: (opts: Record<string, unknown>) => void },
 *   notifyRoot: Element | null,
 *   documentBody?: Element | null,
 * }} params
 */
export function restoreProjectShellNotifyFrame({
  notifyApi,
  notifyRoot,
  documentBody,
}) {
  if (notifyDefaultsRestoreSnapshot !== null) {
    notifyApi.setDefaults(notifyDefaultsRestoreSnapshot)
    notifyDefaultsRestoreSnapshot = null
  } else {
    notifyApi.setDefaults(resolveProjectShellNotifyDefaults(false))
  }

  syncProjectShellNotifyContainer({
    notifyRoot,
    framePortal: null,
    frameActive: false,
    documentBody,
  })
}

/** @internal */
export function resetProjectShellNotifyFrameStateForTests() {
  notifyDefaultsRestoreSnapshot = null
}
