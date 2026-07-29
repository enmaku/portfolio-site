/**
 * Deterministic contested-settlement force comparison.
 * Domain: world-builder/CONTEXT.md — Contested settlement, Defender advantage; ADR 0020.
 */

/**
 * Compare projected might at one contested settlement.
 * Defender advantage multiplies only the stake pin's wall-holding contribution.
 * Ties favor the defender. Nonpositive attacker projection cannot contest.
 *
 * @param {{
 *   attackerProjectedMight: number,
 *   defenderProjectedMight: number,
 *   stakeDefenderProjectedMight?: number,
 *   defenderAdvantageOnStake?: number,
 * }} params
 * @returns {'attacker' | 'defender' | 'unreachable'}
 */
export function resolveContestedSettlement(params) {
  const attacker = Number(params.attackerProjectedMight) || 0
  if (!(attacker > 0)) return 'unreachable'

  const defenderTotalRaw = Math.max(0, Number(params.defenderProjectedMight) || 0)
  const stakeRaw = Math.max(
    0,
    Number(
      params.stakeDefenderProjectedMight != null
        ? params.stakeDefenderProjectedMight
        : defenderTotalRaw,
    ) || 0,
  )
  const stakeClamped = Math.min(stakeRaw, defenderTotalRaw)
  const advantage = Math.max(0, Number(params.defenderAdvantageOnStake) || 1)
  const allies = defenderTotalRaw - stakeClamped
  const defenderTotal = allies + stakeClamped * advantage

  if (attacker > defenderTotal) return 'attacker'
  return 'defender'
}
