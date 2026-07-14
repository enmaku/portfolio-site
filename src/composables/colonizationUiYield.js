/**
 * Yield to the browser so colonization progress UI can paint between synchronous phases.
 *
 * @returns {Promise<void>}
 */
export function yieldColonizationProgressToUi() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}
