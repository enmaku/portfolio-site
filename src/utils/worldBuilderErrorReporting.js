/**
 * @param {unknown} error
 * @returns {string}
 */
export function formatWorldBuilderError(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * @param {string} context
 * @param {unknown} error
 * @param {(message: string) => void} [notify]
 */
export function reportWorldBuilderError(context, error, notify) {
  const message = `${context}: ${formatWorldBuilderError(error)}`
  console.error(message, error)
  notify?.(message)
}
