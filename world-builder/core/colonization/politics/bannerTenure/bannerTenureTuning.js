/**
 * Banner-tenure tuning — rolling membership-window habit.
 * Domain: world-builder/CONTEXT.md — Banner tenure.
 */

/** @typedef {{
 *   windowSize: number,
 *   maxStrengthMult: number,
 *   homecomingMult: number,
 *   foreignDampenMult: number,
 *   rebellionArmMult: number,
 *   reconquistaEase: number,
 *   minArmScale: number,
 * }} BannerTenureTuning */

/**
 * Production defaults chosen by hard+soft believability sweep
 * (`bannerTenureBelievability.test.js`):
 * - windowSize 10 → rolling membership memory
 * - maxStrengthMult 1 → defending preferred ≈ subject strength at full affinity
 * - homecomingMult 0.75 → preferred rivals get a clear reunification boost
 * - foreignDampenMult 0.5 → foreign push softened but crushing rivals still clear majority
 * - rebellionArmMult 1 / reconquistaEase 0.5 / minArmScale 0.5 → heartlands harder to arm;
 *   fresh usurpers easier, never below half threshold
 *
 * @type {BannerTenureTuning}
 */
export const DEFAULT_BANNER_TENURE_TUNING = Object.freeze({
  windowSize: 10,
  maxStrengthMult: 1,
  homecomingMult: 0.75,
  foreignDampenMult: 0.5,
  rebellionArmMult: 1,
  reconquistaEase: 0.5,
  minArmScale: 0.5,
})

/** @type {BannerTenureTuning} */
let active = { ...DEFAULT_BANNER_TENURE_TUNING }

/** @returns {BannerTenureTuning} */
export function getBannerTenureTuning() {
  return active
}

/**
 * @param {Partial<BannerTenureTuning>} patch
 * @returns {BannerTenureTuning}
 */
export function setBannerTenureTuning(patch) {
  active = { ...active, ...patch }
  return active
}

/** @returns {BannerTenureTuning} */
export function resetBannerTenureTuning() {
  active = { ...DEFAULT_BANNER_TENURE_TUNING }
  return active
}
