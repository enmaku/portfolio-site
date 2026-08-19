/**
 * @param {{ displayName?: string | null } | null | undefined} user
 * @returns {string}
 */
export function defaultIssuerName(user) {
  return String(user?.displayName || '').trim()
}
