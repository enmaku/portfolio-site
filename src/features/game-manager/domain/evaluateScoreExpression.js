/**
 * Resolve a points score draft: a plain number or a +/− expression.
 * Only addition and subtraction (no × ÷ parentheses). Negatives allowed.
 *
 * @param {unknown} raw
 * @returns {number | null}
 */
export function evaluateScoreExpression(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (raw == null) return null

  const input = String(raw)
    .trim()
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\s+/g, '')
  if (!input) return null

  let i = 0
  const len = input.length

  function readUnsignedNumber() {
    const start = i
    while (i < len && input[i] >= '0' && input[i] <= '9') i += 1
    if (i < len && input[i] === '.') {
      i += 1
      const fracStart = i
      while (i < len && input[i] >= '0' && input[i] <= '9') i += 1
      if (i === fracStart) return Number.NaN
    }
    if (i === start) return Number.NaN
    const n = Number(input.slice(start, i))
    return Number.isFinite(n) ? n : Number.NaN
  }

  function readTerm() {
    let sign = 1
    if (input[i] === '+') {
      i += 1
    } else if (input[i] === '-') {
      sign = -1
      i += 1
    }
    const n = readUnsignedNumber()
    return Number.isFinite(n) ? sign * n : Number.NaN
  }

  let total = readTerm()
  if (!Number.isFinite(total)) return null

  while (i < len) {
    const op = input[i]
    if (op !== '+' && op !== '-') return null
    i += 1
    const rhs = readTerm()
    if (!Number.isFinite(rhs)) return null
    total = op === '+' ? total + rhs : total - rhs
  }

  return total
}
