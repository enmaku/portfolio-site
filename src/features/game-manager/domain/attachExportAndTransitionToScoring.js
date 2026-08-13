/**
 * Persist timer export onto a linked play session and move it to scoring.
 */

import { applyTimerExport, movePlaySession } from '../sessions/sessionsViewModel.js'

/**
 * @param {{
 *   uid: string,
 *   playSessionId: string,
 *   timerExport: object,
 *   getSession: (uid: string, playSessionId: string) => Promise<object | null>,
 *   upsertSession: (uid: string, playSessionId: string, session: object) => Promise<void>,
 *   newId: () => string,
 * }} input
 */
export async function attachExportAndTransitionToScoring(input) {
  const session = await input.getSession(input.uid, input.playSessionId)
  if (!session) {
    throw new Error('Play session not found')
  }
  const withExport = applyTimerExport(session, input.timerExport, { newId: input.newId })
  await input.upsertSession(input.uid, input.playSessionId, withExport)
  const scoring = movePlaySession(withExport, 'scoring')
  await input.upsertSession(input.uid, input.playSessionId, scoring)
  return scoring
}
