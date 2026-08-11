/**
 * Shared name prompts for host / join entry points.
 */

import { Dialog } from 'quasar'
import { normalizeParticipantName } from '../participantName.js'
import { joinRoom } from '../p2p/session.js'
import { normalizeRoomSuffixInput } from '../p2p/roomId.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'

/**
 * @returns {string}
 */
function stickyParticipantName() {
  try {
    return normalizeParticipantName(useMovieVoteRoomSessionStore().participantName || '')
  } catch {
    return ''
  }
}

/**
 * Prompt for a participant name (or use sticky), then join.
 *
 * @param {string} rawCode
 * @param {{ promptDialog?: typeof Dialog.create }} [opts]
 * @returns {Promise<void>}
 */
export async function promptAndJoinRoom(rawCode, opts = {}) {
  const code = normalizeRoomSuffixInput(rawCode)
  if (!code) return

  let participantName = stickyParticipantName()
  if (!participantName) {
    const create = opts.promptDialog ?? ((cfg) => Dialog.create(cfg))
    participantName = await new Promise((resolve) => {
      create({
        title: 'Join room',
        message: 'Enter your name to join.',
        prompt: {
          model: '',
          type: 'text',
        },
        cancel: true,
        persistent: true,
      })
        .onOk((name) => {
          resolve(normalizeParticipantName(name))
        })
        .onCancel(() => {
          resolve('')
        })
    })
  }
  if (!participantName) return
  await joinRoom(code, { participantName })
}
