/**
 * @param {Array<{ personId?: string, name: string, credits: number, share?: number }>} rows
 * @returns {{ status: 'ok', chart: { keys: string[], counts: number[], percents: number[], total: number, colors?: (string|null)[] } } | { status: 'error' }}
 */
export function buildWinShareChart(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: 'error' }
  }

  let total = 0
  for (const row of rows) {
    if (!row || typeof row.name !== 'string' || !Number.isFinite(row.credits) || row.credits < 0) {
      return { status: 'error' }
    }
    total += row.credits
  }
  if (total <= 0) {
    return { status: 'error' }
  }

  return {
    status: 'ok',
    chart: {
      keys: rows.map((row) => row.name),
      counts: rows.map((row) => row.credits),
      percents: rows.map((row) => Math.round((row.credits / total) * 100)),
      total,
      colors: rows.map((row) => row.color || null),
    },
  }
}
