/**
 * Serialize attendance saves and keep only the newest selection when taps
 * arrive while a save is already in flight.
 *
 * @param {(ids: string[]) => Promise<void>} write
 */
export function createLatestAttendanceWrite(write) {
  /** @type {string[] | null} */
  let queued = null
  let running = false
  /** @type {Promise<void>} */
  let idle = Promise.resolve()

  async function pump() {
    running = true
    try {
      while (queued) {
        const ids = queued
        queued = null
        try {
          await write(ids)
        } catch (error) {
          if (queued) continue
          throw error
        }
      }
    } finally {
      running = false
      if (queued) idle = pump()
    }
  }

  return {
    get pending() {
      return running || queued != null
    },

    /**
     * @param {string[]} ids
     * @returns {Promise<void>}
     */
    push(ids) {
      queued = [...ids]
      if (!running) idle = pump()
      return this.flush()
    },

    /**
     * @returns {Promise<void>}
     */
    flush() {
      if (queued && !running) idle = pump()
      return idle.then(() => {
        if (running || queued) return this.flush()
      })
    },
  }
}
