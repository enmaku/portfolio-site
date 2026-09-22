/**
 * @param {{
 *   allReady: boolean,
 *   uniqueCount: number,
 *   prevNotice?: { kind: string, id: number } | null,
 * }} args
 * @returns {{ kind: 'insufficient_movies', id: number } | null}
 */
export function nextInsufficientMoviesNotice({ allReady, uniqueCount, prevNotice }) {
  if (!allReady || uniqueCount > 1) return null
  const prevId = prevNotice && typeof prevNotice.id === 'number' ? prevNotice.id : 0
  return { kind: 'insufficient_movies', id: prevId + 1 }
}
