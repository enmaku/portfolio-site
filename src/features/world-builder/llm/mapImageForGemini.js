/**
 * Encode an HTML canvas to a JPEG Blob at its native pixel size.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} [quality=0.85]
 * @returns {Promise<Blob>}
 */
export function canvasToJpegBlob(canvas, quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('canvas.toBlob returned null for JPEG encode'))
      },
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Convert a PNG (or other image) Blob to a JPEG Blob at full pixel size.
 *
 * @param {Blob} blob
 * @param {number} [quality=0.85]
 * @returns {Promise<Blob>}
 */
export async function rasterBlobToJpegBlob(blob, quality = 0.85) {
  if (typeof createImageBitmap !== 'function') {
    return blob
  }
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Could not get canvas 2d context for map JPEG encode')
    }
    ctx.drawImage(bitmap, 0, 0)
    return await canvasToJpegBlob(canvas, quality)
  } finally {
    bitmap.close?.()
  }
}

/**
 * @param {Blob} blob
 * @returns {Promise<{ inlineData: { data: string, mimeType: string } }>}
 */
export async function blobToGenerativeInlinePart(blob) {
  const mimeType = blob.type || 'image/png'
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('FileReader did not return a data URL'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  if (comma < 0) {
    throw new Error('Invalid data URL for map image')
  }
  return {
    inlineData: {
      data: dataUrl.slice(comma + 1),
      mimeType,
    },
  }
}
