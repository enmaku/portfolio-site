import { PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS } from './projectShellNotifyFrame.js'

export const PROJECT_SHELL_FULLSCREEN_FAILURE_NOTIFY_TYPE = 'warning'

const FULLSCREEN_FAILURE_MESSAGE = 'Fullscreen could not be enabled.'

/**
 * Warning toast when the browser rejects a fullscreen request inside the project shell.
 *
 * @param {(opts: Record<string, unknown>) => void} notify Quasar `Notify.create` or `useQuasar().notify`
 */
export function notifyProjectShellFullscreenFailure(notify) {
  notify({
    type: PROJECT_SHELL_FULLSCREEN_FAILURE_NOTIFY_TYPE,
    message: FULLSCREEN_FAILURE_MESSAGE,
    timeout: 2500,
    ...PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS,
  })
}
