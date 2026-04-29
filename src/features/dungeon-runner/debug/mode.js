export function isDebugModeEnabledForLocation(url) {
  const parsed = new URL(url)
  const hostAllowed = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  const searchParams = new URLSearchParams(parsed.search)
  const hashQuery = parsed.hash.split('?')[1] ?? ''
  const hashParams = new URLSearchParams(hashQuery)
  return hostAllowed && (searchParams.get('debug') === 'true' || hashParams.get('debug') === 'true')
}

export function shouldEnableDebugOnBoot(url) {
  return isDebugModeEnabledForLocation(url)
}
