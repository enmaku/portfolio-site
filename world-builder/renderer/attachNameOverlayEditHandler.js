/**
 * @typedef {{
 *   kind: 'settlement' | 'faction' | 'realm',
 *   id?: string,
 * }} NameOverlayEditTarget
 */

/**
 * @param {{
 *   eventMode?: string,
 *   cursor?: string,
 *   on?: (event: string, handler: (event: { stopPropagation?: () => void }) => void) => void,
 * } | null | undefined} displayObject
 * @param {NameOverlayEditTarget} payload
 * @param {((payload: NameOverlayEditTarget) => void) | null | undefined} onEdit
 */
export function attachNameOverlayEditHandler(displayObject, payload, onEdit) {
  if (!displayObject || typeof onEdit !== 'function') return
  displayObject.eventMode = 'static'
  displayObject.cursor = 'pointer'
  if (typeof displayObject.on !== 'function') return
  displayObject.on('pointertap', (event) => {
    event?.stopPropagation?.()
    onEdit(payload)
  })
}
