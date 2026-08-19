export function formatUsd(amount) {
  return `$${Number(amount).toFixed(2)}`
}

export function formatUsdFromCents(cents) {
  return formatUsd(Number(cents) / 100)
}

export function formatDurationMs(ms) {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
