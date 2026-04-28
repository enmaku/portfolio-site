/**
 * Open a PeerJS Peer with a timeout; destroys the peer on error or timeout.
 */

import Peer from 'peerjs'
import { OPEN_PEER_TIMEOUT_MS } from './starRoomTiming.js'

/**
 * @param {string} [brokerId] When non-empty, open as this broker id (hub). Otherwise random id (guest).
 * @param {number} [timeoutMs]
 * @returns {Promise<import('peerjs').Peer>}
 */
export function awaitPeerOpen(brokerId, timeoutMs = OPEN_PEER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const pr =
      typeof brokerId === 'string' && brokerId.length > 0 ? new Peer(brokerId) : new Peer()
    const t = window.setTimeout(() => {
      try {
        pr.destroy()
      } catch {
        void 0
      }
      reject(new Error('Peer open timeout'))
    }, timeoutMs)
    pr.on('error', (e) => {
      window.clearTimeout(t)
      try {
        pr.destroy()
      } catch {
        void 0
      }
      reject(e)
    })
    pr.on('open', () => {
      window.clearTimeout(t)
      resolve(pr)
    })
  })
}
