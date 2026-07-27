/**
 * Catalog commodities shown in realm economy / settlement trade tooltip.
 * Pin commodities (salt, typed minerals) match **resource claim** presence:
 * omitted when the landmass has zero pins of that type.
 * Domain: world-builder/CONTEXT.md — commodity catalog, mineral deposit, salt.
 */

import { COMMODITY_IDS } from './commodityCatalog.js'

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 */

/** Always present on a landmass (continuous / shore production, not discrete pins). */
const ALWAYS_PRESENT = Object.freeze(
  /** @type {CommodityId[]} */ (['grain', 'fish', 'timber', 'baseMetals']),
)

/**
 * Salt / mineral pin commodity ids that exist on this landmass (world total > 0).
 * Same presence rule as the **sim status** resource-claims table.
 *
 * @param {{
 *   saltNodes?: ReadonlyArray<unknown>,
 *   metalNodes?: ReadonlyArray<{ kind?: string }>,
 * } | null | undefined} worldDocument
 * @returns {CommodityId[]}
 */
export function presentPinCommodityIds(worldDocument) {
  /** @type {CommodityId[]} */
  const present = []
  if ((worldDocument?.saltNodes ?? []).length > 0) {
    present.push('salt')
  }
  const metalNodes = worldDocument?.metalNodes ?? []
  /** @type {ReadonlyArray<{ kind: string, commodityId: CommodityId }>} */
  const mineralKinds = [
    { kind: 'copper', commodityId: 'copper' },
    { kind: 'silver', commodityId: 'silver' },
    { kind: 'gold', commodityId: 'gold' },
    { kind: 'diamond', commodityId: 'diamonds' },
  ]
  for (const { kind, commodityId } of mineralKinds) {
    if (metalNodes.some((node) => node.kind === kind)) {
      present.push(commodityId)
    }
  }
  return present
}

/**
 * Catalog commodities for author-facing price boards, in catalog order.
 *
 * @param {{
 *   saltNodes?: ReadonlyArray<unknown>,
 *   metalNodes?: ReadonlyArray<{ kind?: string }>,
 * } | null | undefined} worldDocument
 * @returns {CommodityId[]}
 */
export function presentMapCommodityIds(worldDocument) {
  const pinIds = new Set(presentPinCommodityIds(worldDocument))
  return COMMODITY_IDS.filter(
    (id) => ALWAYS_PRESENT.includes(id) || pinIds.has(id),
  )
}
