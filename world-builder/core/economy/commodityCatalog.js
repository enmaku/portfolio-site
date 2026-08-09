/**
 * Baseline commodity catalog: ids, reference prices (cp), and cargo units.
 * Domain: world-builder/CONTEXT.md — commodity catalog, reference price.
 */

/** @typedef {'grain' | 'fish' | 'salt' | 'timber' | 'baseMetals' | 'copper' | 'silver' | 'gold' | 'diamonds'} CommodityId */

/** @typedef {'lb' | 'gem'} CommodityUnit */

/**
 * @typedef {Object} CommodityDef
 * @property {CommodityId} id
 * @property {number} referencePriceCp Price in copper pieces per catalog unit.
 * @property {CommodityUnit} unit
 * @property {number} cargoLbPerUnit Physical cargo weight of one catalog unit.
 */

/** Copper pieces per silver piece / gold piece (Fifth Edition). */
export const CP_PER_SP = 10
export const CP_PER_GP = 100

/**
 * @type {ReadonlyArray<CommodityId>}
 */
export const COMMODITY_IDS = Object.freeze([
  'grain',
  'fish',
  'salt',
  'timber',
  'baseMetals',
  'copper',
  'silver',
  'gold',
  'diamonds',
])

/**
 * Reference prices: grain 1 cp/lb, fish 2 cp/lb, salt 5 cp/lb, timber 0.5 cp/lb,
 * base metals 1 sp/lb, copper 5 sp/lb, silver 5 gp/lb, gold 50 gp/lb, diamonds 5000 gp/gem.
 *
 * @type {Readonly<Record<CommodityId, CommodityDef>>}
 */
export const COMMODITIES = Object.freeze({
  grain: Object.freeze({ id: 'grain', referencePriceCp: 1, unit: 'lb', cargoLbPerUnit: 1 }),
  fish: Object.freeze({ id: 'fish', referencePriceCp: 2, unit: 'lb', cargoLbPerUnit: 1 }),
  salt: Object.freeze({ id: 'salt', referencePriceCp: 5, unit: 'lb', cargoLbPerUnit: 1 }),
  timber: Object.freeze({
    id: 'timber',
    referencePriceCp: 0.5,
    unit: 'lb',
    cargoLbPerUnit: 1,
  }),
  baseMetals: Object.freeze({
    id: 'baseMetals',
    referencePriceCp: CP_PER_SP,
    unit: 'lb',
    cargoLbPerUnit: 1,
  }),
  copper: Object.freeze({
    id: 'copper',
    referencePriceCp: 5 * CP_PER_SP,
    unit: 'lb',
    cargoLbPerUnit: 1,
  }),
  silver: Object.freeze({
    id: 'silver',
    referencePriceCp: 5 * CP_PER_GP,
    unit: 'lb',
    cargoLbPerUnit: 1,
  }),
  gold: Object.freeze({
    id: 'gold',
    referencePriceCp: 50 * CP_PER_GP,
    unit: 'lb',
    cargoLbPerUnit: 1,
  }),
  diamonds: Object.freeze({
    id: 'diamonds',
    referencePriceCp: 5000 * CP_PER_GP,
    unit: 'gem',
    cargoLbPerUnit: 0.1,
  }),
})

/**
 * @param {CommodityId} id
 * @returns {number}
 */
export function referencePriceCp(id) {
  return COMMODITIES[id].referencePriceCp
}

/**
 * @param {CommodityId} id
 * @returns {CommodityUnit}
 */
export function commodityUnit(id) {
  return COMMODITIES[id].unit
}

/**
 * @param {CommodityId} id
 * @returns {number}
 */
export function cargoLbPerUnit(id) {
  return COMMODITIES[id].cargoLbPerUnit
}
