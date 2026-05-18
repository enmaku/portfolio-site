import { PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID } from './projectShellFrame.js'
import {
  PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID,
  applyProjectShellNotifyFrame,
  restoreProjectShellNotifyFrame,
} from './projectShellNotifyFrame.js'

/**
 * @param {boolean} frameActive
 * @param {Pick<Document, 'getElementById'> | null | undefined} doc
 * @returns {{ notifyRoot: Element | null, framePortal: Element | null }}
 */
export function resolveProjectShellNotifyFrameTargets(frameActive, doc) {
  if (doc?.getElementById == null) {
    return { notifyRoot: null, framePortal: null }
  }

  const notifyRoot = doc.getElementById(PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID)
  const framePortal = frameActive
    ? doc.getElementById(PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID)
    : null

  return { notifyRoot, framePortal }
}

/**
 * Apply or clear **Notify** framing for the project shell (`md+` desktop phone frame).
 *
 * @param {{
 *   notifyApi: { setDefaults: (opts: Record<string, unknown>) => void },
 *   frameActive: boolean,
 *   doc?: Pick<Document, 'body' | 'getElementById'> | null,
 * }} params
 * @returns {boolean} `true` when framed sync does not need a DOM retry
 */
export function syncProjectShellLayoutNotifyFrame({
  notifyApi,
  frameActive,
  doc = typeof document !== 'undefined' ? document : null,
}) {
  if (doc == null) return true

  const { notifyRoot, framePortal } = resolveProjectShellNotifyFrameTargets(frameActive, doc)

  applyProjectShellNotifyFrame({
    notifyApi,
    frameActive,
    notifyRoot,
    framePortal,
    documentBody: doc.body ?? null,
  })

  return !frameActive || framePortal != null
}

/**
 * @param {{
 *   notifyApi: { setDefaults: (opts: Record<string, unknown>) => void },
 *   doc?: Pick<Document, 'body' | 'getElementById'> | null,
 * }} params
 */
export function teardownProjectShellLayoutNotifyFrame({
  notifyApi,
  doc = typeof document !== 'undefined' ? document : null,
}) {
  if (doc == null) return

  restoreProjectShellNotifyFrame({
    notifyApi,
    notifyRoot: doc.getElementById(PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID),
    documentBody: doc.body ?? null,
  })
}
