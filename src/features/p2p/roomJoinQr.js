/**
 * QR rendering for star-room **join links**: mobile attendees scan instead of typing a **room code**.
 *
 * The SVG is emitted as a data URL so callers can drop it into an `<img>` (no `v-html`).
 */

import { renderSVG } from 'uqr'

/** Pixels per QR module in the emitted SVG; keeps the raster crisp on high-DPI screens. */
export const ROOM_JOIN_QR_PIXEL_SIZE = 8

/**
 * Quiet zone around the code, in modules. Four is the QR spec minimum; the hosting menu is
 * tight on horizontal space, so two still scans reliably while keeping the image compact.
 */
export const ROOM_JOIN_QR_BORDER_MODULES = 2

/** Dark-mode-safe module colours: scanners need dark modules on a light field. */
export const ROOM_JOIN_QR_BLACK = '#000000'
export const ROOM_JOIN_QR_WHITE = '#ffffff'

/**
 * Build an `<img src>`-ready QR code for a **join link**.
 * @param {string} url Absolute join URL (see `build*RoomShareUrl`).
 * @param {{ pixelSize?: number, border?: number }} [options]
 * @returns {string} `data:image/svg+xml` URL, or `''` when there is no URL.
 */
export function buildRoomJoinQrDataUrl(url, options = {}) {
  if (!url) return ''
  const pixelSize = options.pixelSize ?? ROOM_JOIN_QR_PIXEL_SIZE
  const border = options.border ?? ROOM_JOIN_QR_BORDER_MODULES
  const svg = renderSVG(url, {
    ecc: 'M',
    pixelSize,
    border,
    blackColor: ROOM_JOIN_QR_BLACK,
    whiteColor: ROOM_JOIN_QR_WHITE,
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
