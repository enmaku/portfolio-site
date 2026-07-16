/**
 * Mutual-credit bilateral obligations and settlement trade accounts.
 * Domain: world-builder/CONTEXT.md — mutual credit, bilateral obligation.
 */

/**
 * @typedef {Object} BilateralObligation
 * @property {string} creditorSettlementId Settlement owed value (positive balance contributor).
 * @property {string} debtorSettlementId Settlement that owes.
 * @property {number} amountCp Net cp owed by debtor to creditor (always ≥ 0).
 */

/**
 * @typedef {Object} TradeAccountsState
 * @property {BilateralObligation[]} obligations
 * @property {Record<string, number>} balancesBySettlementId Derived realm balances (sum to 0).
 */

/**
 * @returns {TradeAccountsState}
 */
export function createEmptyTradeAccounts() {
  return { obligations: [], balancesBySettlementId: {} }
}

/**
 * @param {TradeAccountsState} state
 * @returns {Record<string, number>}
 */
export function recomputeBalances(state) {
  /** @type {Record<string, number>} */
  const balances = {}
  for (const edge of state.obligations) {
    balances[edge.creditorSettlementId] = (balances[edge.creditorSettlementId] ?? 0) + edge.amountCp
    balances[edge.debtorSettlementId] = (balances[edge.debtorSettlementId] ?? 0) - edge.amountCp
  }
  state.balancesBySettlementId = balances
  return balances
}

/**
 * Apply a directed obligation (importer owes exporter), then pair-wise net.
 *
 * @param {TradeAccountsState} state
 * @param {{ fromSettlementId: string, toSettlementId: string, amountCp: number }} delta
 *   from = debtor (importer), to = creditor (exporter)
 * @returns {TradeAccountsState}
 */
export function applyObligation(state, delta) {
  if (!(delta.amountCp > 0) || delta.fromSettlementId === delta.toSettlementId) {
    return state
  }
  const next = {
    obligations: state.obligations.map((row) => ({ ...row })),
    balancesBySettlementId: { ...state.balancesBySettlementId },
  }
  next.obligations.push({
    creditorSettlementId: delta.toSettlementId,
    debtorSettlementId: delta.fromSettlementId,
    amountCp: delta.amountCp,
  })
  return netPairwiseObligations(next)
}

/**
 * @param {TradeAccountsState} state
 * @returns {TradeAccountsState}
 */
export function netPairwiseObligations(state) {
  /** @type {Map<string, number>} */
  const net = new Map()
  for (const edge of state.obligations) {
    const lo =
      edge.creditorSettlementId < edge.debtorSettlementId
        ? edge.creditorSettlementId
        : edge.debtorSettlementId
    const hi =
      edge.creditorSettlementId < edge.debtorSettlementId
        ? edge.debtorSettlementId
        : edge.creditorSettlementId
    const key = `${lo}|${hi}`
    const sign = edge.creditorSettlementId === lo ? 1 : -1
    net.set(key, (net.get(key) ?? 0) + sign * edge.amountCp)
  }
  /** @type {BilateralObligation[]} */
  const obligations = []
  for (const [key, amount] of net) {
    if (!(amount !== 0) || !Number.isFinite(amount)) continue
    const [lo, hi] = key.split('|')
    if (amount > 0) {
      obligations.push({ creditorSettlementId: lo, debtorSettlementId: hi, amountCp: amount })
    } else {
      obligations.push({ creditorSettlementId: hi, debtorSettlementId: lo, amountCp: -amount })
    }
  }
  obligations.sort((a, b) => {
    const c = a.creditorSettlementId.localeCompare(b.creditorSettlementId)
    if (c !== 0) return c
    return a.debtorSettlementId.localeCompare(b.debtorSettlementId)
  })
  const next = { obligations, balancesBySettlementId: {} }
  recomputeBalances(next)
  return next
}

/**
 * @param {TradeAccountsState} state
 * @param {string} settlementId
 * @returns {TradeAccountsState}
 */
export function cancelObligationsForSettlement(state, settlementId) {
  const next = {
    obligations: state.obligations.filter(
      (edge) =>
        edge.creditorSettlementId !== settlementId && edge.debtorSettlementId !== settlementId,
    ),
    balancesBySettlementId: {},
  }
  recomputeBalances(next)
  return next
}

/**
 * Transfer all obligations involving absorbedId onto survivorId, then net.
 *
 * @param {TradeAccountsState} state
 * @param {{ survivorSettlementId: string, absorbedSettlementId: string }} params
 * @returns {TradeAccountsState}
 */
export function transferObligationsOnMerge(state, params) {
  const { survivorSettlementId, absorbedSettlementId } = params
  if (survivorSettlementId === absorbedSettlementId) {
    return state
  }
  const remapped = state.obligations.map((edge) => {
    const creditor =
      edge.creditorSettlementId === absorbedSettlementId
        ? survivorSettlementId
        : edge.creditorSettlementId
    const debtor =
      edge.debtorSettlementId === absorbedSettlementId
        ? survivorSettlementId
        : edge.debtorSettlementId
    return {
      creditorSettlementId: creditor,
      debtorSettlementId: debtor,
      amountCp: edge.amountCp,
    }
  })
  return netPairwiseObligations({
    obligations: remapped.filter((edge) => edge.creditorSettlementId !== edge.debtorSettlementId),
    balancesBySettlementId: {},
  })
}
