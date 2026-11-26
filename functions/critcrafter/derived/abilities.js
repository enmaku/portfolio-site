'use strict'
const { ABILITY_IDS, abilityMod } = require('./stat')

/** Final ability scores and mods, in str..cha order. No breakdown: mods are not tappable. */
function deriveAbilities(build) {
  return ABILITY_IDS.map((id) => {
    const score = Number(build.abilities && build.abilities[id])
    const s = Number.isFinite(score) ? score : 10
    return { id, score: s, mod: abilityMod(s) }
  })
}

module.exports = { deriveAbilities }
