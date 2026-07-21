/**
 * Trigger a browser file download for a blob.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {{ createElement?: typeof document.createElement, body?: { appendChild: Function, removeChild: Function } }} [dom]
 */
export function downloadBlob(blob, filename, dom = globalThis.document) {
  if (!dom?.createElement) {
    throw new Error('document is required to download a blob')
  }
  const url = URL.createObjectURL(blob)
  const anchor = dom.createElement('a')
  anchor.href = url
  anchor.download = filename
  const body = dom.body
  if (body?.appendChild) {
    body.appendChild(anchor)
  }
  anchor.click()
  if (body?.removeChild) {
    body.removeChild(anchor)
  }
  URL.revokeObjectURL(url)
}
