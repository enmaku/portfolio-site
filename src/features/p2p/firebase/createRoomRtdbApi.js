import { ref } from 'firebase/database'
import { createRtdbCore } from './createRtdbCore.js'

/**
 * @param {{ roomsRoot: string, label: string }} options
 * @returns {{
 *   getDatabase: () => import('firebase/database').Database,
 *   roomPath: (suffix: string) => string,
 *   roomRef: (suffix: string) => import('firebase/database').DatabaseReference,
 *   sanitizeForRtdb: (value: unknown) => unknown,
 *   setRtdb: (dbRef: import('firebase/database').DatabaseReference, value: unknown) => Promise<void>,
 * }}
 */
export function createRoomRtdbApi({ roomsRoot, label }) {
  const { getDatabase, sanitizeForRtdb, setRtdb } = createRtdbCore({
    configuredBehavior: 'throw',
    label,
  })

  function roomPath(suffix) {
    return `${roomsRoot}/${suffix}`
  }

  function roomRef(suffix) {
    return ref(getDatabase(), roomPath(suffix))
  }

  return {
    getDatabase,
    roomPath,
    roomRef,
    sanitizeForRtdb,
    setRtdb,
  }
}
